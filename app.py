import os
import random
import secrets
import uuid
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query, File, UploadFile, Form, Response, Body
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.websockets import WebSocketState
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Optional
import sqlite3
import shutil
# Обновляем импорты из database
from database import (
    add_group_members, create_group_chat, get_db, get_or_create_one_on_one_chat, init_db, create_user, verify_password, get_user,
    create_message, get_messages, get_or_create_chat, get_all_users,
    add_contact, get_contacts, search_users, mark_message_as_read
)
from security import create_access_token, decode_access_token
from datetime import datetime, timedelta
from main import send_email

app = FastAPI()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Корневая директория проекта
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Монтируем статические файлы
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Инициализация базы данных
init_db()

# Хранилище для WebSocket-соединений и активных пользователей
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[Dict]] = {}
        self.active_users: Dict[int, List[Dict]] = {}
        self.global_active: set = set()  # Глобальный набор онлайн-пользователей

    async def connect(self, websocket: WebSocket, chat_id: int, user: dict):
        # НЕ вызывайте websocket.accept() здесь!
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
            self.active_users[chat_id] = []
        if not any(u["id"] == user["id"] for u in self.active_users[chat_id]):
            self.active_users[chat_id].append({"id": user["id"], "username": user["username"]})
        self.active_connections[chat_id].append({"websocket": websocket, "user": user})
        # Рассылаем online-событие при первом подключении пользователя
        if user["id"] not in self.global_active:
            self.global_active.add(user["id"])
            # уведомляем всех через notifications WS
            for uid in notif_manager.active.keys():
                await notif_manager.send(uid, {"type": "presence", "user_id": user["id"], "status": "online"})
        await self.broadcast_users(chat_id)

    async def disconnect(self, websocket: WebSocket, chat_id: int, user: dict):
        if chat_id in self.active_connections:
            for conn in self.active_connections[chat_id][:]:  # Copy to avoid modifying during iteration
                if conn["websocket"] == websocket:
                    self.active_connections[chat_id].remove(conn)
                    break
            self.active_users[chat_id] = [u for u in self.active_users[chat_id] if u["id"] != user["id"]]
            # Проверяем, остались ли соединения пользователя в других чатах
            still_connected = any(
                any(c["user"]["id"] == user["id"] for c in conns)
                for conns in self.active_connections.values()
            )
            if not still_connected:
                self.global_active.remove(user["id"])
                for uid in notif_manager.active.keys():
                    await notif_manager.send(uid, {"type": "presence", "user_id": user["id"], "status": "offline"})
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]
                del self.active_users[chat_id]
            else:
                await self.broadcast_users(chat_id)

    async def broadcast(self, message: dict, chat_id: int):
        if chat_id in self.active_connections:
            for connection in self.active_connections[chat_id][:]:  # Copy to avoid modifying during iteration
                try:
                    # Check if WebSocket is still open
                    if connection["websocket"].client_state == WebSocketState.CONNECTED:
                        await connection["websocket"].send_json(message)
                    else:
                        # Remove closed connection
                        self.active_connections[chat_id].remove(connection)
                except Exception as e:
                    print(f"Error broadcasting to {connection['user']['username']}: {e}")
                    self.active_connections[chat_id].remove(connection)

    async def broadcast_users(self, chat_id: int):
        if chat_id in self.active_connections:
            user_list = self.active_users[chat_id]
            await self.broadcast({"type": "user_list", "users": user_list}, chat_id)

manager = ConnectionManager()

# Проверка токена для WebSocket
async def get_current_user_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(1008, "Missing token")
        raise WebSocketDisconnect()
    payload = decode_access_token(token)
    if payload is None:
        await websocket.close(1008, "Invalid token")
        raise WebSocketDisconnect()
    user_id = payload.get("user_id")
    if not user_id:
        await websocket.close(1008, "Invalid token")
        raise WebSocketDisconnect()
    user = get_user('id', user_id)
    if not user:
        await websocket.close(1008, "User not found")
        raise WebSocketDisconnect()
    return user

class NotificationManager:
    def __init__(self):
        # ключ = user_id, значение = список WebSocket
        self.active: Dict[int, List[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_id: int):
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, ws: WebSocket, user_id: int):
        conns = self.active.get(user_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self.active.pop(user_id, None)

    async def send(self, user_id: int, message: dict):
        for ws in list(self.active.get(user_id, [])):
            try:
                await ws.send_json(message)
            except WebSocketDisconnect:
                self.disconnect(ws, user_id)

notif_manager = NotificationManager()

@app.websocket("/ws/notifications")
async def notifications_ws(websocket: WebSocket, user: dict = Depends(get_current_user_ws)):
    uid = user["id"]
    await notif_manager.connect(websocket, uid)
    try:
        # держим соединение открытым
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notif_manager.disconnect(websocket, uid)

# Модели для входа и регистрации
class UserCreate(BaseModel):
    username: str
    password: str
    email: EmailStr

class UserLogin(BaseModel):
    username: str
    password: str

# Модель для сообщения
class MessageCreate(BaseModel):
    chat_id: int
    content: str

# Модель для добавления контактов
class ContactsAdd(BaseModel):
    contact_ids: List[int]

# Модель для запроса верификации email
class EmailVerification(BaseModel):
    code: str
    email: EmailStr
    temp_token: str

# Модель для повторной отправки кода
class ResendCode(BaseModel):
    email: EmailStr
    temp_token: str

# Модель для запроса восстановления пароля
class ForgotPasswordRequest(BaseModel):
    email: str

# Модель для запроса сброса пароля
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# Модель для обновления профиля
class UserUpdate(BaseModel):
    username: Optional[str]
    email: Optional[EmailStr]
    password: Optional[str]

# Словарь для хранения временных кодов верификации
class GroupCreate(BaseModel):
    name: str

class GroupAddMembers(BaseModel):
    user_ids: List[int]
verification_codes = {}
temp_users = {}

# Получение текущего пользователя из токена (для заголовков)
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(401, "Invalid token")
    user = get_user('id', user_id)
    if not user:
        raise HTTPException(401, "User not found")
    return user

# Получение текущего пользователя из параметра token (для маршрута /chat)
async def get_current_user_from_query(token: Optional[str] = Query(None)):
    if not token:
        raise HTTPException(401, "Token missing")
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(401, "Invalid token")
    user = get_user("id", user_id)
    if not user:
        raise HTTPException(401, "User not found")
    return user

# Маршруты
@app.get("/", response_class=HTMLResponse)
async def serve_login():
    file_path = os.path.join(BASE_DIR, "templates", "login.html")
    with open(file_path, encoding="utf-8") as f:
        return f.read()

@app.get("/chat", response_class=HTMLResponse)
async def serve_chat(response: Response, token: Optional[str] = Query(None)):
    try:
        current_user = await get_current_user_from_query(token)
        file_path = os.path.join(BASE_DIR, "templates", "main.html")
        # Запрет кеширования страницы чата
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        with open(file_path, encoding="utf-8") as f:
            return HTMLResponse(f.read(), status_code=200, headers=response.headers)
    except HTTPException as e:
        if e.status_code == 401:
            return RedirectResponse(url="/")
        raise e

@app.get("/register", response_class=HTMLResponse)
async def serve_register():
    file_path = os.path.join(BASE_DIR, "templates", "register.html")
    with open(file_path, encoding="utf-8") as f:
        return f.read()

@app.post("/register")
async def register(user: UserCreate):
    # Проверяем, существует ли пользователь с таким именем
    existing_user = get_user('username', user.username)
    existing_email = get_user('email', user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already in use")
    
    temp_token = str(uuid.uuid4())
    verification_code = str(random.randint(100000, 999999))
    
    temp_users[temp_token] = {
        "username": user.username,
        "password": user.password,
        "email": user.email
    }
    verification_codes[temp_token] = verification_code
    
    # Отправляем код на email пользователя
    send_email_result = await send_email("", user.email, verification_code)
    
    # Возвращаем временный токен
    return {"temp_token": temp_token}

@app.get("/verification", response_class=HTMLResponse)
async def serve_verification():
    file_path = os.path.join(BASE_DIR, "templates", "verification.html")
    with open(file_path, encoding="utf-8") as f:
        return f.read()

@app.post("/verify-email")
async def verify_email(verification: EmailVerification):
    # Проверяем токен и код
    if verification.temp_token not in verification_codes:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    stored_code = verification_codes[verification.temp_token]
    if stored_code != verification.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Получаем данные пользователя из временного хранилища
    user_data = temp_users.get(verification.temp_token)
    if not user_data:
        raise HTTPException(status_code=400, detail="User data not found")
    
    # Создаем пользователя в базе данных
    new_user = create_user(user_data["username"], user_data["password"], user_data["email"])
    if not new_user:
        raise HTTPException(status_code=400, detail="Failed to create user")
    
    # Очищаем временные данные
    del verification_codes[verification.temp_token]
    del temp_users[verification.temp_token]
    
    # Создаем токен доступа
    access_token = create_access_token(data={"user_id": new_user["id"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/resend-code")
async def resend_verification_code(resend: ResendCode):
    # Проверяем токен
    if resend.temp_token not in temp_users:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    # Генерируем новый код
    new_code = str(random.randint(100000, 999999))
    verification_codes[resend.temp_token] = new_code
    
    # Отправляем новый код
    send_email_result = await send_email("", resend.email, new_code)
    
    return {"message": "Verification code resent"}

@app.post("/login")
async def login(user: UserLogin):
    db_user = get_user("username", user.username)
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token(data={"user_id": db_user["id"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/logout")
async def logout(token: Optional[str] = Query(None)):
    # При выходе по HTTP: рассылаем offline для глобального presence
    if token:
        payload = decode_access_token(token)
        user_id = payload.get("user_id") if payload else None
        if user_id and user_id in manager.global_active:
            manager.global_active.remove(user_id)
            for uid in notif_manager.active.keys():
                await notif_manager.send(uid, {"type":"presence","user_id":user_id,"status":"offline"})
    # Редирект на страницу логина
    return RedirectResponse(url="/")

@app.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    users = get_all_users()
    return users

# Новый эндпоинт для получения контактов текущего пользователя
@app.get("/contacts")
async def read_contacts(user: dict = Depends(get_current_user)):
    contacts = get_contacts(user["id"])
    return contacts

# Новый эндпоинт для добавления контактов
@app.post("/contacts/add")
async def add_contacts_route(contacts_to_add: ContactsAdd, user: dict = Depends(get_current_user)):
    current_user_id = user["id"]
    added = []
    for cid in contacts_to_add.contact_ids:
        if cid != current_user_id and add_contact(current_user_id, cid):
            added.append(cid)
    if added:
        # обновляем список на стороне A
        await notif_manager.send(current_user_id, {"type":"contacts_update"})
        # и на стороне B
        for cid in added:
            await notif_manager.send(cid, {"type":"contacts_update"})
        return {"status": f"{len(added)} contacts added", "contacts": get_contacts(current_user_id)}
    raise HTTPException(400, "Could not add contacts…")

# Новый эндпоинт для поиска пользователей@app.get("/users/search")
@app.get("/users/search")
async def search_users_route(query: str = Query(..., min_length=1), user: dict = Depends(get_current_user)):
    found_users = search_users(query, user["id"])
    if not found_users:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return found_users


@app.get("/messages/{chat_id}")
async def list_messages(chat_id: int, user: dict = Depends(get_current_user)):
    chat_id = get_or_create_chat(chat_id)
    messages = get_messages(chat_id)
    return messages

@app.post("/upload-media/{chat_id}")
async def upload_media(chat_id: int, files: List[UploadFile] = File(...), user: dict = Depends(get_current_user)):
    uploaded_files = []
    
    # Создаем папку для медиафайлов, если она не существует
    media_dir = os.path.join(BASE_DIR, "static", "media")
    if not os.path.exists(media_dir):
        os.makedirs(media_dir)
    
    for file in files:
        # Генерируем уникальное имя файла
        file_ext = file.filename.split('.')[-1]
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        
        # Сохраняем файл
        file_path = os.path.join(media_dir, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        uploaded_files.append(unique_filename)
    
    return {"files": uploaded_files}

# New endpoint to get or create a one-on-one chat
@app.get("/chat/one-on-one/{contact_id}")
async def get_one_on_one_chat(contact_id: int, user: dict = Depends(get_current_user)):
    # Verify contact_id exists
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (contact_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Contact not found")
    conn.close()

    chat_id = get_or_create_one_on_one_chat(user["id"], contact_id)
    if chat_id is None:
        raise HTTPException(status_code=500, detail="Failed to create or retrieve chat due to database error")
    return {"chat_id": chat_id}

# Modified WebSocket endpoint
@app.websocket("/ws/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: int, user: dict = Depends(get_current_user_ws)):
    # Verify user is a member of the chat
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?", (chat_id, user["id"]))
    if not cursor.fetchone():
        # await websocket.close(code=1008, reason="User not in chat")
        conn.close()
        return  # Exit immediately after closing
    conn.close()
    try:
        chat_id = get_or_create_chat(chat_id)
    except ValueError:
        # await websocket.close(code=1008, reason="Invalid chat ID")
        return

    await websocket.accept()
    await manager.connect(websocket, chat_id, user)
    try:
        while True:
            data = await websocket.receive_json()
            content = data.get("content")
            if content:
                message_id = create_message(chat_id, user["id"], content)
                # Fetch the newly created message to get receiver_id
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT m.id, m.sender_id, m.receiver_id, m.content, m.timestamp, u.username AS sender_username
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.id = ?
                ''', (message_id,))
                message = cursor.fetchone()
                conn.close()
                
                message_to_broadcast = {
                    "id": message_id,
                    "sender_id": message["sender_id"],
                    "receiver_id": message["receiver_id"],
                    "username": message["sender_username"],  # for contact status lookup
                    "sender_username": message["sender_username"],  # ensure frontend displayMessage has sender_username
                    "content": content,
                    "type": "message",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
                await manager.broadcast(message_to_broadcast, chat_id)
                
                # Also send a notification to the receiver to update their chat list
                # This will be processed even if they're not in the chat currently
                if message["receiver_id"]:
                    await notif_manager.send(message["receiver_id"], {
                        "type": "new_message",
                        "chat_id": chat_id,
                        "sender_id": message["sender_id"],
                        "message_id": message_id,
                        "content": content
                    })
            # Новое: обработка события read
            if data.get("type") == "read" and data.get("message_id"):
                mark_message_as_read(data["message_id"])
                await manager.broadcast({
                    "type": "message_read",
                    "message_id": data["message_id"],
                    "reader_id": user["id"]
                }, chat_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, user)
        # Only broadcast if there are still active connections
        if chat_id in manager.active_connections:
            # await manager.broadcast({
            #     "user_id": user["id"],
            #     "username": user["username"],
            #     "content": f"{user['username']} left the chat",
            #     "type": "system"
            # }, chat_id)
            return
    except Exception as e:
        print(f"Error in WebSocket for user {user.get('username', 'unknown')}: {e}")
        manager.disconnect(websocket, chat_id, user)
        # Only broadcast if there are still active connections
        if chat_id in manager.active_connections:
            # await manager.broadcast({
            #     "user_id": user["id"],
            #     "username": user["username"],
            #     "content": f"{user['username']} left the chat due to error",
            #     "type": "system"
            # }, chat_id)
            return
    finally:
        # Ensure connection is closed
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close(code=1000, reason="Normal closure")

@app.get("/user/profile")
async def get_user_profile(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"] or "",
        "avatar": user.get("avatar", "/static/images/avatar.png")
    }

@app.put("/user/profile")
async def update_profile(update: UserUpdate, current: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    # update fields
    if update.username and update.username != current["username"]:
        cursor.execute("UPDATE users SET username = ? WHERE id = ?", (update.username, current["id"]))
    if update.email and update.email != (current.get("email") or ""):
        cursor.execute("UPDATE users SET email = ? WHERE id = ?", (update.email, current["id"]))
    if update.password:
        from passlib.context import CryptContext
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed = pwd_ctx.hash(update.password)
        cursor.execute("UPDATE users SET password = ? WHERE id = ?", (hashed, current["id"]))
    conn.commit()
    conn.close()
    # issue new token (username может измениться!)
    new_token = create_access_token(data={"user_id": current["id"]})
    return {
        "username": update.username or current["username"],
        "email": update.email or current.get("email",""),
        "token": new_token
    }

@app.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    user = get_user('email', request.email)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь с таким email не найден")
    # Генерируем токен и срок действия (например, 1 час)
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user["id"], token, expires_at)
    )
    conn.commit()
    conn.close()
    reset_link = f"http://127.0.0.1:8000/reset-password?token={token}"
    await send_email(
        f"Для сброса пароля перейдите по ссылке: {reset_link}",
        recipient_email=request.email
    )
    return {"message": "Ссылка для сброса пароля отправлена на ваш email"}

@app.get("/reset-password", response_class=HTMLResponse)
async def serve_reset_password(token: str):
    file_path = os.path.join(BASE_DIR, "templates", "password", "reset_password.html")
    with open(file_path, encoding="utf-8") as f:
        return f.read()

@app.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = ?", (request.token,)
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=400, detail="Неверный или просроченный токен")
    user_id, expires_at, used = row
    if used:
        conn.close()
        raise HTTPException(status_code=400, detail="Токен уже использован")
    if datetime.utcnow() > datetime.fromisoformat(expires_at):
        conn.close()
        raise HTTPException(status_code=400, detail="Срок действия токена истёк")
    # Обновляем пароль
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(request.new_password)
    cursor.execute("UPDATE users SET password = ? WHERE id = ?", (hashed_password, user_id))
    cursor.execute("UPDATE password_reset_tokens SET used = 1 WHERE token = ?", (request.token,))
    conn.commit()
    conn.close()
    return {"message": "Пароль успешно изменён"}

@app.post("/groups/create")
async def create_group(
    group_data: GroupCreate,
    user: dict = Depends(get_current_user)
):
    try:
        group_id = create_group_chat(user["id"], group_data.name)
        return {"group_id": group_id, "name": group_data.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Group creation failed: {str(e)}")

@app.post("/groups/{group_id}/add-members")
async def add_group_members_endpoint(
    group_id: int,
    members: GroupAddMembers,
    user: dict = Depends(get_current_user)
):
    try:
        add_group_members(group_id, members.user_ids)
        return {"status": "Members added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add members: {str(e)}")

@app.get("/user/groups")
async def get_user_groups(user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT c.id, c.name, IFNULL(c.avatar, '/static/images/group.png') AS avatar, c.creator_id
        FROM chats c
        JOIN chat_members cm ON c.id = cm.chat_id
        WHERE cm.user_id = ? AND c.is_group = TRUE
    ''', (user["id"],))
    groups = cursor.fetchall()
    conn.close()
    return [dict(group) for group in groups]

@app.get("/groups/{group_id}/members")
async def get_group_members(
    group_id: int,
    user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.id, u.username, IFNULL(u.avatar, '/static/images/avatar.png') AS avatar 
        FROM chat_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_id = ?
    ''', (group_id,))
    members = cursor.fetchall()
    conn.close()
    return [dict(member) for member in members]

@app.post("/groups/{group_id}/leave")
async def leave_group(group_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Проверяем, что пользователь в группе
        cursor.execute("SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?", (group_id, user["id"]))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Вы не участник этой группы")

        # Удаляем пользователя из группы
        cursor.execute("DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?", (group_id, user["id"]))
        conn.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка выхода из группы: {str(e)}")
    finally:
        conn.close()
    return {"detail": "Вы успешно вышли из группы"}

@app.post("/user/upload-avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

    # Проверка, что файл передан
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Проверка размера файла
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")
    file.file.seek(0)  # Сбрасываем указатель файла

    filename = file.filename
    ext = filename.split('.')[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")

    # Путь для сохранения аватара в /static/images
    upload_dir = os.path.join(BASE_DIR, "static", "images")
    os.makedirs(upload_dir, exist_ok=True)

    unique_filename = f"user_{user['id']}_{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(upload_dir, unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    avatar_url = f"/static/images/{unique_filename}"

    # Обновляем аватар в базе данных
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET avatar = ? WHERE id = ?", (avatar_url, user["id"]))
    conn.commit()
    conn.close()

    return {"avatar_url": avatar_url}

# Добавляем endpoint для получения списка онлайн-пользователей
@app.get("/users/online")
async def get_online_users():
    return list(manager.global_active)

@app.put("/groups/{group_id}/profile")
async def update_group_profile(
    group_id: int,
    name: Optional[str] = Form(None),
    avatar_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user)
):
    # Проверяем, что пользователь — участник группы
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?", (group_id, user["id"]))
    if not cursor.fetchone():
        raise HTTPException(status_code=403, detail="Not a member of the group")

    # Обновляем имя группы, если передано
    if name:
        cursor.execute("UPDATE chats SET name = ? WHERE id = ?", (name, group_id))

    # Обработка аватара группы
    if avatar_file:
        ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
        MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
        filename = avatar_file.filename
        ext = filename.split('.')[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Invalid file type")
        avatar_file.file.seek(0, os.SEEK_END)
        size = avatar_file.file.tell()
        if size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        avatar_file.file.seek(0)

        upload_dir = os.path.join(BASE_DIR, "static", "images")
        os.makedirs(upload_dir, exist_ok=True)

        unique_filename = f"group_{group_id}_{uuid.uuid4().hex}.{ext}"
        file_path = os.path.join(upload_dir, unique_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(avatar_file.file, buffer)

        avatar_url = f"/static/images/{unique_filename}"
        cursor.execute("UPDATE chats SET avatar = ? WHERE id = ?", (avatar_url, group_id))

    conn.commit()
    cursor.execute("SELECT name, avatar FROM chats WHERE id = ?", (group_id,))
    updated = cursor.fetchone()
    conn.close()

    return {"name": updated["name"], "avatar": updated["avatar"]}

@app.delete("/groups/{group_id}/members/{user_id}")
async def remove_group_member(group_id: int, user_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    # Проверяем, что текущий пользователь — создатель группы
    cursor.execute("SELECT creator_id FROM chats WHERE id = ?", (group_id,))
    group = cursor.fetchone()
    if not group:
        conn.close()
        raise HTTPException(404, detail="Group not found")
    if group["creator_id"] != current_user["id"]:
        conn.close()
        raise HTTPException(403, detail="Only group creator can remove members")

    # Проверяем, что удаляемый пользователь в группе
    cursor.execute("SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?", (group_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(404, detail="User not in group")

    # Не даём удалить создателя из группы
    if user_id == group["creator_id"]:
        conn.close()
        raise HTTPException(400, detail="Cannot remove group creator")

    # Удаляем пользователя из группы
    cursor.execute("DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?", (group_id, user_id))
    conn.commit()
    conn.close()

    return {"detail": "User removed from group"}

@app.delete("/messages/{chat_id}/clear")
async def clear_chat_history(chat_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    # Проверяем, что пользователь состоит в этом чате
    cursor.execute("SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?", (chat_id, user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(403, "User not in chat")

    # Удаляем все сообщения в чате
    cursor.execute("DELETE FROM messages WHERE chat_id = ?", (chat_id,))
    conn.commit()
    conn.close()

    return {"detail": "Chat history cleared"}


@app.delete("/chats/{chat_id}/leave")
async def leave_chat(chat_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    # Проверяем, что чат существует и что это личный чат (не группа)
    cursor.execute("SELECT is_group FROM chats WHERE id = ?", (chat_id,))
    chat = cursor.fetchone()
    if not chat:
        conn.close()
        raise HTTPException(404, "Chat not found")
    if chat["is_group"]:
        conn.close()
        raise HTTPException(400, "This endpoint is only for one-on-one chats")

    # Проверяем, что пользователь состоит в чате
    cursor.execute("SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?", (chat_id, user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(403, "User not in chat")

    # Получаем ID второго участника чата
    cursor.execute("SELECT user_id FROM chat_members WHERE chat_id = ? AND user_id != ?", (chat_id, user["id"]))
    other_user = cursor.fetchone()
    other_user_id = other_user["user_id"] if other_user else None

    # Удаляем связь пользователя с чатом
    cursor.execute("DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?", (chat_id, user["id"]))

    # Удаляем контакт между пользователями, если есть второй участник
    if other_user_id:
        cursor.execute("DELETE FROM contacts WHERE (user_id = ? AND contact_id = ?) OR (user_id = ? AND contact_id = ?)",
                       (user["id"], other_user_id, other_user_id, user["id"]))

    # Удаляем все сообщения в этом чате
    cursor.execute("DELETE FROM messages WHERE chat_id = ?", (chat_id,))

    conn.commit()

    # Проверяем, остался ли кто-то в чате
    cursor.execute("SELECT COUNT(*) as cnt FROM chat_members WHERE chat_id = ?", (chat_id,))
    count = cursor.fetchone()["cnt"]
    if count == 0:
        # Если никого нет — удаляем чат
        cursor.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
        conn.commit()

    conn.close()
    return {"detail": "Chat, contacts and messages deleted for user"}
