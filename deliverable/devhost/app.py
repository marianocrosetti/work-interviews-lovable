import os
import signal
import json
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import threading
import logging
import atexit
import subprocess
import time
import tempfile
from waitress import serve
from utils import (
    debug_folder,
    log_output, 
    server_lock, 
    stop_running_server,
    is_port_in_use,
    cleanup as utils_cleanup
)

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Path to workspace data volume
WORKSPACE_DIR = os.environ.get('WORKSPACE_DIR', '/workspace_data')
# Control port for the Flask API
CONTROL_PORT = int(os.environ.get('CONTROL_PORT', 5000))
# Starting port for the proxy (npm dev servers)
PROXY_PORT = int(os.environ.get('PROXY_PORT', 3035))

# Server state
running_process_id = None
running_project_id = None

@app.route('/start', methods=['POST'])
def start_server():
    global running_process_id, running_project_id
    
    data = request.json
    project_id = data.get('project_id')
    
    if not project_id:
        return jsonify({"error": "Missing project_id"}), 400
    
    logger.info(f"Received request to start server for project: {project_id}")
    
    # Stop any running server first
    if running_process_id:
        logger.info(f"Stopping previous server (PID: {running_process_id}, Project: {running_project_id})")
        stop_running_server(running_process_id, running_project_id)
        running_process_id = None
        running_project_id = None
    else:
        # Even if we don't have a tracked process, ensure the port is free
        logger.info(f"No tracked server, but ensuring port {PROXY_PORT} is free")
        stop_running_server()
    
    # Check if the port is still in use after cleanup attempts
    if is_port_in_use(PROXY_PORT):
        logger.error(f"Port {PROXY_PORT} is still in use after cleanup attempts")
        return jsonify({"error": f"Port {PROXY_PORT} is still in use and could not be freed"}), 500
    
    # Construct full project path
    full_project_path = os.path.join(WORKSPACE_DIR, project_id)
    
    # Check if project directory exists
    if not os.path.exists(full_project_path):
        # Log all files in WORKSPACE_DIR for debugging
        debug_folder(full_project_path)
        return jsonify({"error": f"Project directory not found: {full_project_path}"}), 404
    
    try:
        # First, run npm install to ensure dependencies are available
        logger.info(f"Running npm install in {full_project_path}")
        npm_install_process = subprocess.run(
            ["npm", "install", "--legacy-peer-deps"],
            cwd=full_project_path,
            capture_output=True,
            text=True
        )
        
        if npm_install_process.returncode != 0:
            error_msg = npm_install_process.stderr
            logger.error(f"npm install failed: {error_msg}")
            return jsonify({"error": f"npm install failed: {error_msg}"}), 500
        
        logger.info("npm install completed successfully")
        
        # Create a temporary .env file to force Vite to use the specified port
        # This prevents Vite from automatically switching to a different port
        env_file_path = os.path.join(full_project_path, '.env.local')
        try:
            with open(env_file_path, 'w') as f:
                f.write(f"VITE_FORCE_PORT={PROXY_PORT}\n")
                f.write("VITE_DISABLE_PORT_FALLBACK=true\n")
            logger.info(f"Created temporary .env.local file to force port {PROXY_PORT}")
        except Exception as e:
            logger.warning(f"Could not create .env.local file: {str(e)}")
        
        # Create a vite.config.override.js file to force the port
        vite_config_override = os.path.join(full_project_path, 'vite.config.override.js')
        try:
            with open(vite_config_override, 'w') as f:
                f.write("""
import { defineConfig } from 'vite';

// This is an override configuration to force Vite to use a specific port
export default defineConfig({
  server: {
    port: PROXY_PORT_PLACEHOLDER,
    strictPort: true, // This forces Vite to fail if the port is not available
    host: '0.0.0.0'
  }
});
                """.replace('PROXY_PORT_PLACEHOLDER', str(PROXY_PORT)))
            logger.info(f"Created vite.config.override.js to force port {PROXY_PORT}")
        except Exception as e:
            logger.warning(f"Could not create vite.config.override.js: {str(e)}")
        
        # Ensure port is available with more aggressive cleanup just before starting
        stop_running_server()
        time.sleep(2)  # Short wait to ensure port is released
        
        # Start the development server with explicit port and host flags
        # Use --force to ensure Vite doesn't try to be "smart" about port selection
        command = [
            "npm", "run", "dev", "--", 
            "--port", str(PROXY_PORT), 
            "--host", "0.0.0.0",
            "--force",
            "--strictPort"  # This forces Vite to fail if the port is not available
        ]
        
        logger.info(f"Starting dev server with command: {' '.join(command)}")
        process = subprocess.Popen(
            command,
            cwd=full_project_path,
            preexec_fn=os.setsid,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env={**os.environ, "FORCE_COLOR": "true", "VITE_FORCE_PORT": str(PROXY_PORT)}
        )
        
        # Start a thread to monitor output
        threading.Thread(target=log_output, args=(process, project_id), daemon=True).start()
        
        # Store the running server info
        running_process_id = process.pid
        running_project_id = project_id
        
        logger.info(f"Started server for project {project_id} on port {PROXY_PORT} with PID {process.pid}")
        return jsonify({
            "status": "started", 
            "port": PROXY_PORT, 
            "pid": process.pid,
            "project_id": project_id
        }), 200
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/stop', methods=['POST'])
def stop_server():
    global running_process_id, running_project_id
    
    if not running_process_id:
        return jsonify({"status": "No server running"}), 200
    
    success = stop_running_server(running_process_id, running_project_id)
    
    if success:
        logger.info(f"Successfully stopped server for project {running_project_id}")
        running_process_id = None
        running_project_id = None
        return jsonify({"status": "stopped"}), 200
    else:
        logger.error(f"Failed to stop server for project {running_project_id}")
        return jsonify({"error": "Failed to stop server"}), 500

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "running_server": running_project_id if running_project_id else None
    }), 200

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "service": "Development Server Host",
        "version": "1.0.0",
        "endpoints": {
            "POST /start": "Start a development server",
            "POST /stop": "Stop the running server",
            "GET /health": "Health check"
        }
    }), 200

def cleanup():
    """Cleanup function to run on exit"""
    global running_process_id, running_project_id
    if running_process_id:
        stop_running_server(running_process_id, running_project_id)

if __name__ == '__main__':
    # Register cleanup function to run on exit
    atexit.register(cleanup)
    
    # Use Waitress as production WSGI server
    serve(app, host='0.0.0.0', port=CONTROL_PORT)