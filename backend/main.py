from datetime import datetime
import json
import os
from pathlib import Path
import shutil

from fastapi import FastAPI, Depends, HTTPException, Request, Form, Response, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from passlib.hash import bcrypt
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import crud, schemas
from .database import SessionLocal, engine
from .models import Base, User, Chat, ChatMember, Friend, Message

app = FastAPI()
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
templates = Jinja2Templates(directory="frontend/templates")

Base.metadata.create_all(bind=engine)

def get_db():
    """Создает и возвращает сессию базы данных."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Получает текущего пользователя из cookies."""
    user_id = request.cookies.get("user_id")
    if not user_id:
        return None
    try:
        user = db.query(User).filter_by(id=int(user_id)).first()
        return user
    except:
        return None

@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    """Перенаправляет на страницу входа."""
    return RedirectResponse("/login")

@app.get("/register", response_class=HTMLResponse)
def register_page(request: Request, current_user: User = Depends(get_current_user)):
    """Отображает страницу регистрации."""
    if current_user:
        return RedirectResponse("/main")
    return templates.TemplateResponse("register.html", {"request": request})

@app.post("/register")
def register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    password2: str = Form(...),
    db: Session = Depends(get_db)
):
    """Регистрирует нового пользователя."""
    if password != password2:
        raise HTTPException(status_code=400, detail="Пароли не совпадают")
    if db.query(User).filter_by(email=email).first():
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    hashed_password = bcrypt.hash(password)
    user = User(name=name, email=email, password=hashed_password)
    db.add(user)
    db.commit()
    return RedirectResponse("/login", status_code=303)

@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request, current_user: User = Depends(get_current_user)):
    """Отображает страницу входа."""
    if current_user:
        return RedirectResponse("/main")
    return templates.TemplateResponse("login.html", {"request": request})

@app.post("/login")
def login(
    response: Response,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """Аутентифицирует пользователя."""
    user = db.query(User).filter_by(email=email).first()
    if not user or not bcrypt.verify(password, user.password):
        raise HTTPException(status_code=400, detail="Неверный email или пароль")
    response = RedirectResponse("/main", status_code=303)
    response.set_cookie(key="user_id", value=str(user.id))
    return response

@app.get("/logout")
def logout():
    """Выходит из системы."""
    response = RedirectResponse("/login")
    response.delete_cookie("user_id")
    return response

@app.get("/main", response_class=HTMLResponse)
def main_page(request: Request, current_user: User = Depends(get_current_user)):
    """Отображает главную страницу."""
    if not current_user:
        return RedirectResponse("/login")
    return templates.TemplateResponse("main.html", {"request": request, "user": current_user})

@app.get("/api/chats")
def get_chats(request: Request, db: Session = Depends(get_db)):
    """Получает список чатов пользователя."""
    current_user_id = int(request.cookies.get("user_id", 0))
    
    chat_members = (
        db.query(ChatMember)
        .filter(ChatMember.user_id == current_user_id)
        .all()
    )
    
    result = []
    for member in chat_members:
        chat = db.query(Chat).filter(Chat.id == member.chat_id).first()
        if not chat:
            continue
            
        last_message = (
            db.query(Message)
            .filter(Message.chat_id == chat.id)
            .order_by(Message.timestamp.desc())
            .first()
        )
        
        if chat.is_group:
            chat_name = chat.name
            other_member_id = None
        else:
            other_member = (
                db.query(User)
                .join(ChatMember, User.id == ChatMember.user_id)
                .filter(
                    ChatMember.chat_id == chat.id,
                    ChatMember.user_id != current_user_id
                )
                .first()
            )
            chat_name = other_member.name if other_member else "Неизвестный пользователь"
            other_member_id = other_member.id if other_member else None

        result.append({
            "id": chat.id,
            "name": chat_name,
            "is_group": chat.is_group,
            "last_message": last_message.text if last_message else None,
            "last_message_time": last_message.timestamp.strftime("%H:%M") if last_message else None,
            "user_id": other_member_id
        })
    
    result.sort(
        key=lambda x: (x.get("last_message_time") is not None, x.get("last_message_time", "00:00"), x.get("id", 0)),
        reverse=True
    )
    
    return result

@app.get("/api/users")
def search_users(
    search: str = "", 
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Ищет пользователей по имени."""
    print(f"Поиск пользователей: '{search}'")
    current_user_id = int(request.cookies.get("user_id", 0))
    print(f"Текущий user_id: {current_user_id}")
    
    users = db.query(User).filter(
        User.name.ilike(f"%{search}%")
    ).all()
    
    print(f"Найдено пользователей: {len(users)}")
    
    friend_ids = {
        f.friend_id for f in db.query(Friend).filter_by(user_id=current_user_id).all()
    }
    
    result = [{
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "is_friend": u.id in friend_ids
    } for u in users]
    
    print(f"Результат: {result}")
    return result

@app.get("/api/messages")
def get_messages(chat_id: int, request: Request, db: Session = Depends(get_db)):
    """Получает сообщения чата и обновляет их статус прочтения."""
    current_user_id = int(request.cookies.get("user_id", 0))
    
    messages = (
        db.query(Message, User)
        .join(User, Message.user_id == User.id)
        .filter(Message.chat_id == chat_id)
        .order_by(Message.timestamp)
        .all()
    )
    
    for message, _ in messages:
        if message.user_id != current_user_id and message.status != "read":
            message.status = "read"
    
    db.commit()
    
    return [
        {
            "id": m.id,
            "user_id": m.user_id,
            "user_name": u.name,
            "text": m.text,
            "timestamp": m.timestamp.strftime("%H:%M"),
            "status": m.status,
            "edited": m.edited,
            "is_mine": m.user_id == current_user_id
        }
        for m, u in messages
    ]

@app.post("/api/messages")
def send_message(
    chat_id: int = Form(...),
    text: str = Form(...),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Отправляет новое сообщение в чат."""
    user_id = int(request.cookies.get("user_id", 0))
    msg = Message(
        chat_id=chat_id,
        user_id=user_id,
        text=text,
        timestamp=datetime.now(),
        status="sent",
        edited=False
    )
    db.add(msg)
    db.commit()
    return {"ok": True}

@app.get("/users", response_class=HTMLResponse)
def users_page(request: Request, current_user: User = Depends(get_current_user)):
    """Отображает страницу пользователей."""
    if not current_user:
        return RedirectResponse("/login")
    return templates.TemplateResponse("users.html", {"request": request})

@app.get("/friends", response_class=HTMLResponse)
def friends_page(request: Request, current_user: User = Depends(get_current_user)):
    """Отображает страницу друзей."""
    if not current_user:
        return RedirectResponse("/login")
    return templates.TemplateResponse("friends.html", {"request": request})

@app.get("/chat/{chat_id}", response_class=HTMLResponse)
def chat_page(chat_id: int, request: Request, current_user: User = Depends(get_current_user)):
    """Отображает страницу чата."""
    if not current_user:
        return RedirectResponse("/login")
    return templates.TemplateResponse("chat.html", {"request": request, "chat_id": chat_id})

@app.get("/profile", response_class=HTMLResponse)
def profile_page(request: Request, current_user: User = Depends(get_current_user)):
    """Отображает страницу профиля."""
    if not current_user:
        return RedirectResponse("/login")
    return templates.TemplateResponse("profile.html", {"request": request, "user": current_user})

@app.get("/api/friends")
def get_friends(request: Request, db: Session = Depends(get_db)):
    """Получает список друзей пользователя."""
    user_id = int(request.cookies.get("user_id", 0))
    friends = db.query(User).join(Friend, User.id == Friend.friend_id).filter(Friend.user_id == user_id).all()
    return [{"id": f.id, "name": f.name} for f in friends]

@app.post("/api/friends/{friend_id}")
def add_friend(friend_id: int, request: Request, db: Session = Depends(get_db)):
    """Добавляет пользователя в друзья."""
    user_id = int(request.cookies.get("user_id", 0))
    friendship = Friend(user_id=user_id, friend_id=friend_id)
    db.add(friendship)
    db.commit()
    return {"ok": True}

@app.delete("/api/friends/{friend_id}")
def remove_friend(friend_id: int, request: Request, db: Session = Depends(get_db)):
    """Удаляет пользователя из друзей."""
    user_id = int(request.cookies.get("user_id", 0))
    db.query(Friend).filter_by(user_id=user_id, friend_id=friend_id).delete()
    db.commit()
    return {"ok": True}

UPLOAD_DIR = Path("frontend/static/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@app.post("/api/groups/create")
async def create_group_chat(
    request: Request,
    db: Session = Depends(get_db)
):
    """Создает новый групповой чат."""
    current_user_id = int(request.cookies.get("user_id", 0))
    form_data = await request.form()
    
    name = form_data.get("name")
    member_ids = json.loads(form_data.get("member_ids", "[]"))
    description = form_data.get("description")
    
    avatar_path = None
    avatar_file = form_data.get("avatar")
    if avatar_file and isinstance(avatar_file, UploadFile):
        file_extension = os.path.splitext(avatar_file.filename)[1]
        unique_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{current_user_id}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(avatar_file.file, buffer)
        
        avatar_path = f"/static/uploads/{unique_filename}"
    
    chat = Chat(
        name=name,
        is_group=True,
        owner_id=current_user_id,
        avatar=avatar_path,
        description=description,
        created_at=datetime.now()
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    
    members = [
        ChatMember(
            chat_id=chat.id,
            user_id=current_user_id,
            role="owner",
            joined_at=datetime.now()
        )
    ]
    
    for user_id in member_ids:
            members.append(ChatMember(
                chat_id=chat.id,
                user_id=user_id,
                role="member",
                joined_at=datetime.now()
            ))
    
    db.bulk_save_objects(members)
    db.commit()
    
    return {"chat_id": chat.id}

@app.get("/api/groups/{group_id}")
def get_group_info(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Получает информацию о групповом чате."""
    current_user_id = int(request.cookies.get("user_id", 0))
    chat = crud.get_group_chat(db, group_id)
    
    if not chat:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    member = db.query(ChatMember).filter(
        ChatMember.chat_id == group_id,
        ChatMember.user_id == current_user_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="Вы не являетесь участником этой группы")
    
    members = crud.get_group_members(db, group_id)
    
    return {
        "id": chat.id,
        "name": chat.name,
        "avatar": chat.avatar,
        "description": chat.description,
        "owner_id": chat.owner_id,
        "created_at": chat.created_at,
        "members": [
            {
                "user_id": m.user_id,
                "role": m.role,
                "name": db.query(User).filter(User.id == m.user_id).first().name
            }
            for m in members
        ]
    }

@app.put("/api/groups/{group_id}")
async def update_group_info(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Обновляет информацию о групповом чате."""
    current_user_id = int(request.cookies.get("user_id", 0))
    form_data = await request.form()
    
    chat = crud.get_group_chat(db, group_id)
    if not chat or chat.owner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для редактирования группы")
    
    avatar_path = None
    avatar_file = form_data.get("avatar")
    if avatar_file and isinstance(avatar_file, UploadFile):
        file_extension = os.path.splitext(avatar_file.filename)[1]
        unique_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{current_user_id}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(avatar_file.file, buffer)
        
        avatar_path = f"/static/uploads/{unique_filename}"
    
    update_data = schemas.GroupChatUpdate(
        name=form_data.get("name"),
        avatar=avatar_path,
        description=form_data.get("description")
    )
    
    updated_chat = crud.update_group_chat(db, group_id, update_data)
    return {"ok": True}

@app.delete("/api/groups/{group_id}")
def delete_group(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Удаляет групповой чат."""
    current_user_id = int(request.cookies.get("user_id", 0))
    
    chat = crud.get_group_chat(db, group_id)
    if not chat or chat.owner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для удаления группы")
    
    crud.delete_group_chat(db, group_id)
    return {"ok": True}

@app.post("/api/groups/{group_id}/members")
async def add_group_members(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Добавляет участников в групповой чат."""
    current_user_id = int(request.cookies.get("user_id", 0))
    form_data = await request.form()
    
    chat = crud.get_group_chat(db, group_id)
    if not chat or chat.owner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для добавления участников")
    
    user_ids = json.loads(form_data.get("user_ids", "[]"))
    crud.add_group_members(db, group_id, user_ids)
    return {"ok": True}

@app.delete("/api/groups/{group_id}/members")
async def remove_group_members(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Удаляет участников из группового чата."""
    current_user_id = int(request.cookies.get("user_id", 0))
    form_data = await request.form()
    
    chat = crud.get_group_chat(db, group_id)
    if not chat or chat.owner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для удаления участников")
    
    user_ids = json.loads(form_data.get("user_ids", "[]"))
    crud.remove_group_members(db, group_id, user_ids)
    return {"ok": True}

@app.post("/api/profile")
def update_profile(
    name: str = Form(...),
    email: str = Form(...),
    current_password: str = Form(None),
    new_password: str = Form(None),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Обновляет профиль пользователя."""
    user_id = int(request.cookies.get("user_id", 0))
    user = db.query(User).filter_by(id=user_id).first()
    
    if current_password and new_password:
        if not bcrypt.verify(current_password, user.password):
            raise HTTPException(status_code=400, detail="Неверный текущий пароль")
        user.password = bcrypt.hash(new_password)
    
    user.name = name
    user.email = email
    db.commit()
    return {"ok": True}

@app.post("/api/chats/create")
async def create_chat(
    request: Request,
    db: Session = Depends(get_db)
):
    """Создает новый личный чат."""
    current_user_id = int(request.cookies.get("user_id", 0))
    data = await request.json()
    other_user_id = data.get("user_id")
    
    existing_chat = (
        db.query(Chat)
        .join(ChatMember, Chat.id == ChatMember.chat_id)
        .filter(
            Chat.is_group == False,
            ChatMember.user_id.in_([current_user_id, other_user_id])
        )
        .group_by(Chat.id)
        .having(func.count(ChatMember.user_id) == 2)
        .first()
    )
    
    if existing_chat:
        return {"id": existing_chat.id}
    
    chat = Chat(
        name=data.get("name"),
        is_group=False,
        owner_id=current_user_id
    )
    db.add(chat)
    db.commit()
    
    members = [
        ChatMember(chat_id=chat.id, user_id=current_user_id),
        ChatMember(chat_id=chat.id, user_id=other_user_id)
    ]
    db.bulk_save_objects(members)
    db.commit()
    
    return {"id": chat.id}

@app.get("/api/chats/{chat_id}")
def get_chat(
    chat_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Получает информацию о чате."""
    current_user_id = int(request.cookies.get("user_id", 0))
    chat = db.query(Chat).filter_by(id=chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
        
    is_member = db.query(ChatMember).filter_by(
        chat_id=chat_id,
        user_id=current_user_id
    ).first()
    
    if not is_member:
        raise HTTPException(status_code=403, detail="Нет доступа к чату")
        
    return {
        "id": chat.id,
        "name": chat.name,
        "is_group": chat.is_group,
        "owner_id": chat.owner_id
    }

@app.get("/create-group", response_class=HTMLResponse)
def create_group_page(request: Request, current_user: User = Depends(get_current_user)):
    """Отображает страницу создания группы."""
    if not current_user:
        return RedirectResponse("/login")
    return templates.TemplateResponse("create_group.html", {"request": request})

@app.get("/group/{group_id}/settings", response_class=HTMLResponse)
def group_settings_page(
    group_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отображает страницу настроек группы."""
    if not current_user:
        return RedirectResponse("/login")
    
    chat = crud.get_group_chat(db, group_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    member = db.query(ChatMember).filter(
        ChatMember.chat_id == group_id,
        ChatMember.user_id == current_user.id
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="Вы не являетесь участником этой группы")
    
    members = crud.get_group_members(db, group_id)
    members_info = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        members_info.append({
            "user_id": m.user_id,
            "name": user.name,
            "role": m.role
        })
    
    return templates.TemplateResponse(
        "group_settings.html",
        {
            "request": request,
            "group": {
                "id": chat.id,
                "name": chat.name,
                "avatar": chat.avatar,
                "description": chat.description,
                "owner_id": chat.owner_id,
                "created_at": chat.created_at,
                "members": members_info
            },
            "current_user": current_user
        }
    )

@app.put("/api/messages/{message_id}/read")
def mark_message_read(message_id: int, request: Request, db: Session = Depends(get_db)):
    """Помечает сообщение как прочитанное."""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
    
    message.status = "read"
    db.commit()
    return {"ok": True}

@app.put("/api/messages/{message_id}")
def edit_message(
    message_id: int,
    text: str = Form(...),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Редактирует сообщение."""
    current_user_id = int(request.cookies.get("user_id", 0))
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
    
    if message.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для редактирования")
    
    message.text = text
    message.edited = True
    db.commit()
    return {"ok": True}

@app.delete("/api/messages/{message_id}")
def delete_message(
    message_id: int,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Удаляет сообщение."""
    current_user_id = int(request.cookies.get("user_id", 0))
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
    
    if message.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для удаления")
    
    db.delete(message)
    db.commit()
    return {"ok": True}
