import asyncio
"""API v1 routes."""

import os
import threading
import json
import queue
from flask import jsonify, request, current_app, send_file, after_this_request, Response, stream_with_context
from app.api.v1 import api_v1_bp
from app.projects import (
    create_project, 
    get_all_projects, 
    delete_project, 
    get_project_by_id, 
    create_project_zip, 
    cleanup_zip_file,
    get_project_commit_history,
    switch_project_commit,
    get_project_files,
    get_file_content
)
from app.agentic.utils.agent_helpers import get_agent

@api_v1_bp.route('/hello', methods=['GET'])
def hello():
    """Test endpoint returning a greeting message."""
    return jsonify({"message": "Hello from the Backend API!"})


@api_v1_bp.route("/chat", methods=["POST"])
def chat_endpoint():
    """
    Stream the agent's output in real time via Server-Sent Events (SSE).

    Expected JSON body:
    {
        "project_id": "<project_id>",
        "message":    "<user_message>"
    }
    """
    data = request.get_json(force=True, silent=True) or {}
    project_id = data.get("project_id")
    message    = data.get("message")

    if not project_id or not message:
        return jsonify({"error": "project_id and message are required"}), 400

    # 1) Validate project and get the agent ----------------------------------
    project = get_project_by_id(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    agent = get_agent(project_id)

    # 2) Bridge async generator  → sync Flask response -----------------------
    q: queue.Queue[dict | None] = queue.Queue()

    async def _produce() -> None:
        """Collect events from the async agent and push them into the queue."""
        try:
            async for ev in agent.run(message):
                # Convert StreamEvent objects to dictionaries
                if hasattr(ev, '__dataclass_fields__'):
                    # If it's a TextEvent, create a dict with type and content
                    if hasattr(ev, 'text'):
                        q.put({"type": "text", "content": ev.text})
                    # If it's a ToolEvent, convert all fields to dict
                    elif hasattr(ev, 'tool_name') and hasattr(ev, 'tool_id'):
                        event_dict = {
                            "type": "tool",
                            "type": "tool", 
                            "tool_name": ev.tool_name,
                            "tool_id": ev.tool_id,
                            "status": ev.status
                        }
                        if hasattr(ev, 'params') and ev.params is not None:
                            event_dict["params"] = ev.params
                        if hasattr(ev, 'result') and ev.result is not None:
                            event_dict["content"] = ev.result
                        if hasattr(ev, 'error') and ev.error is not None:
                            event_dict["error"] = ev.error
                        q.put(event_dict)
                    # Handle ThinkingEvent
                    elif hasattr(ev, 'thinking') or hasattr(ev, '__class__') and ev.__class__.__name__ == 'ThinkingEvent':
                        q.put({"type": "thinking", "status": "thinking"})
                    else:
                        # For any other types, just convert to dict
                        q.put(vars(ev))
                else:
                    # If it's already a dict or other JSON-serializable object
                    q.put(ev)
        except Exception as exc:
            q.put({"type": "error", "error": str(exc)})
        finally:
            # Sentinel value means "we're done – close the stream".
            q.put(None)

    # Run the async producer in a background thread so the main
    # Flask worker is free to yield events immediately.
    threading.Thread(
        target=lambda: asyncio.run(_produce()),
        daemon=True,
    ).start()

    # 3) Flask generator that reads from the queue and emits SSE -------------
    @stream_with_context
    def event_stream():
        while True:
            ev = q.get()
            if ev is None:               # <- sentinel received
                break
            # Each SSE event must end with two newlines
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"

    # 4) Return the streaming response --------------------------------------
    headers = {
        "Cache-Control":       "no-cache",
        "Connection":          "keep-alive",
        "X-Accel-Buffering":   "no",      # Disable nginx/Traefik buffering
        "Content-Type":        "text/event-stream; charset=utf-8",
    }
    return Response(event_stream(), headers=headers, status=200)


# DO NOT USE THIS ENDPOINT, IT IS FOR DEBUGGING PURPOSES ONLY
@api_v1_bp.route('/chat-sync', methods=['POST'])
def chat_sync_endpoint():
    """Process a chat message and wait for completion before responding.
    
    Expected JSON body:
    {
        "project_id": "<project_id>",
        "message": "<user_message>",
    }
    
    Returns:
        200: JSON with all events from the agent
        400: Missing required fields
        404: Project not found
        500: Server error
    """
    data = request.get_json(force=True, silent=True) or {}
    project_id = data.get("project_id")
    message = data.get("message")

    if not project_id or not message:
        return jsonify({"error": "project_id and message are required"}), 400

    # Verify project exists
    project = get_project_by_id(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    # Obtain agent
    agent = get_agent(project_id)

    # Run the agent and collect all events
    async def run_agent():
        events = []
        try:
            async for event in agent.run(message):
                events.append(event)
            return events
        except Exception as e:
            error_event = {"type": "error", "error": str(e)}
            events.append(error_event)
            return events

    # Run the coroutine in the event loop
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        events = loop.run_until_complete(run_agent())
        loop.close()
        return jsonify({"events": events})
    except Exception as e:
        current_app.logger.error(f"Error in chat-sync: {str(e)}")
        return jsonify({"error": f"Failed to process message: {str(e)}"}), 500

# Project Management Endpoints

@api_v1_bp.route('/projects', methods=['POST'])
def create_project_endpoint():
    """Create a new project.
    
    Request body:
    {
        "name": "Project Name",
        "first_message": "Project first message"
    }
    
    Returns:
        201: Project created successfully
        400: Invalid request data
    """
    data = request.get_json()
    result, status_code = create_project(data)
    return jsonify(result), status_code


@api_v1_bp.route('/projects', methods=['GET'])
def list_projects_endpoint():
    """Get a list of all projects.
    
    Returns:
        200: List of projects
        500: Server error
    """
    projects, status_code = get_all_projects()
    return jsonify(projects), status_code


@api_v1_bp.route('/projects/<project_id>', methods=['DELETE'])
def delete_project_endpoint(project_id):
    """Delete a project by its ID.
    
    Args:
        project_id: The unique ID of the project to delete
        
    Returns:
        200: Project deleted successfully
        404: Project not found
        500: Server error
    """
    result, status_code = delete_project(project_id)
    return jsonify(result), status_code


@api_v1_bp.route('/projects/<project_id>/download', methods=['GET'])
def download_project_endpoint(project_id):
    """Download a project as a zip file.
    
    Args:
        project_id: The unique ID of the project to download
        
    Returns:
        200: Zip file of the project
        404: Project not found
        500: Server error
    """
    try:
        # Check if project exists
        project = get_project_by_id(project_id)
        if not project:
            return jsonify({"error": f"Project {project_id} not found"}), 404
            
        # Check if project directory exists
        project_path = project.get("path")
        if not project_path or not os.path.exists(project_path):
            return jsonify({"error": f"Project directory for {project_id} not found"}), 404
        
        # Create zip file
        zip_path, zip_filename = create_project_zip(project_id)
        
        # Schedule cleanup in a separate thread after sending the response
        def delayed_cleanup():
            # Give the response time to be sent
            timer = threading.Timer(60.0, cleanup_zip_file, args=[zip_path])
            timer.daemon = True
            timer.start()
        
        # Register our cleanup function to be called after the request
        @after_this_request
        def schedule_cleanup(response):
            if response.status_code == 200:
                threading.Thread(target=delayed_cleanup).start()
            return response
        
        # Send the file as an attachment
        return send_file(
            zip_path,
            as_attachment=True,
            download_name=zip_filename,
            mimetype='application/zip'
        )
        
    except FileNotFoundError as e:
        current_app.logger.error(f"File not found: {str(e)}")
        return jsonify({"error": str(e)}), 404
        
    except Exception as e:
        current_app.logger.error(f"Error creating download for project {project_id}: {str(e)}")
        return jsonify({"error": f"Failed to create project download: {str(e)}"}), 500


@api_v1_bp.route('/projects/<project_id>/get-commits', methods=['GET'])
def get_project_commits_endpoint(project_id):
    """Get commit history for a project.
    
    Args:
        project_id: The unique ID of the project
        
    Returns:
        200: List of commits with their hashes and titles
        404: Project not found
        500: Server error
    """
    try:
        commits, status_code = get_project_commit_history(project_id)
        return jsonify(commits), status_code
        
    except Exception as e:
        current_app.logger.error(f"Error getting commit history for project {project_id}: {str(e)}")
        return jsonify({"error": f"Failed to get commit history: {str(e)}"}), 500


@api_v1_bp.route('/projects/<project_id>/switch-commit', methods=['POST'])
def switch_project_commit_endpoint(project_id):
    """Switch a project to a specific commit.
    
    Args:
        project_id: The unique ID of the project
        
    Request body:
    {
        "commit_hash": "full_commit_hash"
    }
    
    Returns:
        200: Successfully switched to commit
        400: Invalid request data or invalid commit hash
        404: Project not found
        500: Server error
    """
    try:
        data = request.get_json()
        
        if not data or "commit_hash" not in data:
            return jsonify({"error": "Missing commit_hash in request body"}), 400
            
        commit_hash = data.get("commit_hash")
        if not commit_hash or not isinstance(commit_hash, str):
            return jsonify({"error": "Invalid commit_hash parameter"}), 400
        
        result, status_code = switch_project_commit(project_id, commit_hash)
        return jsonify(result), status_code
        
    except Exception as e:
        current_app.logger.error(f"Error switching commit for project {project_id}: {str(e)}")
        return jsonify({"error": f"Failed to switch commit: {str(e)}"}), 500


@api_v1_bp.route('/projects/<project_id>/files', methods=['GET'])
def get_project_files_endpoint(project_id):
    """Get all files in a project.
    
    Args:
        project_id: The unique ID of the project
        
    Returns:
        200: List of files in the project
        404: Project not found
        500: Server error
    """
    try:
        files, status_code = get_project_files(project_id)
        return jsonify(files), status_code
        
    except Exception as e:
        current_app.logger.error(f"Error getting files for project {project_id}: {str(e)}")
        return jsonify({"error": f"Failed to get project files: {str(e)}"}), 500


@api_v1_bp.route('/projects/<project_id>/files/content', methods=['GET'])
def get_file_content_endpoint(project_id):
    """Get the content of a specific file in a project.
    
    Args:
        project_id: The unique ID of the project
        
    Query Parameters:
        path: Relative path to the file within the project
        
    Returns:
        200: File content and metadata
        400: Invalid file path or not a text file
        404: Project or file not found
        500: Server error
    """
    try:
        # Get the file path from query parameters
        file_path = request.args.get('path')
        
        if not file_path:
            return jsonify({"error": "File path query parameter is required"}), 400
            
        # Get file content
        result, status_code = get_file_content(project_id, file_path)
        return jsonify(result), status_code
        
    except Exception as e:
        current_app.logger.error(f"Error getting file content for project {project_id}: {str(e)}")
        return jsonify({"error": f"Failed to get file content: {str(e)}"}), 500

# Add more API endpoints here 