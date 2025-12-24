"""Configuration management for the standalone backend."""
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Ensure .env is loaded before settings evaluation
load_dotenv()


class Settings(BaseSettings):
    # General
    app_name: str = Field(default="Chroma AUG RAG Backend", env="APP_NAME")
    env: str = Field(default="development", env="ENVIRONMENT")

    # Chroma configuration
    chroma_path: Path = Field(
        default=Path(r"C:\Users\sushm\OneDrive\Desktop\llm_engineering-main\DBMS-25\chroma_aug_store"),
        env="CHROMA_PATH",
    )
    chroma_collection: str = Field(default="DBMS-25", env="CHROMA_COLLECTION")

    # Embedding model
    embed_model: str = Field(default="all-MiniLM-L6-v2", env="EMBED_MODEL")

    # Model backend selection
    model_backend: str = Field(default="ollama", env="MODEL_BACKEND")
    model_name: str = Field(default="llama3.2", env="MODEL_NAME")

    # Ollama/OpenAI compatible endpoints
    ollama_api_base: Optional[str] = Field(default="http://localhost:11434", env="OLLAMA_API_BASE")
    openai_api_base: Optional[str] = Field(default=None, env="OPENAI_API_BASE")
    openai_api_key: Optional[str] = Field(default=None, env="OPENAI_API_KEY")

    # Gemini / Google Generative AI
    gemini_api_key: Optional[str] = Field(default=None, env="GEMINI_API_KEY")

    # MongoDB configuration
    mongo_uri: str = Field(
        default="mongodb+srv://sushmaaditya717:rdqdcaYTLY7p50za@adityaadi.vztbe.mongodb.net",
        env="MONGO_URI",
    )
    mongo_database: str = Field(default="rag_project_db", env="MONGO_DATABASE")
    mongo_users_collection: str = Field(default="students", env="MONGO_USERS_COLLECTION")
    mongo_faculty_collection: str = Field(default="faculty", env="MONGO_FACULTY_COLLECTION")
    mongo_projects_collection: str = Field(default="projects", env="MONGO_PROJECTS_COLLECTION")
    mongo_teams_collection: str = Field(default="teams", env="MONGO_TEAMS_COLLECTION")

    # Auth
    auth_token_secret: str = Field(default="super-secret", env="AUTH_TOKEN_SECRET")
    auth_token_ttl_minutes: int = Field(default=60 * 6, env="AUTH_TOKEN_TTL_MINUTES")

    model_config = SettingsConfigDict(
        case_sensitive=False,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=("settings_",),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached access to application settings."""
    return Settings()
