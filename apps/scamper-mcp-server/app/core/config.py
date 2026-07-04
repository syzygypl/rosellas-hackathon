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
    MCP_PORT: int = 8124
    PORT: Optional[int] = None
    MCP_ALLOWED_HOSTS: str = "localhost,localhost:*,127.0.0.1,127.0.0.1:*,0.0.0.0,0.0.0.0:*"
    MCP_ALLOWED_ORIGINS: str = ""
    MCP_DNS_REBINDING_PROTECTION: bool = True
    LOG_LEVEL: str = "INFO"

    @property
    def bind_port(self) -> int:
        return self.PORT or self.MCP_PORT

    @property
    def allowed_hosts(self) -> list[str]:
        return self._split_csv(self.MCP_ALLOWED_HOSTS)

    @property
    def allowed_origins(self) -> list[str]:
        return self._split_csv(self.MCP_ALLOWED_ORIGINS)

    @staticmethod
    def _split_csv(value: str) -> list[str]:
        return [item.strip() for item in value.split(",") if item.strip()]


config = Config()
