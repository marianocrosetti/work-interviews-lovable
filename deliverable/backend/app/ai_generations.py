"""Project summary generation utilities using LLM."""

from typing import List, cast

from litellm import acompletion
from litellm.types.utils import Choices, ModelResponse
from loguru import logger
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import configs


class ProjectSummaryResponse(BaseModel):
    """Project summary response from LLM."""

    title: str
    description: str


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True,
)
async def generate_project_summary(message: str) -> ProjectSummaryResponse:
    """Generate a project title and description based on the user's first message.

    Args:
        message: The user's first message to the assistant

    Returns:
        ProjectSummaryResponse with title and description

    Raises:
        RuntimeError: If LLM call fails after retries
    """
    if not message.strip():
        logger.warning("Empty message provided to generate_project_summary")
        return ProjectSummaryResponse(
            title="Unnamed Project", description="No description available."
        )

    prompt = f"""Based on the user's first message below, generate a concise project title and a brief description.

User's message:
{message}

Your response MUST be a valid JSON object with exactly these two fields:
- "title": A concise name for the project (max 30 characters)
- "description": A brief summary of the project (max 100 characters)

Return ONLY the JSON object with these fields, no additional text."""

    try:
        logger.info(f"Calling LLM API with model: {configs.DEFAULT_MODEL}")
        
        response = cast(
            ModelResponse,
            await acompletion(
                model=configs.DEFAULT_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that generates project titles and descriptions based on user inputs.",
                    },
                    {"role": "user", "content": prompt},
                ],
                api_base=configs.DEFAULT_LLM_URL,
                api_key=configs.DEFAULT_MODEL_API_KEY,
                temperature=0.5,
                response_format={"type": "json_object"},
            ),
        )

        # Extract the JSON response from the LLM
        content = cast(List[Choices], response.choices)[0].message.content or "{}"
        logger.info(f"Received response from LLM: {content}")

        try:
            # Parse the response and create ProjectSummaryResponse
            result = ProjectSummaryResponse.model_validate_json(content)
            logger.info(f"Generated project summary: {result}")
            return result
        except Exception as e:
            logger.error(f"Error parsing project summary response: {e}")
            # Fallback in case of parsing error
            return ProjectSummaryResponse(
                title="AI Generated Project",
                description="Project created with AI assistance.",
            )
            
    except Exception as e:
        logger.error(f"Error generating project summary: {str(e)}")
        # Fallback in case of any error
        return ProjectSummaryResponse(
            title="AI Generated Project",
            description="Project created with AI assistance.",
        )


def generate_project_summary_sync(message: str) -> ProjectSummaryResponse:
    """Synchronous wrapper for generate_project_summary.

    This is a temporary solution until the project is fully async.

    Args:
        message: The user's first message to the assistant

    Returns:
        ProjectSummaryResponse with title and description
    """
    import asyncio
    
    try:
        # Create a new event loop if there isn't one
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        return loop.run_until_complete(generate_project_summary(message))
    except Exception as e:
        logger.error(f"Error in synchronous project summary generation: {str(e)}")
        return ProjectSummaryResponse(
            title="AI Generated Project",
            description="Project created with AI assistance.",
        ) 