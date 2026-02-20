"""V1 API package."""

from flask import Blueprint

api_v1_bp = Blueprint('api_v1', __name__)
 
# Import routes after the blueprint is created to avoid circular imports
from app.api.v1 import routes 