import os
import time
import uuid
import shutil
from pathlib import Path
from datetime import datetime, timezone
from mimetypes import guess_type
from typing import Optional, BinaryIO, Dict
from fastapi import UploadFile
from fastapi.staticfiles import StaticFiles

from google.cloud import storage
from google.oauth2 import service_account

# Получение конфигурации из переменных окружения
GCP_BUCKET_NAME = "ait_media"  # Explicitly set bucket name to ait_Media
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_CREDENTIALS_JSON = os.getenv("GCP_CREDENTIALS_JSON", "credentials.json")
GCP_PUBLIC_URL_PREFIX = os.getenv(
    "GCP_PUBLIC_URL_PREFIX", f"https://storage.googleapis.com/{GCP_BUCKET_NAME}/"
)

# Конфигурация локального хранилища
LOCAL_STORAGE_PATH = os.getenv("LOCAL_STORAGE_PATH", "media_files")
LOCAL_STORAGE_URL_PREFIX = os.getenv("LOCAL_STORAGE_URL_PREFIX", "/media/")
STORAGE_TYPE = os.getenv(
    "STORAGE_TYPE", "gcp"
).lower()  # 'gcp' or 'local', default to GCP

# Типы медиафайлов
ALLOWED_MEDIA_TYPES = {
    "image": ["image/jpeg", "image/png", "image/gif", "image/webp"],
    "video": ["video/mp4", "video/webm", "video/ogg"],
    "audio": ["audio/mpeg", "audio/wav", "audio/ogg"],
    "document": [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "application/zip",
    ],
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB максимальный размер файла


class LocalStorageClient:
    """Клиент для работы с локальным хранилищем файлов"""

    def __init__(self):
        """Инициализация клиента локального хранилища"""
        try:
            # Создаем директорию для хранения файлов, если она не существует
            self.base_path = Path(LOCAL_STORAGE_PATH).absolute()
            self.base_path.mkdir(parents=True, exist_ok=True)
            print(f"Local storage initialized at: {self.base_path}")
        except Exception as e:
            print(f"Error initializing local storage: {e}")
            self.base_path = None

    async def upload_file(
        self, file: UploadFile, folder: str = "general", user_id: int = None
    ) -> Optional[Dict]:
        """
        Загрузка файла в локальное хранилище

        Args:
            file: Загружаемый файл
            folder: Папка для хранения (например, 'images', 'documents')
            user_id: ID пользователя для организации файлов по пользователям

        Returns:
            Dict с метаданными файла или None при ошибке
        """
        if not self.base_path:
            print("Local storage not initialized")
            return None

        try:
            # Получаем содержимое файла
            contents = await file.read()
            file_size = len(contents)

            # Сбрасываем позицию для последующих операций чтения
            await file.seek(0)

            # Проверяем размер файла
            if file_size > MAX_FILE_SIZE:
                return {
                    "error": f"File size exceeds maximum allowed size of {MAX_FILE_SIZE} bytes"
                }

            # Генерируем уникальное имя файла
            original_filename = file.filename
            file_extension = (
                original_filename.split(".")[-1] if "." in original_filename else ""
            )
            unique_filename = (
                f"{uuid.uuid4()}.{file_extension}"
                if file_extension
                else f"{uuid.uuid4()}"
            )

            # Формируем путь в хранилище
            user_folder = f"user_{user_id}/" if user_id else ""
            timestamp = int(time.time())
            relative_path = f"{folder}/{user_folder}{timestamp}_{unique_filename}"
            storage_path = self.base_path / relative_path

            # Создаем директории если они не существуют
            storage_path.parent.mkdir(parents=True, exist_ok=True)

            # Определяем тип файла
            content_type = (
                file.content_type
                or guess_type(file.filename)[0]
                or "application/octet-stream"
            )

            # Определяем категорию медиафайла
            media_type = None
            for type_key, mime_types in ALLOWED_MEDIA_TYPES.items():
                if content_type in mime_types:
                    media_type = type_key
                    break

            if not media_type:
                # Если тип не определен, считаем документом
                media_type = "document"

            # Сохраняем файл на диск
            with open(storage_path, "wb") as f:
                shutil.copyfileobj(file.file, f)

            # Формируем URL
            media_url = f"{LOCAL_STORAGE_URL_PREFIX}{relative_path}"

            # Возвращаем метаданные
            return {
                "url": media_url,
                "filename": original_filename,
                "storage_path": str(relative_path),
                "media_type": media_type,
                "size": file_size,
                "content_type": content_type,
            }

        except Exception as e:
            print(f"Error uploading file to local storage: {e}")
            return None

    def delete_file(self, storage_path: str) -> bool:
        """
        Удаление файла из локального хранилища

        Args:
            storage_path: Относительный путь к файлу в хранилище

        Returns:
            True если файл успешно удален, иначе False
        """
        if not self.base_path:
            return False

        try:
            file_path = self.base_path / storage_path
            if file_path.exists():
                file_path.unlink()
                return True
            return False
        except Exception as e:
            print(f"Error deleting file from local storage: {e}")
            return False


class GCPStorageClient:
    """Клиент для работы с Google Cloud Storage"""

    def __init__(self):
        """Инициализация клиента GCP Storage"""
        try:
            # Если указан путь к JSON с учетными данными
            if os.path.exists(GCP_CREDENTIALS_JSON):
                credentials = service_account.Credentials.from_service_account_file(
                    GCP_CREDENTIALS_JSON
                )
                self.client = storage.Client(credentials=credentials)
            else:
                # Используем стандартные учетные данные (для разработки или деплоя в GCP)
                self.client = storage.Client()

            # Получаем или создаем bucket
            try:
                self.bucket = self.client.get_bucket(GCP_BUCKET_NAME)
            except Exception as e:
                print(f"Error getting bucket: {e}")
                # Создаем bucket, если он не существует
                try:
                    self.bucket = self.client.create_bucket(GCP_BUCKET_NAME)
                    print(f"Created new bucket: {GCP_BUCKET_NAME}")
                except Exception as bucket_error:
                    print(f"Failed to create bucket: {bucket_error}")
                    self.bucket = None

        except Exception as e:
            print(f"Error initializing GCP Storage: {e}")
            self.client = None
            self.bucket = None

    async def upload_file(
        self, file: UploadFile, folder: str = "general", user_id: int = None
    ) -> Optional[Dict]:
        """
        Загрузка файла в Google Cloud Storage

        Args:
            file: Загружаемый файл
            folder: Папка для хранения (например, 'images', 'documents')
            user_id: ID пользователя для организации файлов по пользователям

        Returns:
            Dict с метаданными файла или None при ошибке
        """
        if not self.client or not self.bucket:
            print("GCP Storage client not initialized, falling back to local storage")
            # Create a local storage client as fallback
            local_client = LocalStorageClient()
            return await local_client.upload_file(file, folder, user_id)

        try:
            # Получаем содержимое файла
            contents = await file.read()
            file_size = len(contents)

            # Проверяем размер файла
            if file_size > MAX_FILE_SIZE:
                return {
                    "error": f"File size exceeds maximum allowed size of {MAX_FILE_SIZE} bytes"
                }

            # Генерируем уникальное имя файла
            original_filename = file.filename
            file_extension = (
                original_filename.split(".")[-1] if "." in original_filename else ""
            )
            unique_filename = (
                f"{uuid.uuid4()}.{file_extension}"
                if file_extension
                else f"{uuid.uuid4()}"
            )

            # Формируем путь в хранилище
            user_folder = f"user_{user_id}/" if user_id else ""
            timestamp = int(time.time())
            storage_path = f"{folder}/{user_folder}{timestamp}_{unique_filename}"

            # Определяем тип файла
            content_type = (
                file.content_type
                or guess_type(file.filename)[0]
                or "application/octet-stream"
            )

            # Определяем категорию медиафайла
            media_type = None
            for type_key, mime_types in ALLOWED_MEDIA_TYPES.items():
                if content_type in mime_types:
                    media_type = type_key
                    break

            if not media_type:
                # Если тип не определен, считаем документом
                media_type = "document"

            # Создаем и загружаем blob
            try:
                blob = self.bucket.blob(storage_path)
                blob.upload_from_string(contents, content_type=content_type)

                # Формируем URL
                media_url = f"{GCP_PUBLIC_URL_PREFIX}{storage_path}"

                # Возвращаем метаданные
                return {
                    "url": media_url,
                    "filename": original_filename,
                    "storage_path": storage_path,
                    "media_type": media_type,
                    "size": file_size,
                    "content_type": content_type,
                }
            except Exception as upload_error:
                print(
                    f"Error during GCP upload, falling back to local storage: {upload_error}"
                )
                # If GCP upload fails, fallback to local storage
                await file.seek(0)  # Reset file pointer
                local_client = LocalStorageClient()
                return await local_client.upload_file(file, folder, user_id)

        except Exception as e:
            print(f"Error uploading file to GCP: {e}")
            # Try local storage as fallback
            try:
                await file.seek(0)  # Reset file pointer
                local_client = LocalStorageClient()
                return await local_client.upload_file(file, folder, user_id)
            except Exception as local_error:
                print(f"Local fallback also failed: {local_error}")
                return None

    def delete_file(self, storage_path: str) -> bool:
        """
        Удаление файла из Google Cloud Storage

        Args:
            storage_path: Путь к файлу в хранилище

        Returns:
            True если файл успешно удален, иначе False
        """
        if not self.client or not self.bucket:
            return False

        try:
            blob = self.bucket.blob(storage_path)
            blob.delete()
            return True
        except Exception as e:
            print(f"Error deleting file from GCP: {e}")
            return False



storage_client = GCPStorageClient()
print("Using Google Cloud Storage")

