from fastapi import FastAPI
from routers import auth, chats, messages, ws, search
from initial_data import init_db
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

init_db()


# Добавляем CORS middleware
origins = [
    "http://localhost:5500",  # Разрешаем фронт, который ты используешь
    "http://127.0.0.1:5500",  # Для локального хоста
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Разрешаем доступ с этих URL
    allow_credentials=True,
    allow_methods=["*"],  # Разрешаем все методы
    allow_headers=["*"],  # Разрешаем все заголовки
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(chats.router, prefix="/chats", tags=["chats"])
app.include_router(messages.router, prefix="/messages", tags=["messages"])
app.include_router(ws.router)
app.include_router(search.router)

@app.get("/")
def root():
    return {"message": "Chat backend running 🚀"}

