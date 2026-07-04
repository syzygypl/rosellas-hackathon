from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    # ==========================================
    # MCP Server
    # ==========================================
    MCP_HOST: str = "0.0.0.0"
    MCP_PORT: int = 8123

    # ==========================================
    # Embeddings (semantic search in pytriz)
    # ==========================================
    EMBEDDING_MODEL: str = "embeddinggemma:300m"
    EMBEDDING_SERVICE_URL: str = ""
    EMBEDDING_API_KEY: str = "ollama"


config = Config()
