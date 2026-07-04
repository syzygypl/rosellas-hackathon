from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_ignore_empty=True,
        extra="ignore",
    )

    # ==========================================
    # MCP Server
    # ==========================================
    MCP_HOST: str = "0.0.0.0"
    MCP_PORT: int = 8123
    PORT: Optional[int] = None

    # ==========================================
    # Embeddings (semantic search in pytriz)
    # ==========================================
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_SERVICE_URL: str = "https://api.openai.com/v1"
    EMBEDDING_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    OPEN_AI_API_KEY: Optional[str] = None

    @property
    def bind_port(self) -> int:
        return self.PORT or self.MCP_PORT

    @property
    def embedding_api_key(self) -> Optional[str]:
        return self.EMBEDDING_API_KEY or self.OPENAI_API_KEY or self.OPEN_AI_API_KEY


config = Config()
