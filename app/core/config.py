import os
import logging
from dotenv import load_dotenv
import importlib.util

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check WebSocket dependencies
websockets_available = importlib.util.find_spec("websockets") is not None
wsproto_available = importlib.util.find_spec("wsproto") is not None

if not (websockets_available or wsproto_available):
    logger.warning("No WebSocket library detected! Chat functionality will be limited.")
    logger.warning("Please install WebSocket support with either:")
    logger.warning("  pip install 'uvicorn[standard]'")
    logger.warning("  or pip install websockets")
    logger.warning("  or pip install wsproto")

# API Settings
API_V1_STR = "/api"
PROJECT_NAME = "Web Chat API"

# JWT Settings
SECRET_KEY = os.getenv("SECRET_KEY", "webchatazamakbar2025ait")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# reCAPTCHA settings
RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY", "6LeyLJEqAAAAAHMHPSYPbGT3msRvBUo67icwrhZb")
RECAPTCHA_PUBLIC_KEY = os.getenv("RECAPTCHA_PUBLIC_KEY", "6LeyLJEqAAAAAFG_tm9Sl8aj1C_WIRmz-kcp0_mG")
RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"

# File Upload Settings
UPLOAD_FOLDER = "static/uploads/profiles"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB max upload size

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Log reCAPTCHA key status
if RECAPTCHA_SECRET_KEY:
    logger.info(f"reCAPTCHA secret key found (starts with: {RECAPTCHA_SECRET_KEY[:5]}...)")
else:
    logger.warning("reCAPTCHA secret key not found in environment variables!")

# Database Settings
DATABASE_URL = "webchat.db"

# WebSocket Settings
WS_URL_PREFIX = "/api/ws"
