"""Application configuration module.

This module contains all the configuration parameters for the application,
which can be customized via environment variables.
"""

import os
import sys
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Determine environment
ENV = os.getenv("ENV", "development")
ENV_FILE = f".env.{ENV}"

# Load environment variables from .env file
if os.path.exists(ENV_FILE):
    load_dotenv(ENV_FILE)
else:
    print(f"Warning: Environment file {ENV_FILE} not found. Using default values.")

@dataclass
class Config:
    """Application configuration."""
    
    # Workspace and storage configuration
    WORKSPACE_PATH: str = os.environ.get("WORKSPACE_PATH", os.path.join(os.path.expanduser("~"), ".code-agent"))
    STARTER_PROJECT_REPO: str = os.environ.get("STARTER_PROJECT_REPO", "https://github.com/mariano22/starter-template.git")# Server configuration
    HOST: str = os.environ.get("HOST", "0.0.0.0")
    PORT: int = int(os.environ.get("PORT", "5000"))
    DEBUG: bool = os.environ.get("DEBUG", "true").lower() in ["true", "1", "yes"]
    
    # CORS configuration
    CORS_ORIGINS: List[str] = field(default_factory=lambda: 
        os.environ.get("CORS_ORIGINS", "*").split(",")
    )
    
    # API configuration
    API_V1_PREFIX: str = os.environ.get("API_V1_PREFIX", "/api/v1")
    PROJECT_NAME: str = os.environ.get("PROJECT_NAME", "Backend")
    VERSION: str = os.environ.get("VERSION", "0.1.0")
    

    KB_CHROMA_CLIENT_TYPE = "persistent"
    KB_CHROMA_DIRECTORY = "kb_db"  # Used for persistent client
    KB_CHROMA_HTTP_HOST = "localhost"
    KB_CHROMA_HTTP_PORT = 8000
    KB_CHROMA_HTTP_SSL = False

    # Embeddings config
    EMBEDDING_VENDER = None  # Only openai is supported so far
    EMBEDDING_API_KEY = None
    EMBEDDING_MODEL = None

    # Memory management config
    COMPACT_THRESHOLD_TOKENS = 30000  # Compact at 30k tokens
    COMPACT_TARGET_RATIO = 0.3  # Target amount of tokens to keep
    ENABLE_PROMPT_CACHE = False  # Control whether to optimize for prompt caching
    SKIP_LINT_BY_DEFAULT = True
    KB_MIN_RELEVANCE_SCORE = 0.1

    # Logging config
    LOG_LEVEL = "debug"
    RELOAD = True
    
    # LLM configuration
    DEFAULT_MODEL: str = os.environ.get("DEFAULT_MODEL", "claude-3-opus-20240229")
    CODER_MODEL = "claude-3-opus-20240229"
    CODER_LLM_URL = "https://api.anthropic.com"
    CODER_API_KEY = os.environ.get("CODER_API_KEY", "")
    DEFAULT_LLM_URL: str = os.environ.get("DEFAULT_LLM_URL", "https://api.anthropic.com")
    DEFAULT_MODEL_API_KEY: str = os.environ.get("DEFAULT_MODEL_API_KEY", "")

    # Application information
    APP_NAME: str = os.environ.get("APP_NAME", "Backend")
    APP_VERSION: str = os.environ.get("APP_VERSION", "0.1.0")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary.
        
        Returns:
            Dictionary representation of the configuration
        """
        return {
            key: value 
            for key, value in self.__dict__.items() 
            if not key.startswith("_") and key.isupper()
        }
    
    def __str__(self) -> str:
        """String representation of configuration."""
        config_dict = self.to_dict()
        config_str = "Configuration:\n"
        for key, value in config_dict.items():
            # Mask API keys in string representation
            if "API_KEY" in key and value:
                value = value[:8] + "..." + value[-4:]
            config_str += f"  {key}: {value}\n"
        return config_str

# Create default configuration instance
configs = Config()

# Print config when running as script for debugging
if __name__ == "__main__":
    print(configs) 