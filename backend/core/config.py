# app/core/config.py (или аналогичный файл)
import os

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")  # Можно также передавать через env переменные
ALGORITHM = "HS256"  # Алгоритм подписи
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # Время действия токена (в минутах)
