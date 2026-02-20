"""API endpoint tests."""
import pytest
from app import create_app
from app.config import configs

@pytest.fixture
def client():
    """Test client fixture."""
    app = create_app("testing")
    app.config['TESTING'] = True
    
    with app.test_client() as client:
        yield client

def test_root_endpoint(client):
    """Test the root endpoint."""
    response = client.get('/')
    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data['name'] == configs.PROJECT_NAME
    assert json_data['version'] == configs.VERSION

def test_health_check(client):
    """Test the health check endpoint."""
    response = client.get('/health')
    assert response.status_code == 200
    assert response.get_json()['status'] == 'healthy'

def test_hello_endpoint(client):
    """Test the hello endpoint."""
    response = client.get(f'{configs.API_V1_PREFIX}/hello')
    assert response.status_code == 200
    assert 'message' in response.get_json() 