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

        embed_model = get_embedder(
            config.EMBEDDING_MODEL,
            base_url=config.EMBEDDING_SERVICE_URL,
            api_key=config.EMBEDDING_API_KEY,
        )
    return TRIZStore(embed_model=embed_model)
