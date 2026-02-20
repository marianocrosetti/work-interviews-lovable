"""Client for interacting with enviroment."""

import logging

logger = logging.getLogger(__name__)

# Special log marker that you can easily change
LOG_MARKER = "========================"

class RunnerClient:
    """Client for interacting with enviroment."""

    def __init__(self, base_url=None):
        logger.info(f"{LOG_MARKER} Initialized RunnerClient with base_url={base_url}")

    async def check_errors(self, project_id):
        logger.info(f"{LOG_MARKER} check_errors called with project_id={project_id}")

    async def restart_project(self, project_id):
        """(Re)Start the project server."""
        logger.info(f"{LOG_MARKER} restart_project called with project_id={project_id}")

    async def lint_project(self, project_id):
        """Run linting on the project."""
        logger.info(f"{LOG_MARKER} lint_project called with project_id={project_id}")

    async def add_package(self, project_id, package_name, restart_server):
        """Install a package in the project."""
        logger.info(
            f"{LOG_MARKER} add_package called with project_id={project_id}, "
            f"package_name={package_name}, restart_server={restart_server}"
        )

    async def switch_commit(self, project_id, commit_hash):
        """Switch the project's working directory to a specific commit via the runner."""
        logger.info(
            f"{LOG_MARKER} switch_commit called with project_id={project_id}, commit_hash={commit_hash}"
        )
