"""Project API endpoint tests."""
import os
import json
import shutil
import pytest
import zipfile
import tempfile
from app import create_app
from app.config import configs

@pytest.fixture
def client():
    """Test client fixture."""
    # Use a temporary workspace for testing
    test_workspace = "test_workspace"
    os.environ["WORKSPACE_PATH"] = test_workspace
    
    app = create_app("testing")
    app.config['TESTING'] = True
    
    with app.test_client() as client:
        yield client
    
    # Clean up test workspace after tests
    if os.path.exists(test_workspace):
        shutil.rmtree(test_workspace)

def test_create_project(client):
    """Test creating a new project."""
    # Test project data
    project_data = {
        "name": "Test Project",
        "description": "A test project",
        "template": "default"
    }
    
    # Make request to create project
    response = client.post(
        f'{configs.API_V1_PREFIX}/projects',
        json=project_data,
        content_type='application/json'
    )
    
    # Check response
    assert response.status_code == 201
    data = json.loads(response.data)
    
    assert data["name"] == project_data["name"]
    assert data["description"] == project_data["description"]
    assert data["template"] == project_data["template"]
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert "path" in data
    
    # Check that project directory was created
    project_dir = os.path.join(os.environ["WORKSPACE_PATH"], data["id"])
    assert os.path.exists(project_dir)
    assert os.path.exists(os.path.join(project_dir, "src"))
    assert os.path.exists(os.path.join(project_dir, "docs"))
    assert os.path.exists(os.path.join(project_dir, "README.md"))

def test_create_project_missing_name(client):
    """Test creating a project without a name."""
    # Test project data with missing name
    project_data = {
        "description": "A test project",
        "template": "default"
    }
    
    # Make request to create project
    response = client.post(
        f'{configs.API_V1_PREFIX}/projects',
        json=project_data,
        content_type='application/json'
    )
    
    # Check response
    assert response.status_code == 400
    data = json.loads(response.data)
    assert "errors" in data
    assert any("name" in error.lower() for error in data["errors"])

def test_list_projects(client):
    """Test listing projects."""
    # Create a few test projects
    for i in range(3):
        project_data = {
            "name": f"Test Project {i}",
            "description": f"Description for project {i}",
            "template": "default"
        }
        client.post(
            f'{configs.API_V1_PREFIX}/projects',
            json=project_data,
            content_type='application/json'
        )
    
    # Get list of projects
    response = client.get(f'{configs.API_V1_PREFIX}/projects')
    
    # Check response
    assert response.status_code == 200
    data = json.loads(response.data)
    
    # Verify we got all projects
    assert len(data) == 3
    
    # Verify project structure
    for project in data:
        assert "id" in project
        assert "name" in project
        assert "description" in project
        assert "template" in project
        assert "created_at" in project
        assert "updated_at" in project
        assert "path" in project

def test_delete_project(client):
    """Test deleting a project."""
    # Create a test project
    project_data = {
        "name": "Project to Delete",
        "description": "This project will be deleted",
        "template": "default"
    }
    
    # Create project
    response = client.post(
        f'{configs.API_V1_PREFIX}/projects',
        json=project_data,
        content_type='application/json'
    )
    
    assert response.status_code == 201
    project = json.loads(response.data)
    project_id = project["id"]
    project_path = project["path"]
    
    # Verify project exists
    assert os.path.exists(project_path)
    
    # Delete the project
    response = client.delete(f'{configs.API_V1_PREFIX}/projects/{project_id}')
    
    # Check response
    assert response.status_code == 200
    data = json.loads(response.data)
    assert "message" in data
    assert project_id in data["message"]
    
    # Verify project directory was deleted
    assert not os.path.exists(project_path)
    
    # Verify project was removed from projects list
    response = client.get(f'{configs.API_V1_PREFIX}/projects')
    projects = json.loads(response.data)
    
    # Make sure the deleted project is not in the list
    for p in projects:
        assert p["id"] != project_id

def test_delete_nonexistent_project(client):
    """Test deleting a project that doesn't exist."""
    nonexistent_id = "12345678-9abc-def0-1234-56789abcdef0"
    
    # Try to delete a non-existent project
    response = client.delete(f'{configs.API_V1_PREFIX}/projects/{nonexistent_id}')
    
    # Check response
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "error" in data
    assert "not found" in data["error"].lower()

def test_download_project(client):
    """Test downloading a project as a zip file."""
    # Create a test project
    project_data = {
        "name": "Project to Download",
        "description": "This project will be downloaded",
        "template": "default"
    }
    
    # Create project
    response = client.post(
        f'{configs.API_V1_PREFIX}/projects',
        json=project_data,
        content_type='application/json'
    )
    
    assert response.status_code == 201
    project = json.loads(response.data)
    project_id = project["id"]
    project_path = project["path"]
    
    # Create some additional files in the project
    test_file_content = "This is a test file"
    with open(os.path.join(project_path, "test.txt"), 'w') as f:
        f.write(test_file_content)
        
    # Create a file that should be excluded
    with open(os.path.join(project_path, ".env"), 'w') as f:
        f.write("SECRET_KEY=test")
    
    # Download the project
    response = client.get(f'{configs.API_V1_PREFIX}/projects/{project_id}/download')
    
    # Check response
    assert response.status_code == 200
    assert response.headers['Content-Type'] == 'application/zip'
    assert response.headers['Content-Disposition'].startswith('attachment; filename=')
    assert f'project-{project_id}.zip' in response.headers['Content-Disposition']
    
    # Save the zip file to a temporary location
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, f'project-{project_id}.zip')
    
    with open(zip_path, 'wb') as f:
        f.write(response.data)
    
    # Verify the zip file contains the expected files
    with zipfile.ZipFile(zip_path, 'r') as zipf:
        # List all files in the zip
        file_list = zipf.namelist()
        
        # Check for expected files
        assert 'test.txt' in file_list
        assert 'README.md' in file_list
        
        # Check for excluded files
        assert '.env' not in file_list
        
        # Verify file content
        with zipf.open('test.txt') as f:
            content = f.read().decode('utf-8')
            assert content == test_file_content
    
    # Clean up
    shutil.rmtree(temp_dir)

def test_download_nonexistent_project(client):
    """Test downloading a project that doesn't exist."""
    nonexistent_id = "12345678-9abc-def0-1234-56789abcdef0"
    
    # Try to download a non-existent project
    response = client.get(f'{configs.API_V1_PREFIX}/projects/{nonexistent_id}/download')
    
    # Check response
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "error" in data
    assert "not found" in data["error"].lower() 