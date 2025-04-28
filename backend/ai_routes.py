import os
import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from dotenv import load_dotenv
from .auth import (
    get_current_user,
)  # Assuming you have a way to get the authenticated user

# Load environment variables (specifically GEMINI_API_KEY)
load_dotenv()

router = APIRouter(
    prefix="/ai",
    tags=["ai"],
    dependencies=[Depends(get_current_user)],  # Protect AI endpoints
)

# Configure the Gemini client
try:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Warning: GEMINI_API_KEY not found in environment variables.")
        # Optionally raise an exception or handle appropriately
        # raise ValueError("GEMINI_API_KEY not set")
        genai.configure(
            api_key="DUMMY_KEY_FOR_NOW"
        )  # Avoid crashing if key missing during dev
    else:
        genai.configure(api_key=api_key)
    # Initialize the model (consider making this configurable or choosing based on task)
    # Using gemini-1.5-flash as a generally capable and fast model
    model = genai.GenerativeModel("gemini-1.5-flash")
    print("Gemini AI Model initialized successfully.")
except Exception as e:
    print(f"Error configuring Gemini AI: {e}")
    # Handle initialization failure - maybe disable AI features?
    model = None  # Set model to None if initialization fails


# --- Request Models ---
class TextInput(BaseModel):
    text: str


class TranslateInput(BaseModel):
    text: str
    target_language: str = "English"  # Default target language


# --- Helper for API Call ---
async def generate_ai_response(prompt: str):
    if not model:
        raise HTTPException(status_code=503, detail="AI service is unavailable.")
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503, detail="AI service is not configured (missing API key)."
        )

    try:
        # Use generate_content for potentially simpler API usage
        response = await model.generate_content_async(prompt)
        # Accessing the text part safely
        if response.parts:
            return response.text
        else:
            # Handle cases where the response might be blocked or empty
            # Check response.prompt_feedback for safety ratings if needed
            print(
                f"Gemini response was empty or blocked. Feedback: {response.prompt_feedback}"
            )
            raise HTTPException(
                status_code=500, detail="AI failed to generate a response."
            )

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        # More specific error handling could be added here based on google.api_core.exceptions
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")


# --- API Endpoints ---


@router.post("/fix-grammar")
async def fix_grammar(input_data: TextInput = Body(...)):
    """Fixes grammar mistakes in the provided text."""
    prompt = f'Correct the grammar and spelling of the following text, only return the corrected text:\n\n"{input_data.text}"'
    corrected_text = await generate_ai_response(prompt)
    return {"result": corrected_text.strip()}


@router.post("/complete-sentence")
async def complete_sentence(input_data: TextInput = Body(...)):
    """Completes the sentence or phrase provided."""
    # Simple prompt, might need refinement for better results
    prompt_v2 = f'Complete the following text naturally, returning the full completed text:\n\n"{input_data.text}"'
    full_completed_text = await generate_ai_response(prompt_v2)
    return {"result": full_completed_text.strip()}


@router.post("/translate")
async def translate_text(input_data: TranslateInput = Body(...)):
    """Translates the provided text to the target language."""
    prompt = f'Translate the following text to russian and only return the translated text :\n\n"{input_data.text} "'
    translated_text = await generate_ai_response(prompt)
    return {"result": translated_text.strip()}
