"""WSGI entry point for the application."""
from app import create_app
from app.config import configs

app = create_app()
 
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001, debug=True) 