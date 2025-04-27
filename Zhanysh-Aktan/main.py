import sqlite3
import uuid
from fastapi import FastAPI, WebSocket, HTTPException, Depends, status, Request, File, UploadFile, Form, Query
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import List, Dict
from pydantic import BaseModel
import json
import os
import shutil
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Ensure avatars directory exists
AVATARS_DIR = "static/avatars"
if not os.path.exists(AVATARS_DIR):
    os.makedirs(AVATARS_DIR)

# SMTP Configuration
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "tynybekovjanyshbek@gmail.com"
SMTP_PASSWORD = "icbvlisqskeunccq"

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
RESET_TOKEN_EXPIRE_MINUTES = 60  # Password reset token valid for 60 minutes

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

class User(BaseModel):
    username: str
    email: str
    mobile: str | None = None
    date_of_birth: str | None = None
    password: str | None = None
    avatar_url: str | None = None

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Message(BaseModel):
    content: str
    timestamp: str
    sender_id: int
    receiver_id: int | None = None
    group_id: int | None = None
    username: str
    avatar_url: str | None = None
    is_read: bool = False

class RecentChat(BaseModel):
    user_id: int | None = None
    group_id: int | None = None
    username: str
    avatar_url: str | None = None
    unread_count: int
    is_group: bool = False

class GroupCreate(BaseModel):
    name: str
    description: str | None = None
    member_ids: List[int]

class Group(BaseModel):
    id: int
    name: str
    description: str | None = None
    avatar_url: str | None = None
    creator_id: int
    created_at: str

class GroupInfo(BaseModel):
    id: int
    name: str
    description: str | None = None
    avatar_url: str | None = None
    creator: dict
    members: List[dict]

def init_db():
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            mobile TEXT,
            date_of_birth TEXT,
            hashed_password TEXT NOT NULL,
            avatar_url TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            group_id INTEGER,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id),
            FOREIGN KEY (group_id) REFERENCES groups(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            avatar_url TEXT,
            creator_id INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (creator_id) REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_members (
            group_id INTEGER,
            user_id INTEGER,
            PRIMARY KEY (group_id, user_id),
            FOREIGN KEY (group_id) REFERENCES groups(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token TEXT PRIMARY KEY,
            user_id INTEGER,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()

init_db()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):  
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

manager = ConnectionManager()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_reset_token(user_id: int):
    token = str(uuid.uuid4())
    expires_at = (datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)).isoformat()
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at)
    )
    conn.commit()
    conn.close()
    return token

def send_reset_email(email: str, reset_link: str):
    # Create the email message
    msg = MIMEMultipart()
    msg['From'] = SMTP_USER
    msg['To'] = email
    msg['Subject'] = "Сброс пароля для вашей учетной записи"

    body = f"""
    Здравствуйте,

    Вы запросили сброс пароля для вашей учетной записи. Пожалуйста, перейдите по следующей ссылке, чтобы сбросить пароль:

    {reset_link}

    Ссылка действительна в течение {RESET_TOKEN_EXPIRE_MINUTES} минут. Если вы не запрашивали сброс пароля, проигнорируйте это письмо.

    С уважением,
    Команда приложения
    """
    msg.attach(MIMEText(body, 'plain'))

    try:
        # Connect to the SMTP server
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()  # Enable TLS
        server.login(SMTP_USER, SMTP_PASSWORD)

        # Send the email
        server.sendmail(SMTP_USER, email, msg.as_string())
        server.quit()
        print(f"Email успешно отправлен на {email} с ссылкой: {reset_link}")
    except Exception as e:
        print(f"Ошибка отправки email: {e}")
        raise HTTPException(status_code=500, detail=f"Не удалось отправить email: {str(e)}")

async def get_current_user(request: Request, token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = payload.get("sub")
            if user_id is None:
                raise credentials_exception
        except JWTError as e:
            print(f"JWT Error: {e}")
            raise credentials_exception
    else:
        token = request.query_params.get("token")
        if not token:
            raise credentials_exception
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = payload.get("sub")
            if user_id is None:
                raise credentials_exception
        except JWTError as e:
            print(f"JWT Error: {e}")
            raise credentials_exception

    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, mobile, date_of_birth, avatar_url FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    if user is None:
        raise credentials_exception
    return {"id": user[0], "username": user[1], "email": user[2], "mobile": user[3], "date_of_birth": user[4], "avatar_url": user[5]}

@app.get("/", response_class=HTMLResponse)
async def get_signin():
    with open("signin.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/signup", response_class=HTMLResponse)
async def get_signup():
    with open("signup.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/forgot-password", response_class=HTMLResponse)
async def get_forgot_password():
    with open("forgot-password.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.post("/forgot-password")
async def forgot_password(email: str = Form(...)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Пользователь с таким email не найден")
    
    user_id = user[0]
    reset_token = create_reset_token(user_id)
    reset_link = f"http://localhost:8000/reset-password?token={reset_token}"
    
    # Send the reset link via email
    send_reset_email(email, reset_link)
    
    conn.close()
    return {"message": "Ссылка для сброса пароля отправлена на ваш email"}

@app.get("/reset-password", response_class=HTMLResponse)
async def get_reset_password(request: Request):
    token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Токен для сброса пароля отсутствует")
    
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?", (token,))
    token_data = cursor.fetchone()
    if not token_data:
        conn.close()
        raise HTTPException(status_code=400, detail="Недействительный токен для сброса пароля")
    
    user_id, expires_at = token_data
    expires_at = datetime.fromisoformat(expires_at)
    if datetime.utcnow() > expires_at:
        cursor.execute("DELETE FROM password_reset_tokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=400, detail="Срок действия токена истёк")
    
    conn.close()
    with open("reset-password.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.post("/reset-password")
async def reset_password(
    token: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...)
):
    if new_password != confirm_password:
        raise HTTPException(status_code=400, detail="Пароли не совпадают")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен содержать минимум 6 символов")

    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?", (token,))
    token_data = cursor.fetchone()
    if not token_data:
        conn.close()
        raise HTTPException(status_code=400, detail="Недействительный токен для сброса пароля")
    
    user_id, expires_at = token_data
    expires_at = datetime.fromisoformat(expires_at)
    if datetime.utcnow() > expires_at:
        cursor.execute("DELETE FROM password_reset_tokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=400, detail="Срок действия токена истёк")
    
    hashed_password = get_password_hash(new_password)
    cursor.execute(
        "UPDATE users SET hashed_password = ? WHERE id = ?",
        (hashed_password, user_id)
    )
    cursor.execute("DELETE FROM password_reset_tokens WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    return {"message": "Пароль успешно сброшен"}

@app.get("/chat", response_class=HTMLResponse)
async def get_chat(request: Request, current_user: dict = Depends(get_current_user)):
    with open("chat.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/my-profile", response_class=HTMLResponse)
async def get_profile(request: Request, current_user: dict = Depends(get_current_user)):
    with open("my-profile.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/profile/{user_id}", response_class=HTMLResponse)
async def get_user_profile(user_id: int, request: Request, current_user: dict = Depends(get_current_user)):
    with open("profile.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/edit-profile", response_class=HTMLResponse)
async def get_edit_profile(request: Request, current_user: dict = Depends(get_current_user)):
    with open("edit-profile.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/favicon.ico", response_class=FileResponse)
async def favicon():
    favicon_path = os.path.join("static", "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    raise HTTPException(status_code=404, detail="Favicon not found")

@app.get("/users/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return current_user

@app.get("/users/search")
async def search_users(
    query: str = Query(..., min_length=2, description="Search query for users"),
    current_user: dict = Depends(get_current_user)
):
    print(f"Received search query: {query}")
    if len(query.strip()) < 2:
        raise HTTPException(status_code=422, detail="Query must be at least 2 characters long")
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 10",
        (f"%{query}%", current_user["id"])
    )
    users = [{"id": user[0], "username": user[1]} for user in cursor.fetchall()]
    print(f"Found users: {users}")
    conn.close()
    return users

@app.get("/users/{user_id}")
async def get_user_info(user_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, email, mobile, date_of_birth, avatar_url FROM users WHERE id = ?",
        (user_id,)
    )
    user = cursor.fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user[0],
        "username": user[1],
        "email": user[2],
        "mobile": user[3],
        "date_of_birth": user[4],
        "avatar_url": user[5]
    }

@app.put("/users/me")
async def update_user(
    username: str = Form(...),
    mobile: str = Form(None),
    date_of_birth: str = Form(None),
    avatar: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    if not username or len(username) < 3:
        conn.close()
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long")
    if mobile and not mobile.replace(" ", "").replace("-", "").replace("+", "").isdigit():
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    print(f"Received date_of_birth: {date_of_birth}")
    
    if date_of_birth:
        try:
            datetime.strptime(date_of_birth, "%Y-%m-%d")
        except ValueError as e:
            print(f"Date validation error: {e}")
            conn.close()
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    
    cursor.execute("SELECT id FROM users WHERE username = ? AND id != ?", (username, current_user['id']))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already taken")
    
    avatar_url = current_user.get('avatar_url')
    if avatar:
        if avatar.content_type not in ["image/jpeg", "image/png"]:
            conn.close()
            raise HTTPException(status_code=400, detail="Only JPEG or PNG images are allowed")
        filename = f"{current_user['id']}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{avatar.filename}"
        file_path = os.path.join(AVATARS_DIR, filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(avatar.file, f)
        avatar_url = f"/static/avatars/{filename}"
    
    cursor.execute(
        "UPDATE users SET username = ?, mobile = ?, date_of_birth = ?, avatar_url = ? WHERE id = ?",
        (username, mobile, date_of_birth, avatar_url, current_user['id'])
    )
    conn.commit()
    conn.close()
    return {"message": "Profile updated successfully"}

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, hashed_password FROM users WHERE username = ?", (form_data.username,))
    user = cursor.fetchone()
    conn.close()
    if not user or not verify_password(form_data.password, user[2]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": str(user[0])})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/signup")
async def signup(user: User):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        hashed_password = get_password_hash(user.password)
        cursor.execute(
            "INSERT INTO users (username, email, mobile, date_of_birth, hashed_password, avatar_url) VALUES (?, ?, ?, ?, ?, ?)",
            (user.username, user.email, user.mobile, user.date_of_birth, hashed_password, None)
        )
        conn.commit()
        return {"message": "User created successfully"}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Username or email already exists")
    finally:
        conn.close()

@app.post("/groups")
async def create_group(
    name: str = Form(...),
    description: str = Form(None),
    member_ids: str = Form(...),
    avatar: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        try:
            member_ids_list = json.loads(member_ids)
            if not isinstance(member_ids_list, list):
                raise ValueError("member_ids must be a list")
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid member_ids format, must be a JSON list")

        if not name or len(name) < 3:
            raise HTTPException(status_code=400, detail="Group name must be at least 3 characters long")
        cursor.execute("SELECT id FROM users WHERE id IN ({})".format(','.join(['?']*len(member_ids_list))), member_ids_list)
        existing_users = [row[0] for row in cursor.fetchall()]
        if len(existing_users) != len(member_ids_list):
            raise HTTPException(status_code=400, detail="One or more user IDs are invalid")

        avatar_url = None
        if avatar:
            if avatar.content_type not in ["image/jpeg", "image/png"]:
                raise HTTPException(status_code=400, detail="Only JPEG or PNG images are allowed")
            filename = f"group_{datetime.now().strftime('%Y%m%d%H%M%S')}_{avatar.filename}"
            file_path = os.path.join(AVATARS_DIR, filename)
            with open(file_path, "wb") as f:
                shutil.copyfileobj(avatar.file, f)
            avatar_url = f"/static/avatars/{filename}"

        cursor.execute(
            "INSERT INTO groups (name, description, avatar_url, creator_id, created_at) VALUES (?, ?, ?, ?, ?)",
            (name, description, avatar_url, current_user["id"], datetime.utcnow().isoformat())
        )
        group_id = cursor.lastrowid
        member_ids_set = set(member_ids_list + [current_user["id"]])
        cursor.executemany(
            "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
            [(group_id, user_id) for user_id in member_ids_set]
        )
        conn.commit()
        return {"message": "Group created successfully", "group_id": group_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/groups/{group_id}/leave")
async def leave_group(group_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, current_user["id"])
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Not a member of this group")

        cursor.execute(
            "SELECT creator_id FROM groups WHERE id = ?",
            (group_id,)
        )
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if group[0] == current_user["id"]:
            raise HTTPException(status_code=400, detail="Creator cannot leave the group")

        cursor.execute(
            "DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, current_user["id"])
        )
        cursor.execute(
            "DELETE FROM messages WHERE group_id = ? AND sender_id = ?",
            (group_id, current_user["id"])
        )
        conn.commit()
        return {"message": "Successfully left the group"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/groups/{group_id}/add-member")
async def add_group_member(group_id: int, user_id: int = Form(...), current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT creator_id FROM groups WHERE id = ?",
            (group_id,)
        )
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if group[0] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Only the group creator can add members")

        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, user_id)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="User is already a member of this group")

        cursor.execute(
            "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
            (group_id, user_id)
        )
        conn.commit()
        return {"message": "User added to group successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/groups/{group_id}/remove-member")
async def remove_group_member(group_id: int, user_id: int = Form(...), current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT creator_id FROM groups WHERE id = ?",
            (group_id,)
        )
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if group[0] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Only the group creator can remove members")

        if user_id == current_user["id"]:
            raise HTTPException(status_code=400, detail="Creator cannot remove themselves")

        cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, user_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="User is not a member of this group")

        cursor.execute(
            "DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, user_id)
        )
        cursor.execute(
            "DELETE FROM messages WHERE group_id = ? AND sender_id = ?",
            (group_id, user_id)
        )
        conn.commit()
        return {"message": "User removed from group successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/groups", response_model=List[Group])
async def get_groups(current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT g.id, g.name, g.description, g.avatar_url, g.creator_id, g.created_at
        FROM groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
        """,
        (current_user["id"],)
    )
    groups = [
        {"id": row[0], "name": row[1], "description": row[2], "avatar_url": row[3], "creator_id": row[4], "created_at": row[5]}
        for row in cursor.fetchall()
    ]
    conn.close()
    return groups

@app.get("/groups/{group_id}/info", response_model=GroupInfo)
async def get_group_info(group_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, current_user["id"])
        )
        membership = cursor.fetchone()
        print(f"Проверка членства: group_id={group_id}, user_id={current_user['id']}, result={membership}")
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this group")

        cursor.execute(
            """
            SELECT g.id, g.name, g.description, g.avatar_url, g.creator_id
            FROM groups g
            WHERE g.id = ?
            """,
            (group_id,)
        )
        group = cursor.fetchone()
        print(f"Группа: {group}")
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")

        cursor.execute(
            "SELECT id, username, avatar_url FROM users WHERE id = ?",
            (group[4],)
        )
        creator = cursor.fetchone()
        print(f"Создатель: {creator}")
        if not creator:
            raise HTTPException(status_code=404, detail="Creator not found")

        cursor.execute(
            """
            SELECT u.id, u.username, u.avatar_url
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?
            """,
            (group_id,)
        )
        members = [
            {"id": row[0], "username": row[1], "avatar_url": row[2]}
            for row in cursor.fetchall()
        ]
        print(f"Участники группы {group_id}: {members}")

        cursor.execute(
            "SELECT COUNT(*) FROM group_members WHERE group_id = ?",
            (group_id,)
        )
        member_count = cursor.fetchone()[0]
        print(f"Количество участников группы {group_id}: {member_count}")

        conn.close()
        return {
            "id": group[0],
            "name": group[1],
            "description": group[2],
            "avatar_url": group[3],
            "creator": {"id": creator[0], "username": creator[1], "avatar_url": creator[2]},
            "members": members,
            "member_count": member_count
        }
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to fetch group info: {str(e)}")

@app.get("/messages/recent", response_model=List[RecentChat])
async def get_recent_chats(current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT DISTINCT u.id, u.username, u.avatar_url,
                   (SELECT COUNT(*) FROM messages m2 
                    WHERE m2.receiver_id = ? AND m2.sender_id = u.id AND m2.is_read = 0) as unread_count,
                   0 as is_group
            FROM messages m
            JOIN users u ON (u.id = m.sender_id OR u.id = m.receiver_id)
            WHERE (m.sender_id = ? OR m.receiver_id = ?) AND u.id != ? AND m.group_id IS NULL
            ORDER BY m.timestamp DESC
            LIMIT 10
            """,
            (current_user["id"], current_user["id"], current_user["id"], current_user["id"])
        )
        private_chats = [
            {"user_id": row[0], "username": row[1], "avatar_url": row[2], "unread_count": row[3], "is_group": False}
            for row in cursor.fetchall()
        ]

        cursor.execute(
            """
            SELECT g.id, g.name, g.avatar_url,
                   (SELECT COUNT(*) FROM messages m2 
                    WHERE m2.group_id = g.id AND m2.is_read = 0 AND m2.sender_id != ?) as unread_count,
                   1 as is_group
            FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            JOIN users u ON g.creator_id = u.id
            WHERE gm.user_id = ?
            ORDER BY g.created_at DESC
            LIMIT 10
            """,
            (current_user["id"], current_user["id"])
        )
        group_chats = [
            {"group_id": row[0], "username": row[1], "avatar_url": row[2], "unread_count": row[3], "is_group": True}
            for row in cursor.fetchall()
        ]

        chats = private_chats + group_chats
        chats.sort(key=lambda x: x["unread_count"], reverse=True)
        conn.close()
        return chats[:10]
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to fetch recent chats: {str(e)}")

@app.get("/messages/{receiver_id}", response_model=List[Message])
async def get_messages(receiver_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT m.content, m.timestamp, m.sender_id, m.receiver_id, u.username, u.avatar_url, m.is_read
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.timestamp
            """,
            (current_user["id"], receiver_id, receiver_id, current_user["id"])
        )
        messages = [
            {
                "content": row[0],
                "timestamp": row[1],
                "sender_id": row[2],
                "receiver_id": row[3],
                "username": row[4],
                "avatar_url": row[5],
                "is_read": bool(row[6])
            }
            for row in cursor.fetchall()]
        conn.close()
        return messages
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to fetch messages: {str(e)}")

@app.get("/messages/group/{group_id}", response_model=List[Message])
async def get_group_messages(group_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, current_user["id"])
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Not a member of this group")
        cursor.execute(
            """
            SELECT m.content, m.timestamp, m.sender_id, m.receiver_id, u.username, u.avatar_url, m.is_read
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.group_id = ?
            ORDER BY m.timestamp
            """,
            (group_id,)
        )
        messages = [
            {
                "content": row[0],
                "timestamp": row[1],
                "sender_id": row[2],
                "receiver_id": row[3],
                "username": row[4],
                "avatar_url": row[5],
                "is_read": bool(row[6])
            }
            for row in cursor.fetchall()]
        conn.close()
        return messages
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to fetch group messages: {str(e)}")

@app.post("/messages/{receiver_id}/mark-read")
async def mark_messages_as_read(receiver_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE messages
            SET is_read = 1
            WHERE receiver_id = ? AND sender_id = ?
            """,
            (current_user["id"], receiver_id)
        )
        conn.commit()
        conn.close()
        return {"message": "Messages marked as read"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to mark messages as read: {str(e)}")

@app.post("/messages/group/{group_id}/mark-read")
async def mark_group_messages_as_read(group_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE messages
            SET is_read = 1
            WHERE group_id = ? AND sender_id != ?
            """,
            (group_id, current_user["id"])
        )
        conn.commit()
        conn.close()
        return {"message": "Group messages marked as read"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to mark group messages as read: {str(e)}")

@app.post("/messages/group/{group_id}/clear")
async def clear_group_messages(group_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, current_user["id"])
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Not a member of this group")
        cursor.execute(
            "DELETE FROM messages WHERE group_id = ? AND sender_id = ?",
            (group_id, current_user["id"])
        )
        conn.commit()
        conn.close()
        return {"message": "Group chat cleared for user"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear group messages: {str(e)}")
    finally:
        conn.close()

@app.post("/messages/{receiver_id}/clear")
async def clear_private_messages(receiver_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            DELETE FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            """,
            (current_user["id"], receiver_id, receiver_id, current_user["id"])
        )
        conn.commit()
        conn.close()
        return {"message": "Private chat cleared"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear private messages: {str(e)}")
    finally:
        conn.close()

@app.post("/messages/{receiver_id}/delete")
async def delete_private_chat(receiver_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            DELETE FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            """,
            (current_user["id"], receiver_id, receiver_id, current_user["id"])
        )
        conn.commit()
        conn.close()
        return {"message": "Private chat deleted"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete private chat: {str(e)}")
    finally:
        conn.close()

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            conn = sqlite3.connect("chat.db")
            cursor = conn.cursor()
            is_group_message = "group_id" in message and message["group_id"]
            cursor.execute(
                "INSERT INTO messages (sender_id, receiver_id, group_id, content, timestamp, is_read) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    user_id,
                    message.get("receiver_id"),
                    message.get("group_id"),
                    message["content"],
                    datetime.utcnow().isoformat(),
                    0
                )
            )
            conn.commit()
            cursor.execute("SELECT username, avatar_url FROM users WHERE id = ?", (user_id,))
            user_data = cursor.fetchone()
            username = user_data[0]
            avatar_url = user_data[1]
            message_data = {
                "content": message["content"],
                "timestamp": datetime.utcnow().isoformat(),
                "sender_id": user_id,
                "receiver_id": message.get("receiver_id"),
                "group_id": message.get("group_id"),
                "username": username,
                "avatar_url": avatar_url,
                "is_read": False
            }
            if is_group_message:
                cursor.execute("SELECT user_id FROM group_members WHERE group_id = ?", (message["group_id"],))
                member_ids = [row[0] for row in cursor.fetchall()]
                for member_id in member_ids:
                    await manager.send_personal_message(message_data, member_id)
            else:
                await manager.send_personal_message(message_data, user_id)
                await manager.send_personal_message(message_data, message["receiver_id"])
            conn.close()
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)