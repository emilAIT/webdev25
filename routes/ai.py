from flask import Blueprint, request, jsonify, session, current_app
from groq import Groq
import json
from models import db

ai = Blueprint('ai', __name__)

@ai.route('/api/ai-chat', methods=['POST'])
def ai_chat():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json()
    user_message = data.get('message')

    if not user_message:
        return jsonify({"success": False, "message": "Message is required"}), 400

    try:
        # Initialize Groq client
        client = Groq(
            api_key=current_app.config['GROQ_API_KEY'],
        )

        # Call Groq API
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a friendly assistant focused on generating short and clear messages. Speak in russian if user writes you in russian; otherwise, speak in english only. Make sure your answers do not exceed 30 words if not necessary. Your goal is to generate responses that users can easily copy and paste without needing to alter the text. You will not suggest multiple options. Always provide a direct, yet a creative response to the user's request."
                },
                {
                    "role": "user",
                    "content": user_message
                }
            ],
            model="llama3-8b-8192",  # Using a default Groq model
        )

        # Extract the AI's response
        ai_message = chat_completion.choices[0].message.content

        return jsonify({
            "success": True,
            "ai_response": ai_message
        })

    except Exception as e:
        error_message = str(e)
        return jsonify({
            "success": False,
            "message": f"Error connecting to AI service: {error_message}"
        }), 500

@ai.route('/api/ai-chat/history', methods=['GET'])
def get_ai_chat_history():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401
    
    # In a real app, you might store AI chat history in the database
    # For this simple project, we'll just return a placeholder
    
    return jsonify({
        "success": True,
        "history": [
            # This would be populated from a database in a real app
        ]
    }) 