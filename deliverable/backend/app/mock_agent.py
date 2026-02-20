import time
import uuid
from typing import Generator, Dict, Any

class Agent:
    """A very naive agent that simulates thinking, using a tool, and replying."""

    def __init__(self, project_id: str):
        self.project_id = project_id


    def run(self, message: str) -> Generator[Dict[str, Any], None, None]:
        """Simulate processing a message and yielding events.

        Yields a sequence of event dictionaries mimicking the behavior of a real agent.
        """
        # Thinking event
        yield {
            "type": "thinking",
            "content": None,
            "tool_name": None,
            "tool_id": None,
            "status": "thinking",
        }
        time.sleep(1)

        # Tool event
        tool_id = str(uuid.uuid4())
        yield {
            "type": "tool",
            "content": None,
            "tool_name": "echo_tool",
            "tool_id": tool_id,
            "status": "running",
            "params": {"message": message},
        }
        time.sleep(1)

        # Text (final response) event
        yield {
            "type": "text",
            "content": f"Echo: {message}",
            "tool_name": None,
            "tool_id": None,
            "status": "completed",
        }


def get_agent(project_id: str) -> Agent:
    """Factory to obtain an Agent instance for a given project_id.

    Currently returns a naive Agent implementation. In the future this can be
    replaced with a more sophisticated agent manager.
    """
    return Agent(project_id) 