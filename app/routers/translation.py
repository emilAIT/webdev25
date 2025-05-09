from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import logging

# Set up logging
logger = logging.getLogger(__name__)

# Import Google Cloud Translation libraries
try:
    from google.cloud import translate_v2 as translate

    has_translation_api = True
except ImportError:
    has_translation_api = False
    logger.warning(
        "Google Cloud Translation library not installed. Fallback mode will be used."
    )

router = APIRouter()


class TranslationRequest(BaseModel):
    text: str
    target_language: str
    source_language: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str
    details: Optional[Dict[str, Any]] = None
    fallback_available: bool = True


@router.post("/api/translate")
async def translate_text(request: TranslationRequest, use_fallback: bool = True):
    """
    Text translation via Google Cloud Translation API.
    Requires the GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS environment variable.
    If service is unavailable and use_fallback=True, will automatically use the fallback translation.
    """
    if not has_translation_api:
        logger.error("Translation API not available - library not installed")
        if use_fallback:
            return await translate_text_fallback(request)

        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=ErrorResponse(
                error="Translation service is not available (library not installed)",
                fallback_available=True,
            ).dict(),
        )

    # Check for the presence of the key in the environment
    api_key = os.getenv("GOOGLE_TRANSLATE_API_KEY")
    if not api_key:
        logger.error(
            "Translation API not available - API key not found in environment variables"
        )
        if use_fallback:
            return await translate_text_fallback(request)

        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=ErrorResponse(
                error="Environment variable with API key not found. Set GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS.",
                fallback_available=True,
            ).dict(),
        )

    try:
        # Initialize the client (key is picked up from the environment)
        translate_client = translate.Client()

        # Perform translation
        result = translate_client.translate(
            request.text,
            target_language=request.target_language,
            source_language=request.source_language,
        )

        # Form the response
        return {
            "original_text": request.text,
            "translated_text": result["translatedText"],
            "source_language": (
                result.get("detectedSourceLanguage")
                if not request.source_language
                else request.source_language
            ),
            "target_language": request.target_language,
        }

    except Exception as e:
        logger.exception(f"Translation failed: {str(e)}")
        if use_fallback:
            return await translate_text_fallback(request)

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                error=f"Translation failed: {str(e)}",
                details={"exception_type": type(e).__name__},
                fallback_available=True,
            ).dict(),
        )


@router.post("/api/translate/fallback")
async def translate_text_fallback(request: TranslationRequest):
    """
    Fallback translation for development without real keys.
    Simply adds "[Translated to X]".
    """
    try:
        return {
            "original_text": request.text,
            "translated_text": f"{request.text} [Translated to {request.target_language}]",
            "source_language": request.source_language or "auto",
            "target_language": request.target_language,
            "note": "This is a fallback translation for development. No real translation was performed.",
        }
    except Exception as e:
        logger.exception(f"Fallback translation failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": f"Fallback translation failed: {str(e)}"},
        )


@router.get("/api/translate/health")
async def translation_health_check():
    """
    Health check endpoint for the translation service.
    Returns status of the translation service and available options.
    """
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    return {
        "service_status": (
            "available" if has_translation_api and api_key else "unavailable"
        ),
        "api_installed": has_translation_api,
        "api_key_configured": bool(api_key),
        "fallback_available": True,
    }
