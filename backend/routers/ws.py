from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
from services.auth import get_current_user_ws
from db.models import User
from core.config import SECRET_KEY, ALGORITHM
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from core.database import get_db

router = APIRouter()

# Словарь: { chat_id: [список сокетов] }
active_connections: Dict[int, List[WebSocket]] = {}

@router.websocket("/ws/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: int, db: Session = Depends(get_db)):
    await websocket.accept()

    # Извлекаем токен из query params
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close()
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            await websocket.close()
            return
    except JWTError:
        await websocket.close()
        return

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        await websocket.close()
        return

    # Теперь продолжаем подключение
    if chat_id not in active_connections:
        active_connections[chat_id] = []
    active_connections[chat_id].append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            for connection in active_connections[chat_id]:
                await connection.send_text(f"{user.username}: {data}")
    except WebSocketDisconnect:
        active_connections[chat_id].remove(websocket)

