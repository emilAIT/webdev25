import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from routes import auth_required, router
from db import init_db
import uvicorn

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.add_middleware(SessionMiddleware, secret_key="your_secret_key")

# Database initialize
init_db()

# Include all routes
app.include_router(router)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.debug(f"Request path: {request.url.path}")
    response = await call_next(request)
    logger.debug(f"Response status: {response.status_code}")
    return response

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": "Внутренняя ошибка сервера"},
    )

@app.get("/new_group", response_class=HTMLResponse, name="new_group")
def new_group_page(request: Request):
    return templates.TemplateResponse("new_group.html", {"request": request})

@app.get("/profile", response_class=HTMLResponse, name="profile")
def profile_page(request: Request):
    return templates.TemplateResponse("profile.html", {"request": request})

@app.get("/addcontact", response_class=HTMLResponse, name="addcontact")
def addcontact_page(request: Request):
    return templates.TemplateResponse("addcontact.html", {"request": request})

@app.get("/adminpanel", response_class=HTMLResponse, name="adminpanel")
def adminpanel_page(request: Request):
    return templates.TemplateResponse("adminpanel.html", {"request": request})

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)