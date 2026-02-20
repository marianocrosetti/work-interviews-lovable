import os
import signal
import subprocess
import json
import time
import psutil
import logging
import threading
import socket
import platform
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Store active dev servers
active_servers = {}
# Lock for thread-safe operations
server_lock = threading.Lock()
# Default proxy port
PROXY_PORT = int(os.environ.get('PROXY_PORT', 3035))

def debug_folder(folder_path):
    """Debug folder contents for troubleshooting"""
    logger.error(f"Path not found: {folder_path}")
    logger.error(f"Base directory is: {os.path.dirname(folder_path)}")
    logger.error("Contents of base directory:")
    
    base_dir = os.path.dirname(folder_path)
    if os.path.exists(base_dir):
        contents = list_directory_contents(base_dir)
        for item in contents:
            logger.error(f"  {item}")
    else:
        logger.error(f"Base directory {base_dir} does not exist!")
        
    # Also log contents of parent directory for debugging
    parent_dir = os.path.dirname(base_dir)
    if os.path.exists(parent_dir):
        logger.error(f"Contents of parent directory {parent_dir}:")
        parent_contents = os.listdir(parent_dir)
        for item in parent_contents:
            logger.error(f"  {item}")

def list_directory_contents(directory):
    """List all contents of a directory recursively"""
    result = []
    try:
        for root, dirs, files in os.walk(directory):
            for file in files:
                result.append(os.path.join(root, file))
            for dir in dirs:
                result.append(os.path.join(root, dir) + '/')
    except Exception as e:
        logger.error(f"Error listing directory contents: {str(e)}")
    return result

def run_dev_server(project_id, workspace_dir):
    """Run npm install and npm run dev for a project"""
    project_path = os.path.join(workspace_dir, project_id)
    
    if not os.path.exists(project_path):
        logger.error(f"Project path does not exist: {project_path}")
        return False, "Project directory not found"
    
    # Change to project directory
    os.chdir(project_path)
    
    # Run npm install
    logger.info(f"Running npm install for project {project_id}")
    try:
        subprocess.run(["npm", "install"], check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"npm install failed: {e.stderr.decode()}")
        return False, f"npm install failed: {e.stderr.decode()}"
    
    # Run npm run dev
    logger.info(f"Starting dev server for project {project_id}")
    try:
        # Start the dev server process, ensuring it uses the host 0.0.0.0
        # This makes it accessible from outside the container
        env = os.environ.copy()
        env["HOST"] = "0.0.0.0"
        
        process = subprocess.Popen(
            ["npm", "run", "dev"], 
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Store process info
        active_servers[project_id] = {
            'process': process,
            'pid': process.pid,
            'start_time': time.time(),
            'status': 'starting'
        }
        
        # Start a thread to monitor the output
        threading.Thread(target=monitor_output, args=(project_id, process), daemon=True).start()
        
        return True, "Dev server starting"
    except Exception as e:
        logger.error(f"Failed to start dev server: {str(e)}")
        return False, f"Failed to start dev server: {str(e)}"

def monitor_output(project_id, process):
    """Monitor the output of the dev server process"""
    for line in iter(process.stdout.readline, ''):
        logger.info(f"[{project_id}] {line.strip()}")
        
        # Look for a message indicating the server is ready
        if "server started" in line.lower() or "listening on" in line.lower() or "ready in" in line.lower():
            active_servers[project_id]['status'] = 'running'
            logger.info(f"Dev server for project {project_id} is now running")
    
    # Process has ended
    if project_id in active_servers:
        active_servers[project_id]['status'] = 'stopped'
        logger.info(f"Dev server for project {project_id} has stopped")

def log_output(process, project_id):
    """Log the output and error streams from a process"""
    for line in iter(process.stdout.readline, ''):
        logger.info(f"[{project_id}] {line.strip()}")
    for line in iter(process.stderr.readline, ''):
        logger.error(f"[{project_id}] {line.strip()}")

def find_process_using_port(port):
    """Find process using a specific port"""
    try:
        # First try using psutil which is more comprehensive
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                connections = proc.connections(kind='inet')
                for conn in connections:
                    if conn.laddr.port == port:
                        return proc
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                pass
                
        # If psutil didn't find it, try platform-specific commands
        if platform.system() == "Linux":
            cmd = f"lsof -i :{port} -t"
            result = subprocess.run(cmd, shell=True, text=True, capture_output=True)
            if result.stdout.strip():
                pid = int(result.stdout.strip())
                return psutil.Process(pid)
                
        elif platform.system() == "Darwin":  # macOS
            cmd = f"lsof -i :{port} -t"
            result = subprocess.run(cmd, shell=True, text=True, capture_output=True)
            if result.stdout.strip():
                # Could be multiple PIDs
                pids = [int(pid) for pid in result.stdout.strip().split('\n') if pid.strip()]
                if pids:
                    return psutil.Process(pids[0])
    except Exception as e:
        logger.error(f"Error finding process using port {port}: {str(e)}")
    
    return None

def is_port_in_use(port):
    """Check if a port is in use more thoroughly"""
    # Try multiple methods to check if the port is in use
    
    # Method 1: Using socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex(('127.0.0.1', port))
            if result == 0:
                logger.info(f"Port {port} is in use (socket check)")
                return True
    except Exception as e:
        logger.error(f"Socket check error: {str(e)}")
    
    # Method 2: Try to bind to the port (most reliable)
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(('0.0.0.0', port))
            logger.info(f"Port {port} is free (bind check)")
            return False
    except Exception:
        logger.info(f"Port {port} is in use (bind check)")
        return True
    
    # Method 3: Using platform-specific commands
    try:
        if platform.system() == "Linux" or platform.system() == "Darwin":
            result = subprocess.run(f"lsof -i :{port}", shell=True, capture_output=True)
            if result.stdout:
                logger.info(f"Port {port} is in use (lsof check)")
                return True
    except Exception as e:
        logger.error(f"Command check error: {str(e)}")
    
    # If we get here and haven't returned True, the port is probably free
    return False

def reset_network_socket(port):
    """Force reset the network socket for a port"""
    try:
        # Create a socket and set the SO_REUSEADDR option
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            # On some systems, we can also set SO_REUSEPORT
            if hasattr(socket, 'SO_REUSEPORT'):
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
                
            # Try to bind to the port
            try:
                s.bind(('0.0.0.0', port))
                s.listen(1)
                logger.info(f"Successfully bound to port {port} for reset")
                
                # Create a quick connection and close it
                try:
                    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
                        client.settimeout(0.1)
                        client.connect(('127.0.0.1', port))
                except:
                    pass
                    
                # Close the listening socket
                s.close()
                return True
            except Exception as e:
                logger.error(f"Failed to bind during network reset: {str(e)}")
                return False
    except Exception as e:
        logger.error(f"Error resetting network socket: {str(e)}")
        return False

def kill_process_using_port(port):
    """Find and kill process using a specific port"""
    process = find_process_using_port(port)
    if process:
        try:
            logger.info(f"Found process {process.pid} ({process.name()}) using port {port}")
            
            # Try SIGTERM first
            logger.info(f"Sending SIGTERM to process {process.pid}")
            process.terminate()
            
            # Wait a moment to see if it exits gracefully
            gone, alive = psutil.wait_procs([process], timeout=2)
            
            # If still alive, use SIGKILL
            if process in alive:
                logger.info(f"Process {process.pid} did not terminate, sending SIGKILL")
                process.kill()
                
            return True
        except Exception as e:
            logger.error(f"Error killing process {process.pid}: {str(e)}")
    
    return False

def force_kill_processes_by_command_pattern(pattern):
    """Kill all processes that match a command pattern"""
    killed = False
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = ' '.join(proc.cmdline())
                if pattern in cmdline:
                    logger.info(f"Found matching process: {proc.pid} {cmdline}")
                    proc.kill()
                    killed = True
            except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess):
                pass
    except Exception as e:
        logger.error(f"Error in force_kill_processes_by_command_pattern: {str(e)}")
    
    return killed

def stop_running_server(process_id=None, project_id=None):
    """Stop the currently running server if any"""
    success = True
    
    logger.info("====== STARTING SERVER CLEANUP ======")
    
    # Try to kill the process by the provided process_id
    if process_id:
        try:
            logger.info(f"Stopping running server for project {project_id}")
            os.killpg(os.getpgid(process_id), signal.SIGTERM)
            
            # Wait a moment for process to terminate
            time.sleep(1)
            
            # Check if process still exists and force kill if necessary
            try:
                os.kill(process_id, 0)  # This will raise an error if process doesn't exist
                logger.info(f"Process {process_id} still exists, sending SIGKILL")
                os.killpg(os.getpgid(process_id), signal.SIGKILL)
            except OSError:
                logger.info(f"Process {process_id} terminated successfully")
                
        except Exception as e:
            logger.error(f"Error stopping server by process ID: {str(e)}")
            success = False
    
    # Kill any processes using the proxy port (3035 by default)
    logger.info(f"Checking for processes using port {PROXY_PORT}")
    retries = 0
    max_retries = 5  # Increased from 3 to 5
    
    while is_port_in_use(PROXY_PORT) and retries < max_retries:
        logger.info(f"Port {PROXY_PORT} is in use (attempt {retries+1}/{max_retries}), attempting cleanup")
        
        # First try to kill by port
        if kill_process_using_port(PROXY_PORT):
            logger.info(f"Killed process using port {PROXY_PORT}")
        
        # Also try to kill any Vite processes which might be binding to the port
        if force_kill_processes_by_command_pattern("vite --port"):
            logger.info("Killed Vite processes")
        
        # Try to reset the network socket
        reset_network_socket(PROXY_PORT)
        
        # Wait for the port to be released
        for i in range(5):
            if not is_port_in_use(PROXY_PORT):
                logger.info(f"Port {PROXY_PORT} is now free (after {i+1} seconds)")
                break
            logger.info(f"Waiting for port {PROXY_PORT} to be released... ({i+1}/5 seconds)")
            time.sleep(1)
            
        retries += 1
        
        if is_port_in_use(PROXY_PORT):
            logger.warning(f"Port {PROXY_PORT} still in use after cleanup attempt, trying more aggressive methods...")
            
            # On Linux/Mac, try using lsof and kill
            if platform.system() in ["Linux", "Darwin"]:
                try:
                    # Force kill with OS-specific commands
                    cmd = f"lsof -i :{PROXY_PORT} -t | xargs kill -9"
                    subprocess.run(cmd, shell=True, stderr=subprocess.PIPE)
                    logger.info(f"Executed force kill command: {cmd}")
                except Exception as e:
                    logger.error(f"Error executing force kill command: {str(e)}")
            
            # Wait before next retry
            time.sleep(2)
    
    if is_port_in_use(PROXY_PORT):
        logger.error(f"CRITICAL: Port {PROXY_PORT} is still in use after {max_retries} attempts")
        logger.error("This will cause Vite to use a different port")
        success = False
    else:
        logger.info(f"Port {PROXY_PORT} is now free and available")
    
    # Add a reasonable wait time to ensure port is released
    logger.info("Waiting for 5 seconds to ensure resources are freed...")
    time.sleep(1)
    
    logger.info("====== SERVER CLEANUP COMPLETE ======")
    
    return success

def cleanup():
    """Clean up active servers on shutdown"""
    # This function will be called from app.py with the app's globals

def load_server_state():
    """Load the saved server state or return empty dict if no state found"""
    try:
        with open('server_state.json', 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {} 