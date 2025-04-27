from google import genai
import os
from fastapi import HTTPException


class GeminiService:
    def __init__(self, api_key=None):
        """Initialize the Gemini service with the provided API key"""
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("Gemini API key is required")

        # Initialize the client
        self.client = genai.Client(api_key=self.api_key)

    async def generate_response(self, prompt, model="gemini-2.0-flash"):
        """Generate a response using the Gemini model"""
        try:
            response = self.client.models.generate_content(model=model, contents=prompt)
            return {"response": response.text}
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error generating AI response: {str(e)}"
            )
