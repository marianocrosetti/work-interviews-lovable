# API v1 Documentation

This document provides an overview of the API v1 endpoints.

## Endpoints

### GET /api/v1/hello

Test endpoint returning a greeting message.

**Response:**

```json
{
  "message": "Hello from the Backend API!"
}
```

### POST /api/v1/projects

Create a new project.

**Request Body:**

```json
{
  "name": "Project Name",
  "first_message": "I want to create a task management app with React and Express"
}
```

**Response (201 Created):**

```json
{
  "id": "unique-project-id",
  "name": "Project Name",
  "first_message": "I want to create a task management app with React and Express",
  "created_at": "2023-06-01T12:00:00.000Z",
  "updated_at": "2023-06-01T12:00:00.000Z",
  "path": "/workspace/projects/unique-project-id",
  "ai_title": "React Express Task Manager",
  "ai_description": "A task management app built using React for the frontend and Express for the backend."
}
```

**Note:** The `ai_title` and `ai_description` fields are generated based on the first message.

### GET /api/v1/projects

Get a list of all projects.

**Response (200 OK):**

```json
[
  {
    "id": "unique-project-id-1",
    "name": "Project 1",
    "first_message": "I want to create a task management app with React and Express",
    "created_at": "2023-06-01T12:00:00.000Z",
    "updated_at": "2023-06-01T12:00:00.000Z",
    "path": "/workspace/projects/unique-project-id-1",
    "ai_title": "React Express Task Manager",
    "ai_description": "A task management app built using React for the frontend and Express for the backend."
  },
  {
    "id": "unique-project-id-2",
    "name": "Project 2",
    "first_message": "I need a blogging platform with user authentication",
    "created_at": "2023-06-02T12:00:00.000Z",
    "updated_at": "2023-06-02T12:00:00.000Z",
    "path": "/workspace/projects/unique-project-id-2",
    "ai_title": "Secure Blog Platform",
    "ai_description": "A blogging platform with user authentication features."
  }
]
```

### DELETE /api/v1/projects/{project_id}

Delete a project by its ID.

**Parameters:**
- `project_id` (path parameter): The unique ID of the project to delete

**Response (200 OK):**

```json
{
  "message": "Project unique-project-id deleted successfully"
}
```

**Response (404 Not Found):**

```json
{
  "error": "Project not found"
}
```

### GET /api/v1/projects/{project_id}/download

Download a project as a zip file.

**Parameters:**
- `project_id` (path parameter): The unique ID of the project to download

**Response (200 OK):**
- A zip file containing the project files
- Content-Type: application/zip
- The browser will typically prompt to save the file

**Response (404 Not Found):**

```json
{
  "error": "Project not found"
}
```

**Response (500 Internal Server Error):**

```json
{
  "error": "Failed to create project download: <error details>"
}
```

### POST /api/v1/projects/{project_id}/get-commits

Get commit history for a project.

**Parameters:**
- `project_id` (path parameter): The unique ID of the project

**Response (200 OK):**

```json
[
  {
    "hash": "abcdef1234567890",
    "title": "Initial project creation",
    "author": "Code Generator System",
    "date": "2023-06-01T12:00:00+00:00"
  }
]
```

### POST /api/v1/projects/{project_id}/switch-commit

Switch a project to a specific commit.

**Parameters:**
- `project_id` (path parameter): The unique ID of the project

**Request Body:**

```json
{
  "commit_hash": "abcdef1234567890"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Successfully switched to commit abcdef1234567890",
  "commit_hash": "abcdef1234567890"
}
```

## Adding New Endpoints

To add new endpoints, follow these steps:

1. Define the endpoint function in `routes.py`
2. Document the endpoint in this README
3. Add tests for the endpoint in `tests/test_api.py`

Example:

```python
@api_v1_bp.route('/example', methods=['GET'])
def example():
    """Example endpoint."""
    return jsonify({"example": "This is an example response"})
``` 