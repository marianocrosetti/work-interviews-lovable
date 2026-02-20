"""Project management module.

This module contains common functionality for project management
that can be shared across different API versions.
"""

import os
import json
import shutil
import uuid
import subprocess
import logging
import tempfile
import zipfile
from typing import Tuple, Dict, Any, Optional, List
from datetime import datetime
from pathlib import Path
from app.config import configs
import requests

# Import AI generation utilities
try:
    from app.ai_generations import generate_project_summary_sync
except ImportError:
    # Fallback if module is not available
    generate_project_summary_sync = None

# Set up logger
logger = logging.getLogger(__name__)

def validate_project_data(data):
    """Validate project creation data.
    
    Args:
        data: The project data to validate
        
    Returns:
        List of validation errors or empty list if valid
    """
    errors = []
    
    # Check for required fields
    if not data:
        return ["No data provided"]
    
    if not data.get("name"):
        errors.append("Project name is required")
    elif len(data.get("name")) < 3:
        errors.append("Project name must be at least 3 characters long")
    
    return errors

def create_project_directory(project_id):
    """Create a new project directory by copying files from user-app-template.
    
    Args:
        project_id: The unique ID of the project
        
    Returns:
        The path to the created project directory
    """
    # Ensure projects parent directory exists
    projects_dir = configs.WORKSPACE_PATH
    if not os.path.exists(projects_dir):
        os.makedirs(projects_dir)
    
    # Full path to the project directory
    project_path = os.path.join(projects_dir, project_id)
    
    # Remove project directory if it exists
    if os.path.exists(project_path):
        shutil.rmtree(project_path)
    
    # Ensure project directory exists
    os.makedirs(project_path, exist_ok=True)
    
    try:
        # Path to template directory - try multiple locations to handle both local and Docker environments
        template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "user-app-template")
        
        # Alternative paths if the above doesn't exist (for Docker environment)
        if not os.path.exists(template_dir):
            # Try absolute path in Docker environment
            template_dir = "/app/user-app-template"
            
            # If still doesn't exist, try one level up from current directory
            if not os.path.exists(template_dir):
                template_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "user-app-template")
        
        if not os.path.exists(template_dir):
            logger.error(f"Template directory not found in any location. Attempted paths: {template_dir}")
            raise FileNotFoundError(f"Template directory not found: {template_dir}")
        
        logger.info(f"Copying template from {template_dir} to {project_path}")
        
        # Copy template to project directory
        for item in os.listdir(template_dir):
            src_path = os.path.join(template_dir, item)
            dst_path = os.path.join(project_path, item)
            
            if os.path.isdir(src_path):
                shutil.copytree(src_path, dst_path)
            else:
                shutil.copy2(src_path, dst_path)
        
        # Initialize git repository
        logger.info(f"Initializing git repository in {project_path}")
        subprocess.run(
            ["git", "init"],
            cwd=project_path,
            capture_output=True,
            text=True,
            check=True
        )
        
        # Add all files
        subprocess.run(
            ["git", "add", "."],
            cwd=project_path,
            capture_output=True,
            text=True,
            check=True
        )
        
        # Configure git user
        subprocess.run(
            ["git", "config", "user.name", "Initial commit"],
            cwd=project_path,
            capture_output=True,
            text=True,
            check=True
        )
        
        subprocess.run(
            ["git", "config", "user.email", "system@example.com"],
            cwd=project_path,
            capture_output=True,
            text=True,
            check=True
        )
        
        # Make initial commit
        subprocess.run(
            ["git", "commit", "-m", "Initial project creation"],
            cwd=project_path,
            capture_output=True,
            text=True,
            check=True
        )
            
        return project_path
    except Exception as e:
        logger.error(f"Error during project creation: {str(e)}")
        # If any errors occur, create a basic structure instead
        return _create_basic_project_structure(project_id, project_path)

def _create_basic_project_structure(project_id, project_path):
    """Create a basic project structure as fallback.
    
    Args:
        project_id: The unique ID of the project
        project_path: Path to the project directory
        
    Returns:
        The path to the created project directory
    """
    # Create basic project structure
    os.makedirs(os.path.join(project_path, "src"), exist_ok=True)
    os.makedirs(os.path.join(project_path, "docs"), exist_ok=True)
    
    # Create a basic README.md file
    with open(os.path.join(project_path, "README.md"), 'w') as f:
        f.write(f"# Project {project_id}\n\nThis project was created using the Backend API.\n")
    
    return project_path

def create_project(data):
    """Create a new project with the given data.
    
    Args:
        data: Project data including name and first_message
        
    Returns:
        tuple: (project_metadata, status_code)
    """
    try:
        # Validate project data
        errors = validate_project_data(data)
        if errors:
            return {"errors": errors}, 400
        
        # Generate a unique project ID
        project_id = str(uuid.uuid4())
        logger.info(f"Creating new project with ID: {project_id}")
        
        # Create project directory
        project_path = create_project_directory(project_id)
        
        # Get first message
        first_message = data.get("first_message", "")
        
        # Generate project summary based on first message
        ai_title = None
        ai_description = None
        
        if first_message and generate_project_summary_sync:
            try:
                logger.info(f"Generating project summary for project {project_id} based on first message")
                summary = generate_project_summary_sync(first_message)
                ai_title = summary.title
                ai_description = summary.description
                logger.info(f"Generated summary for project {project_id}: title='{ai_title}', description='{ai_description}'")
                
                # Update index.html title if available
                index_path = os.path.join(project_path, "index.html")
                if os.path.exists(index_path) and ai_title:
                    try:
                        with open(index_path, 'r') as f:
                            content = f.read()
                            
                        # Replace title if found
                        import re
                        new_content = re.sub(
                            r'<title>([^<]+)</title>',
                            f'<title>{ai_title} - Project {project_id}</title>',
                            content
                        )
                        
                        with open(index_path, 'w') as f:
                            f.write(new_content)
                            
                        logger.info(f"Updated HTML title for project {project_id}")
                    except Exception as e:
                        logger.warning(f"Could not update HTML title for project {project_id}: {str(e)}")
            except Exception as e:
                logger.error(f"Error generating project summary: {str(e)}")
        
        # Create project metadata
        project = {
            "id": project_id,
            "name": data.get("name"),
            "first_message": first_message,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "path": project_path,
            "ai_title": ai_title,
            "ai_description": ai_description
        }
        
        # Save project metadata
        save_project_metadata(project)

        # Automatically start devhost for this project
        try:
            devhost_url = "http://devhost:5000/start"
            # Increase timeout to 60 seconds to accommodate npm install
            response = requests.post(
                devhost_url,
                json={"project_id": project_id},
                timeout=60
            )
            if response.status_code != 200:
                logger.warning(f"Devhost /start returned status {response.status_code}: {response.text}")
            else:
                logger.info(f"Devhost started for project {project_id}")
        except Exception as e:
            logger.warning(f"Could not start devhost for project {project_id}: {str(e)}")

        return project, 201
        
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        return {"error": "Failed to create project", "details": str(e)}, 500

def get_all_projects():
    """Get a list of all projects.
    
    Returns:
        tuple: (projects_list, status_code)
    """
    try:
        projects_file = os.path.join(configs.WORKSPACE_PATH, "projects.json")
        
        if not os.path.exists(projects_file):
            return [], 200
            
        with open(projects_file, 'r') as f:
            try:
                projects = json.load(f)
            except json.JSONDecodeError:
                projects = []
                
        return projects, 200
        
    except Exception as e:
        logger.error(f"Error listing projects: {str(e)}")
        return {"error": "Failed to list projects", "details": str(e)}, 500

def get_project_by_id(project_id):
    """Get a project by its ID.
    
    Args:
        project_id: The unique ID of the project
        
    Returns:
        The project metadata or None if not found
    """
    projects_file = os.path.join(configs.WORKSPACE_PATH, "projects.json")
    
    if not os.path.exists(projects_file):
        return None
        
    with open(projects_file, 'r') as f:
        try:
            projects = json.load(f)
        except json.JSONDecodeError:
            projects = []
    
    for project in projects:
        if project.get("id") == project_id:
            return project
            
    return None

def delete_project(project_id):
    """Delete a project by its ID.
    
    Args:
        project_id: The unique ID of the project to delete
        
    Returns:
        tuple: (response_data, status_code)
    """
    try:
        # Get the projects list
        projects_file = os.path.join(configs.WORKSPACE_PATH, "projects.json")
        
        if not os.path.exists(projects_file):
            return {"error": "Project not found"}, 404
            
        # Load projects
        with open(projects_file, 'r') as f:
            try:
                projects = json.load(f)
            except json.JSONDecodeError:
                projects = []
        
        # Find the project
        project = None
        for p in projects:
            if p.get("id") == project_id:
                project = p
                break
                
        if not project:
            return {"error": "Project not found"}, 404
            
        # Delete the project directory
        project_path = project.get("path")
        if project_path and os.path.exists(project_path):
            shutil.rmtree(project_path)
            
        # Remove project from projects list
        projects = [p for p in projects if p.get("id") != project_id]
        
        # Save updated projects list
        with open(projects_file, 'w') as f:
            json.dump(projects, f, indent=2)
            
        return {"message": f"Project {project_id} deleted successfully"}, 200
        
    except Exception as e:
        logger.error(f"Error deleting project: {str(e)}")
        return {"error": "Failed to delete project", "details": str(e)}, 500

def create_project_zip(project_id: str) -> Tuple[str, str]:
    """Create a zip file containing the project files.
    
    This function creates a zip archive of a project, excluding common
    build artifacts, temporary files, and respecting any .gitignore patterns
    in the project.
    
    Args:
        project_id: The unique ID of the project
        
    Returns:
        Tuple of (zip_file_path, zip_filename)
        
    Raises:
        FileNotFoundError: If the project directory doesn't exist
        Exception: For any other errors during zip creation
    """
    # Get project metadata
    project = get_project_by_id(project_id)
    if not project:
        raise FileNotFoundError(f"Project {project_id} not found")
    
    # Get project path
    project_path = project.get("path")
    if not project_path or not os.path.exists(project_path):
        raise FileNotFoundError(f"Project directory for {project_id} not found")
    
    # Create temporary directory for the zip file
    temp_dir = tempfile.mkdtemp()
    zip_filename = f"project-{project_id}.zip"
    zip_path = os.path.join(temp_dir, zip_filename)
    
    try:
        # Files and directories to exclude from the zip
        exclude_patterns = [
            "__pycache__",
            "*.pyc",
            "*.pyo",
            ".git",
            ".DS_Store",
            "node_modules",
            "venv",
            "env",
            ".env",
            "dist",
            "build",
            "*.log"
        ]
        
        # Load .gitignore patterns if available
        gitignore_path = os.path.join(project_path, ".gitignore")
        if os.path.exists(gitignore_path):
            with open(gitignore_path, 'r') as f:
                gitignore_patterns = [line.strip() for line in f.readlines() 
                                     if line.strip() and not line.startswith('#')]
                exclude_patterns.extend(gitignore_patterns)
        
        # Create the zip file
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(project_path):
                # Skip excluded directories
                dirs[:] = [d for d in dirs if not _should_exclude(d, exclude_patterns)]
                
                # Process files
                for file in files:
                    # Skip excluded files
                    if _should_exclude(file, exclude_patterns):
                        continue
                    
                    # Get the full file path
                    file_path = os.path.join(root, file)
                    
                    # Calculate the relative path within the zip
                    rel_path = os.path.relpath(file_path, project_path)
                    
                    # Add the file to the zip
                    zipf.write(file_path, rel_path)
        
        logger.info(f"Created zip archive for project {project_id} at {zip_path}")
        return zip_path, zip_filename
    
    except Exception as e:
        # Clean up the temporary directory if there's an error
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        
        logger.error(f"Error creating zip archive for project {project_id}: {str(e)}")
        raise

def _should_exclude(path, patterns):
    """Check if a path should be excluded based on patterns.
    
    Args:
        path: The path to check
        patterns: List of exclusion patterns
        
    Returns:
        True if the path should be excluded, False otherwise
    """
    # Simple pattern matching that supports basic glob patterns
    for pattern in patterns:
        # Exact match
        if pattern == path:
            return True
        
        # Glob wildcard
        if '*' in pattern:
            # Convert the glob pattern to a simple regex
            import re
            regex_pattern = pattern.replace('.', '\\.').replace('*', '.*')
            if re.match(f"^{regex_pattern}$", path):
                return True
    
    return False

def cleanup_zip_file(zip_path):
    """Clean up a temporary zip file.
    
    Args:
        zip_path: Path to the zip file to delete
    """
    try:
        if os.path.exists(zip_path):
            os.remove(zip_path)
            
            # Also try to remove the parent directory if it's a temp dir
            parent_dir = os.path.dirname(zip_path)
            if os.path.exists(parent_dir) and tempfile.gettempdir() in parent_dir:
                shutil.rmtree(parent_dir)
                
            logger.debug(f"Cleaned up temporary zip file: {zip_path}")
    except Exception as e:
        logger.error(f"Error cleaning up temporary zip file {zip_path}: {str(e)}")

def save_project_metadata(project):
    """Save project metadata to the projects.json file.
    
    Args:
        project: Project metadata to save
    """
    projects_file = os.path.join(configs.WORKSPACE_PATH, "projects.json")
    
    # Create projects.json if it doesn't exist
    if not os.path.exists(configs.WORKSPACE_PATH):
        os.makedirs(configs.WORKSPACE_PATH)
        
    projects = []
    if os.path.exists(projects_file):
        with open(projects_file, 'r') as f:
            try:
                projects = json.load(f)
            except json.JSONDecodeError:
                projects = []
    
    projects.append(project)
    
    with open(projects_file, 'w') as f:
        json.dump(projects, f, indent=2)

def clone_template(project_dir, template="default"):
    """Clone a template into the project directory.
    
    Args:
        project_dir: The project directory path
        template: The template to clone (default, react, vue)
    """
    # Path to templates directory
    templates_dir = os.path.join(configs.WORKSPACE_PATH, "templates")
    
    # Template path
    template_path = os.path.join(templates_dir, template)
    
    # Check if template exists
    if not os.path.exists(template_path):
        # If the template doesn't exist, use default
        template_path = os.path.join(templates_dir, "default")
        
        # If default doesn't exist either, create it
        if not os.path.exists(template_path):
            os.makedirs(templates_dir, exist_ok=True)
            os.makedirs(template_path, exist_ok=True)
            with open(os.path.join(template_path, "README.md"), 'w') as f:
                f.write("# Default Template\n\nThis is the default project template.\n")
    
    # Copy template contents to project directory
    for item in os.listdir(template_path):
        src_path = os.path.join(template_path, item)
        dst_path = os.path.join(project_dir, item)
        
        if os.path.isdir(src_path):
            shutil.copytree(src_path, dst_path, dirs_exist_ok=True)
        else:
            shutil.copy2(src_path, dst_path)

def get_project_commit_history(project_id: str) -> Tuple[List[Dict[str, str]], int]:
    """Get the commit history of a project repository.
    
    Args:
        project_id: The unique ID of the project
        
    Returns:
        tuple: (list of commits, status_code)
        
    Each commit in the list is a dictionary with:
        - hash: The commit hash
        - title: The commit title/message
        - author: The commit author
        - date: The commit date
    """
    try:
        # Get project metadata
        project = get_project_by_id(project_id)
        if not project:
            logger.warning(f"Project {project_id} not found")
            return {"error": "Project not found"}, 404
            
        # Get project path
        project_path = project.get("path")
        if not project_path or not os.path.exists(project_path):
            logger.warning(f"Project directory for {project_id} not found")
            return {"error": "Project directory not found"}, 404
            
        # Check if project has a git repository
        git_dir = os.path.join(project_path, ".git")
        if not os.path.exists(git_dir):
            # Initialize git repository if it doesn't exist
            try:
                logger.info(f"Initializing git repository for project {project_id}")
                subprocess.run(
                    ["git", "init"],
                    cwd=project_path,
                    check=True,
                    capture_output=True
                )
                
                # Add all files and make initial commit
                subprocess.run(
                    ["git", "add", "."],
                    cwd=project_path,
                    check=True,
                    capture_output=True
                )
                
                subprocess.run(
                    ["git", "config", "user.name", "Initial commit (template)"],
                    cwd=project_path,
                    check=True,
                    capture_output=True
                )
                
                subprocess.run(
                    ["git", "config", "user.email", "system@example.com"],
                    cwd=project_path,
                    check=True,
                    capture_output=True
                )
                
                subprocess.run(
                    ["git", "commit", "-m", "Initial project creation"],
                    cwd=project_path,
                    check=True,
                    capture_output=True
                )
                
                logger.info(f"Created initial commit for project {project_id}")
            except subprocess.CalledProcessError as e:
                logger.error(f"Error initializing git repository: {e.stderr.decode()}")
                return {"error": "Failed to initialize git repository", "details": e.stderr.decode()}, 500
        
        # Get commit history
        try:
            result = subprocess.run(
                ["git", "log", "--pretty=format:%H|%s|%an|%ad", "--date=iso"],
                cwd=project_path,
                check=True,
                capture_output=True,
                text=True
            )
            
            # Parse the output
            commits = []
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                    
                parts = line.split('|')
                if len(parts) >= 4:
                    commit = {
                        "hash": parts[0],
                        "title": parts[1],
                        "author": parts[2],
                        "date": parts[3]
                    }
                    commits.append(commit)
            
            if not commits:
                logger.info(f"No commit history found for project {project_id}")
                return [], 200
                
            logger.info(f"Retrieved {len(commits)} commits for project {project_id}")
            return commits, 200
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Error retrieving commit history: {e.stderr.decode()}")
            return {"error": "Failed to retrieve commit history", "details": e.stderr.decode()}, 500
            
    except Exception as e:
        logger.error(f"Error getting project commit history: {str(e)}")
        return {"error": "Failed to get project commit history", "details": str(e)}, 500

def switch_project_commit(project_id: str, commit_hash: str) -> Tuple[Dict[str, Any], int]:
    """Switch a project repository to a specific commit.
    
    Args:
        project_id: The unique ID of the project
        commit_hash: The commit hash to switch to
        
    Returns:
        tuple: (response_data, status_code)
    """
    try:
        # Get project metadata
        project = get_project_by_id(project_id)
        if not project:
            logger.warning(f"Project {project_id} not found")
            return {"error": "Project not found"}, 404
            
        # Get project path
        project_path = project.get("path")
        if not project_path or not os.path.exists(project_path):
            logger.warning(f"Project directory for {project_id} not found")
            return {"error": "Project directory not found"}, 404
            
        # Check if project has a git repository
        git_dir = os.path.join(project_path, ".git")
        if not os.path.exists(git_dir):
            logger.warning(f"Project {project_id} does not have a git repository")
            return {"error": "Project does not have a git repository"}, 400
        
        # Validate commit hash exists
        try:
            # Check if commit hash exists in repository
            result = subprocess.run(
                ["git", "cat-file", "-t", commit_hash],
                cwd=project_path,
                check=True,
                capture_output=True,
                text=True
            )
            
            # If the output is not "commit", it's not a valid commit hash
            if result.stdout.strip() != "commit":
                logger.warning(f"Invalid commit hash {commit_hash} for project {project_id}")
                return {"error": "Invalid commit hash"}, 400
                
        except subprocess.CalledProcessError as e:
            logger.error(f"Error validating commit hash: {e.stderr}")
            return {"error": "Invalid commit hash", "details": e.stderr}, 400
        
        # Perform git reset --hard to the specified commit
        try:
            logger.info(f"Switching project {project_id} to commit {commit_hash}")
            
            # First, make sure we don't have any conflicts
            subprocess.run(
                ["git", "reset", "--hard"],
                cwd=project_path,
                check=True,
                capture_output=True
            )
            
            # Now checkout the specific commit
            result = subprocess.run(
                ["git", "checkout", commit_hash],
                cwd=project_path,
                check=True,
                capture_output=True,
                text=True
            )
            
            logger.info(f"Successfully switched project {project_id} to commit {commit_hash}")
            return {
                "success": True, 
                "message": f"Successfully switched to commit {commit_hash}", 
                "commit_hash": commit_hash
            }, 200
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Error switching to commit: {e.stderr}")
            return {"error": "Failed to switch to commit", "details": e.stderr}, 500
            
    except Exception as e:
        logger.error(f"Error switching project commit: {str(e)}")
        return {"error": "Failed to switch project commit", "details": str(e)}, 500 

def get_project_files(project_id: str) -> Tuple[List[Dict[str, Any]], int]:
    """Get a list of all files in a project.
    
    Args:
        project_id: The unique ID of the project
        
    Returns:
        tuple: (list of file objects, status_code)
    """
    try:
        # Get project info
        project = get_project_by_id(project_id)
        if not project:
            return {"error": f"Project {project_id} not found"}, 404
            
        # Get project path
        project_path = project.get("path")
        if not project_path or not os.path.exists(project_path):
            return {"error": f"Project directory for {project_id} not found"}, 404
        
        # Directories that should be skipped
        skipped_dirs = [
            "node_modules",
            "__pycache__",
            ".mypy_cache",
            ".pytest_cache",
            ".git",
            ".next",
            "dist",
            "build",
            ".venv",
            "venv",
            ".env",
            ".lovable",
        ]
        
        files = []
        # Walk through the project directory
        for root, dirs, filenames in os.walk(project_path):
            # Skip hidden directories and directories in the skip list
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in skipped_dirs]
            
            for filename in filenames:
                # Skip hidden files
                if filename.startswith('.'):
                    continue
                    
                full_path = os.path.join(root, filename)
                rel_path = os.path.relpath(full_path, project_path)
                
                # Skip files in skipped directories (for nested paths)
                if any(skip_dir in rel_path.split(os.sep) for skip_dir in skipped_dirs):
                    continue
                
                # Get file stats
                file_stat = os.stat(full_path)
                
                files.append({
                    "name": filename,
                    "path": rel_path,
                    "size": file_stat.st_size,
                    "modified": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                    "is_directory": False
                })
        
        # Sort files by path
        files.sort(key=lambda x: x["path"])
        
        return files, 200
        
    except Exception as e:
        logger.error(f"Error getting files for project {project_id}: {str(e)}")
        return {"error": f"Failed to get project files: {str(e)}"}, 500

def get_file_content(project_id: str, file_path: str) -> Tuple[Dict[str, Any], int]:
    """Get the content of a specific file in a project.
    
    Args:
        project_id: The unique ID of the project
        file_path: Relative path to the file within the project
        
    Returns:
        tuple: (response with file content, status_code)
    """
    try:
        # Get project info
        project = get_project_by_id(project_id)
        if not project:
            return {"error": f"Project {project_id} not found"}, 404
            
        # Get project path
        project_path = project.get("path")
        if not project_path or not os.path.exists(project_path):
            return {"error": f"Project directory for {project_id} not found"}, 404
        
        # Build absolute file path
        absolute_file_path = os.path.join(project_path, file_path)
        
        # Normalize paths to avoid directory traversal attacks
        absolute_file_path = os.path.normpath(absolute_file_path)
        project_path = os.path.normpath(project_path)
        
        # Check if file path is within project directory to prevent directory traversal
        if not absolute_file_path.startswith(project_path):
            return {"error": "Invalid file path"}, 400
        
        # Check if file exists
        if not os.path.exists(absolute_file_path):
            return {"error": f"File {file_path} not found"}, 404
            
        # Check if path is a file and not a directory
        if not os.path.isfile(absolute_file_path):
            return {"error": f"Path {file_path} is a directory, not a file"}, 400
        
        # Read file content
        try:
            with open(absolute_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            # If the file is not a text file, return an error
            return {"error": f"File {file_path} is not a text file"}, 400
            
        # Get file metadata
        file_stat = os.stat(absolute_file_path)
        
        # Return file content and metadata
        return {
            "name": os.path.basename(file_path),
            "path": file_path,
            "size": file_stat.st_size,
            "modified": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
            "content": content
        }, 200
        
    except Exception as e:
        logger.error(f"Error getting file content for {file_path} in project {project_id}: {str(e)}")
        return {"error": f"Failed to get file content: {str(e)}"}, 500 