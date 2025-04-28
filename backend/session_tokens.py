import redis.asyncio as redis
from datetime import timedelta
from backend.config import settings

redis_sessions = redis.from_url(settings.REDIS_SESSIONS_URL, decode_responses=True)

redis_codes = redis.from_url(settings.REDIS_CODES_URL, decode_responses=True)

redis_blacklist = redis.from_url(settings.REDIS_BLACKLIST_URL, decode_responses=True)

# async def store_session(user_id: int, session_data: dict):
#     async with redis_sessions.pipeline() as pipe:
#         await pipe.hset(f"user:{user_id}:session", mapping=session_data)
#         await pipe.execute()

async def store_access_token(user_id: int, access_token: str, expiration_time: timedelta):
    await redis_sessions.set(f"user:{user_id}:access_token", access_token, ex=expiration_time)

async def store_refresh_token(user_id: int, refresh_token: str, expiration_time: timedelta):
    await redis_sessions.set(f"user:{user_id}:refresh_token", refresh_token, ex=expiration_time)

async def get_session(user_id: int):
    return await redis_sessions.hgetall(f"user:{user_id}:session")

async def store_verification_code(email: str, code: str, expires_minutes: int):
    key = f"verify:{email}"
    await redis_codes.set(key, code, ex=expires_minutes * 60)

async def get_verification_code(email: str):
    return await redis_codes.get(f"verify:{email}")

async def verify_code(email: str, input_code: str) -> bool:
    key = f"verify:{email}"
    saved_code = await redis_codes.get(key)
    return saved_code == input_code

# async def delete_verification_code(email: str):
#     key = f"verify:{email}"
#     await redis_client.delete(key)


async def blacklist_refresh_token(user_id: int, refresh_token: str, expiration_time: timedelta):
    key = f"blacklist:refresh_token:{user_id}"
    await redis_blacklist.set(key, refresh_token, ex=expiration_time)

async def remove_refresh_token_from_blacklist(user_id: int):
    key = f"blacklist:refresh_token:{user_id}"
    await redis_blacklist.delete(key)

async def is_refresh_token_blacklisted(user_id: int, refresh_token: str) -> bool:
    key = f"blacklist:refresh_token:{user_id}"
    blacklisted_token = await redis_blacklist.get(key)
    return blacklisted_token == refresh_token