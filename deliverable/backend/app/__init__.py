"""Main Flask application module."""
from flask import Flask, jsonify
from flask_cors import CORS
import threading
from loguru import logger

from app.config import configs
from app.api.v1 import api_v1_bp

def create_app(config_name="default"):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Configure CORS
    CORS(app, resources={r"/*": {"origins": configs.CORS_ORIGINS}})
    
    # API v1 prefix based on config or fallback
    api_v1_prefix = getattr(configs, 'API_V1_PREFIX', '/api/v1')
    
    # Register blueprints
    app.register_blueprint(api_v1_bp, url_prefix=api_v1_prefix)
    
    # Root endpoint
    @app.route('/')
    def root():
        """Root endpoint."""
        return jsonify({
            "name": getattr(configs, 'APP_NAME', 'Backend'),
            "version": getattr(configs, 'APP_VERSION', '0.1.0'),
        })
    
    # Health check endpoint
    @app.route('/health')
    def health_check():
        """Health check endpoint."""
        return jsonify({"status": "healthy"})
    
    # Initialize ChromaDB in background thread to prevent blocking app startup
    def init_chroma():
        try:
            logger.info("Pre-initializing ChromaDB... (this may take a while, maybe 1 minute)")
            # Import here to avoid circular imports
            from app.agentic.kb.vector_store import create_vector_store
            # Create a test store to initialize the embeddings model
            vector_store = create_vector_store("chroma", "init")
            vector_store.search(query="dummy", top_k=4)
            logger.info("ChromaDB initialization complete")
        except Exception as e:
            logger.error(f"Error initializing ChromaDB: {e}")
    
    init_chroma()
    
    # Create default project if no projects exist
    def create_default_project():
        try:
            # Import here to avoid circular imports
            from app.projects import get_all_projects, create_project
            
            # Check if any projects exist
            projects, status_code = get_all_projects()
            
            if status_code == 200 and (not projects or len(projects) == 0):
                logger.info("No projects found. Creating default project...")
                default_project_data = {
                    "name": "Default Project",
                    "first_message": "Welcome to the Default Project! How can I help you?"
                }
                result, status_code = create_project(default_project_data)
                if status_code == 201:
                    logger.info(f"Default project created successfully with ID: {result.get('id')}")
                else:
                    logger.error(f"Failed to create default project: {result}")
            else:
                logger.info(f"Found {len(projects)} existing projects. No default project created.")
        except Exception as e:
            logger.error(f"Error creating default project: {e}")
    
    # Initialize default project in background
    threading.Thread(target=create_default_project).start()
    
    return app 