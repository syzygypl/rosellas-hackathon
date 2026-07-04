from functools import lru_cache

from pytriz import TRIZStore, get_embedder

from app.core.config import config


@lru_cache(maxsize=1)
def get_store() -> TRIZStore:
    embed_model = None
    if config.EMBEDDING_MODEL:
        if not config.EMBEDDING_SERVICE_URL:
            raise RuntimeError(
                "EMBEDDING_SERVICE_URL is required when EMBEDDING_MODEL is configured."
            )
        if not config.embedding_api_key:
            raise RuntimeError(
                "Missing embedding API key. Set EMBEDDING_API_KEY, OPENAI_API_KEY, or OPEN_AI_API_KEY."
            )

        embed_model = get_embedder(
            config.EMBEDDING_MODEL,
            base_url=config.EMBEDDING_SERVICE_URL,
            api_key=config.embedding_api_key,
        )
    return TRIZStore(embed_model=embed_model)
