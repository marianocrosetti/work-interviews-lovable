"""Hook management for the AI coding agent."""

import asyncio
import copy
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Optional, TypeVar

from loguru import logger

from app.agentic.agents.coder.event_bus import EventBus, EventType
from app.agentic.projects.manager import get_project_manager
from app.agentic.storage.file_operation_manager import (
    ChangeType,
    FileOperationManager,
    HookContext,
    HookStatus,
    WriteTurn,
)
from app.agentic.utils.code_checks import perform_code_checks
from app.agentic.utils.runner_client import RunnerClient
from app.agentic.utils.snapshot import create_snapshot

T = TypeVar("T")
HookFunc = Callable[[WriteTurn], Any]
CompletionFunc = Callable[[HookContext[Any]], Awaitable[Any]]


class HookManager:
    """Manages hooks for file operations in the coding agent."""

    def __init__(
        self,
        cwd: str,
        file_store: FileOperationManager,
        runner: RunnerClient,
        event_bus: EventBus,
    ):
        """Initialize the HookManager.

        Args:
            cwd: The current working directory
            file_store: The FileOperationManager to register hooks with
            runner: The RunnerClient for running code checks
            event_bus: Event bus for publishing events
        """
        self.cwd = cwd
        self.file_store = file_store
        self.runner = runner
        self.event_bus = event_bus

    def register_all_hooks(
        self,
        callbacks: Optional[Dict[str, CompletionFunc]] = None,
    ) -> None:
        """Register all hooks with the file store in the correct order.

        Args:
            callbacks: Dictionary mapping hook names to their completion callbacks
        """
        callbacks = callbacks or {}

        # IMPORTANT: Register code_check hook FIRST to ensure it runs before other post-commit hooks
        self.file_store.add_post_commit_hook(
            "code_check", self._code_check_hook, callbacks.get("code_check")
        )

        # Then register other post-commit hooks that depend on code check results
        self.file_store.add_post_commit_hook(
            "git_snapshot",
            self._git_snapshot_hook,
            callbacks.get("git_snapshot") or self._on_git_snapshot_complete,
            blocking=False,
        )

        self.file_store.add_post_commit_hook(
            "project_backup",
            self._project_backup_hook,
            callbacks.get("project_backup")
            or self._on_project_backup_complete,  # Add default callback
            blocking=False,
        )

    async def _code_check_hook(self, turn: WriteTurn) -> tuple[bool, list[str]]:
        """
        Post-commit hook that runs code quality checks.

        Args:
            turn: The current write turn with changes

        Returns:
            Tuple of (passed: bool, check_results: list[str])
            passed is True if no errors were found
            check_results contains any linting or error messages
        """
        logger.info("Running code quality checks")
        project_id = Path(turn.cwd).name
        has_errors, check_results = await perform_code_checks(project_id, self.runner)
        return not has_errors, check_results

    async def _git_snapshot_hook(self, turn: WriteTurn) -> Optional[str]:
        """
        Post-commit hook that creates a git snapshot.
        Only runs if code checks passed and changes were made.

        This hook is designed to run asynchronously, so it makes a copy
        of any hook results it depends on to prevent race conditions.

        Args:
            turn: The current write turn with changes

        Returns:
            The commit message if snapshot was created, None if skipped
        """
        logger.info("Creating git snapshot")
        if not turn.changes:
            logger.info("No changes to commit")
            return None

        # Get a copy of the code_check results to prevent race conditions
        code_check_ctx = copy.deepcopy(turn.get_hook_result("code_check"))

        if not code_check_ctx or code_check_ctx.status != HookStatus.SUCCESS:
            logger.info(
                "Skipping git snapshot - code checks did not complete successfully"
            )
            return None

        if not code_check_ctx.result:
            logger.info("Skipping git snapshot - code checks did not return a result")
            return None

        passed, _ = code_check_ctx.result
        if not passed:
            logger.info("Skipping git snapshot - code checks found errors")
            return None

        # Let create_snapshot generate an appropriate commit message
        commit_message = await create_snapshot(turn.cwd)
        return commit_message

    async def _on_git_snapshot_complete(self, ctx: HookContext[Optional[str]]) -> None:
        """
        Handle completion of git snapshot creation.
        """
        if ctx.status != HookStatus.SUCCESS:
            logger.error(f"Git snapshot failed to execute: {ctx.error}")
            # Publish event about git snapshot failure
            try:
                await self.event_bus.publish_async(
                    EventType.HOOK_FAILED,
                    {
                        "hook_name": "git_snapshot",
                        "error": str(ctx.error),
                    },
                )
            except Exception as e:
                logger.error(f"Failed to publish git snapshot failure event: {e}")
            return

        if ctx.result:
            # Snapshot was created successfully
            logger.info(f"Created git snapshot: {ctx.result}")
        else:
            # Snapshot was skipped (no changes or failed checks)
            logger.info("Git snapshot was skipped")

    async def _project_backup_hook(self, turn: WriteTurn) -> None:
        """
        Post-commit hook that performs project backup.
        Only runs if code checks passed.

        This hook is designed to run asynchronously, so it makes a copy
        of any hook results it depends on to prevent race conditions.
        """
        logger.info("Running project backup")

        # Get a copy of the code_check results to prevent race conditions
        code_check_ctx = copy.deepcopy(turn.get_hook_result("code_check"))

        if not code_check_ctx or code_check_ctx.status != HookStatus.SUCCESS:
            logger.info(
                "Skipping project backup - code checks did not complete successfully"
            )
            return

        if not code_check_ctx.result:
            logger.info("Skipping project backup - code checks did not return a result")
            return

        passed, _ = code_check_ctx.result
        if not passed:
            logger.info("Skipping project backup - code checks found errors")
            return

        # Proceed with backup
        project_id = Path(turn.cwd).name
        project_manager = get_project_manager()
        await project_manager.backup_project(project_id)
        logger.info("Project backup completed successfully")

    async def _on_project_backup_complete(self, ctx: HookContext[None]) -> None:
        """
        Handle completion of project backup.
        """
        if ctx.status != HookStatus.SUCCESS:
            logger.error(f"Project backup failed to execute: {ctx.error}")
            # Publish event about project backup failure
            try:
                await self.event_bus.publish_async(
                    EventType.HOOK_FAILED,
                    {
                        "hook_name": "project_backup",
                        "error": str(ctx.error),
                    },
                )
            except Exception as e:
                logger.error(f"Failed to publish project backup failure event: {e}")
            return

        logger.info("Project backup completed successfully")


    # Methods that might be called by the agent after getting hook results
    async def process_code_check_results(
        self,
        ctx: HookContext[tuple[bool, list[str]]],
        add_memory_callback: Callable[[str], Awaitable[None]],
    ) -> None:
        """Process code check results and add them to memory if needed.

        Args:
            ctx: The code check hook context with results
            add_memory_callback: A callback to add results to agent memory
        """
        if ctx.status != HookStatus.SUCCESS:
            return

        if not ctx.result:
            return

        passed, check_results = ctx.result
        # Only add to memory if there are results to report
        if check_results:
            await add_memory_callback("\n\n".join(check_results))
