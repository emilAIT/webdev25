import asyncio
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.fernet import Fernet
import base64
from backend.models.models import User, UserKey  # Импортируем User для работы с email
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Tuple


async def generate_rsa_keys() -> Tuple[str, str]:
    loop = asyncio.get_event_loop()

    # Генерация ключей в отдельном потоке
    private_key = await loop.run_in_executor(None, lambda: rsa.generate_private_key(public_exponent=65537, key_size=2048))

    # Преобразуем приватный ключ в формат PEM
    private_pem = await loop.run_in_executor(None, lambda: private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ))

    # Преобразуем публичный ключ в формат PEM
    public_pem = await loop.run_in_executor(None, lambda: private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ))

    return private_pem.decode(), public_pem.decode()


# Асинхронная версия шифрования приватного ключа
async def encrypt_private_key(private_key: str, secret: str) -> str:
    loop = asyncio.get_event_loop()

    # Генерация ключа для шифрования на основе секрета
    key = await loop.run_in_executor(None, lambda: base64.urlsafe_b64encode(secret.ljust(32)[:32].encode()))

    # Шифрование приватного ключа с использованием Fernet
    fernet = Fernet(key)
    encrypted = await loop.run_in_executor(None, lambda: fernet.encrypt(private_key.encode()))

    return encrypted.decode()

# Асинхронная версия сохранения зашифрованных ключей в БД
async def save_encrypted_keys_to_db(user: User, encrypted_private_key: str, public_key: str, db: AsyncSession):
    # Добавляем запись в таблицу UserKey
    user_key = UserKey(user_id=user.id, encrypted_private_key=encrypted_private_key, public_key=public_key)
    db.add(user_key)
    await db.commit()


# Основная асинхронная функция для генерации, шифрования и сохранения ключей
async def generate_and_store_keys(user: User, db: AsyncSession):
    # Генерация RSA ключей
    private_key, public_key = await generate_rsa_keys()

    # Шифрование приватного ключа с использованием email пользователя как секрета
    encrypted_private_key = await encrypt_private_key(private_key, user.email)

    # Сохранение зашифрованных ключей в базу данных
    await save_encrypted_keys_to_db(user, encrypted_private_key, public_key, db)