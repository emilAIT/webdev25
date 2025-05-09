from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Direct imports from new router files in app/routers/
from app.routers.auth import router as auth_router
from app.routers.views import router as views_router
from app.routers.direct_messages import router as direct_messages_router
from app.routers.groups import router as groups_router
from app.routers.websockets import router as websockets_router
from app.routers.session import router as session_router
from app.routers.friends import router as friends_router
from app.routers.attachment import router as attachment_router
from app.routers.stats import router as stats_router
from app.routers.translation import router as translation_router

app = FastAPI(title="Blink")

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Configure Jinja2 templates
templates = Jinja2Templates(directory="app/templates")

# Get secret key from environment or use default for development
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
SESSION_MAX_AGE = int(os.getenv("SESSION_MAX_AGE", "3600"))  # 1 hour default

# Add session middleware
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY, max_age=SESSION_MAX_AGE)

# Include routers directly
app.include_router(auth_router)
app.include_router(views_router)
app.include_router(direct_messages_router)
app.include_router(groups_router)
app.include_router(websockets_router)
app.include_router(session_router)
app.include_router(friends_router)
app.include_router(attachment_router)
app.include_router(stats_router)
app.include_router(translation_router)


# Root route redirects to login
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return RedirectResponse(url="/login")


if __name__ == "__main__":
    # Get host and port from environment or use defaults
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
