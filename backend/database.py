from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings

DATABASE_URL = settings.DATABASE_URL

engine = create_async_engine(
    DATABASE_URL,
    echo=True,  # Логирование запросов SQL
    pool_size=10,  # Максимальное количество соединений в пуле
    max_overflow=20,  # Дополнительные соединения, которые могут быть созданы сверх pool_size
    pool_timeout=120,  # Время в секундах, которое будет ожидаться для получения соединения
    pool_recycle=3600,  # Время в секундах, через которое соединение будет закрыто и пересоздано
)

SessionLocal = sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    autoflush=False, 
    autocommit=False
)

Base = declarative_base()

async def get_db():
    async with SessionLocal() as db:
        yield db

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)