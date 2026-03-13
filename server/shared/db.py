from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket

from .config import MONGO_URI, DB_NAME, GRIDFS_BUCKET_NAME

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client


def get_db():
    return get_client()[DB_NAME]


def get_gridfs_bucket() -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(get_db(), bucket_name=GRIDFS_BUCKET_NAME)


async def ping_db() -> bool:
    """Verify connectivity to MongoDB Atlas. Returns True on success."""
    client = get_client()
    result = await client.admin.command("ping")
    return result.get("ok") == 1.0


async def close_db():
    global _client
    if _client is not None:
        _client.close()
        _client = None
