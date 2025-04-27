import os


def format_last_message(content: str) -> str:
    """Helper function to format the display of the last message, especially for files."""
    if content and content.startswith("/static/media/chat_files/"):
        filename = content.split("/")[-1]
        # Убираем UUID
        try:
            original_filename = filename[filename.index("_") + 1 :]
        except ValueError:
            original_filename = filename  # Если нет UUID

        extension = os.path.splitext(original_filename)[1].lower()

        image_extensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]
        video_extensions = [
            ".mp4",
            ".webm",
            ".ogg",
            ".mov",
            ".avi",
            ".mkv",
        ]  # Added .avi, .mkv

        if extension in image_extensions:
            return "📷 Image"
        elif extension in video_extensions:
            return "📹 Video"
        else:
            # Can return the filename or just "File"
            # return f"📄 {original_filename}"
            return "📄 File"
    elif content is None:
        return ""  # Return an empty string if content is None
    return str(
        content
    )  # Возвращаем строковое представление контента, если это не файл или None
