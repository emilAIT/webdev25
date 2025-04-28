from fastapi import APIRouter, Request, Form, HTTPException, WebSocket, Depends, logger
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from db import get_db
import sqlite3
from models import User, Message, Contact
from typing import List
from datetime import datetime
from functools import wraps
from starlette.websockets import WebSocketDisconnect

router = APIRouter()
templates = Jinja2Templates(directory="templates")

# WebSocket connections
connected_users = {}

def auth_required(func):
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        user = request.session.get("user")
        if not user:
            return RedirectResponse(url="/login", status_code=303)
        return await func(request, *args, **kwargs)
    return wrapper

@router.get("/")
async def root(request: Request):
    return RedirectResponse(url="/login", status_code=303)

# Register page
@router.get("/register", response_class=HTMLResponse)
async def register_get(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

# Handle register form
@router.post("/register")
async def register_post(request: Request, email: str = Form(...), password: str = Form(...)):
    if not email or not password:
        return templates.TemplateResponse(
            "register.html",
            {"request": request, "error": "Please fill in all fields"}
        )
    
    conn = get_db()
    try:
        cur = conn.cursor()
        # Check if user exists
        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        if cur.fetchone():
            return templates.TemplateResponse(
                "register.html",
                {"request": request, "error": "Email already registered"}
            )
        
        # Create new user
        cur.execute(
            "INSERT INTO users (email, password, status, theme) VALUES (?, ?, ?, ?)", 
            (email, password, "Online", "blue")
        )
        conn.commit()
        
        # Get created user for session
        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cur.fetchone()
        if user:
            user_dict = dict(zip([column[0] for column in cur.description], user))
            request.session["user"] = user_dict
            return RedirectResponse(url="/main", status_code=303)
            
        return RedirectResponse(url="/login", status_code=303)
    except Exception as e:
        return templates.TemplateResponse(
            "register.html",
            {"request": request, "error": str(e)}
        )
    finally:
        conn.close()

@router.get("/login", response_class=HTMLResponse)
async def login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

# Handle login form
@router.post("/login")
async def login_post(request: Request, email: str = Form(...), password: str = Form(...)):
    if not email or not password:
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Please fill in all fields"}
        )

    # Check if admin
    if email == "admin@gmail.com" and password == "adminpass":
        request.session["user"] = {
            "email": email,
            "role": "admin"
        }
        return RedirectResponse(url="/adminpanel", status_code=303)

    try:
        conn = get_db()
        cur = conn.cursor()
        
        # Get user and check status
        cur.execute("""
            SELECT id, email, first_name, last_name, status, action, theme
            FROM users 
            WHERE email = ? AND password = ?
        """, (email, password))
        
        user = cur.fetchone()
        
        if not user:
            return templates.TemplateResponse(
                "login.html",
                {"request": request, "error": "Invalid email or password"}
            )

        # Check if banned
        if user['action'] == 'banned':
            return templates.TemplateResponse(
                "login.html",
                {"request": request, "error": "Your account is blocked. Contact administrator."}
            )
        
        # Convert Row to dict
        user_dict = dict(user)
        
        # Update status only for active users
        cur.execute(
            "UPDATE users SET status = ? WHERE id = ?",
            ("Online", user_dict["id"])
        )
        conn.commit()
        
        # Save to session
        request.session["user"] = user_dict
        
        return RedirectResponse(url="/main", status_code=303)
        
    except Exception as e:
        print(f"Error during login: {str(e)}")
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "An error occurred during login"}
        )
    finally:
        conn.close()

@router.get("/adminpanel")
async def admin_panel(request: Request):
    user = request.session.get("user")
    if not user or user.get("role") != "admin":
        return RedirectResponse(url="/login", status_code=303)
    return templates.TemplateResponse("adminpanel.html", {"request": request})

@router.get("/api/contacts")
async def get_contacts(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                c.id,
                c.contact_id,
                c.contact_name,
                u.status,
                u.email
            FROM contacts c
            JOIN users u ON c.contact_id = u.id
            WHERE c.user_id = ?
            ORDER BY c.contact_name
        """, (user["id"],))
        
        contacts = []
        for row in cur.fetchall():
            contacts.append({
                'id': row['id'],
                'contact_id': row['contact_id'],
                'contact_name': row['contact_name'],
                'status': row['status'],
                'email': row['email']
            })
        return contacts
    finally:
        conn.close()

@router.get("/contacts", response_class=HTMLResponse)
@auth_required
async def contacts_page(request: Request):
    user = request.session.get("user")
    return templates.TemplateResponse("contacts.html", {"request": request, "user": user})

@router.get("/messages/{contact_id}")
async def get_messages(request: Request, contact_id: int):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                id,
                sender_id,
                receiver_id,
                content,
                timestamp
            FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) 
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY timestamp
        """, (user["id"], contact_id, contact_id, user["id"]))
        
        messages = [dict(row) for row in cur.fetchall()]
        return messages
    finally:
        conn.close()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await websocket.accept()
    connected_users[user_id] = websocket
    
    try:
        while True:
            try:
                data = await websocket.receive_json()
                message = data.get("message")
                receiver_id = data.get("receiver_id")
                
                if not message or not receiver_id:
                    continue
                
                # Сохраняем сообщение в БД
                conn = get_db()
                try:
                    cur = conn.cursor()
                    cur.execute("""
                        INSERT INTO messages (sender_id, receiver_id, content)
                        VALUES (?, ?, ?)
                    """, (user_id, receiver_id, message))
                    conn.commit()
                    message_id = cur.lastrowid
                    
                    # Получаем время сообщения
                    cur.execute("SELECT timestamp FROM messages WHERE id = ?", (message_id,))
                    timestamp = cur.fetchone()['timestamp']
                finally:
                    conn.close()
                
                # Формируем сообщение для отправки
                message_data = {
                    "id": message_id,
                    "sender_id": user_id,
                    "receiver_id": receiver_id,
                    "content": message,
                    "timestamp": timestamp
                }
                
                # Отправляем сообщение получателю
                if receiver_id in connected_users:
                    await connected_users[receiver_id].send_json(message_data)
                
                # Отправляем подтверждение отправителю
                await websocket.send_json(message_data)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"Error processing message: {str(e)}")
                break
                
    finally:
        if user_id in connected_users:
            del connected_users[user_id]
        await websocket.close()

@router.post("/addcontact")
async def add_contact(request: Request):
    data = await request.json()
    user = request.session.get("user")
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    conn = get_db()
    try:
        cur = conn.cursor()
        
        # Проверяем существование пользователя с указанным email
        cur.execute("SELECT id FROM users WHERE email = ?", (data["email"],))
        contact_user = cur.fetchone()
        
        if not contact_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Проверяем, не добавлен ли уже этот контакт
        cur.execute("""
            SELECT * FROM contacts 
            WHERE user_id = ? AND contact_id = ?
        """, (user["id"], contact_user["id"]))
        
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Contact already exists")
        
        # Формируем имя контакта
        contact_name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
        if not contact_name:
            contact_name = data["email"]
        
        # Добавляем новый контакт
        cur.execute("""
            INSERT INTO contacts (user_id, contact_id, contact_name) 
            VALUES (?, ?, ?)
        """, (
            user["id"], 
            contact_user["id"],
            contact_name
        ))
        conn.commit()
        
        return {"status": "success"}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/main", response_class=HTMLResponse)
@auth_required
async def main_page(request: Request):
    user = request.session.get("user")
    if not user:
        return RedirectResponse(url="/login", status_code=303)
    return templates.TemplateResponse("main.html", {"request": request, "user": user})

@router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)

@router.get("/api/all-contacts", response_class=JSONResponse)
async def get_all_contacts(request: Request):
    try:
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                c.id,
                c.user_id,
                c.contact_id,
                c.contact_name,
                u1.email as user_email,
                u2.email as contact_email
            FROM contacts c
            JOIN users u1 ON c.user_id = u1.id
            JOIN users u2 ON c.contact_id = u2.id
        """)
        
        contacts = cur.fetchall()
        
        contacts_list = [
            {
                'id': contact['id'],
                'user_id': contact['user_id'],
                'contact_id': contact['contact_id'],
                'contact_name': contact['contact_name'],
                'user_email': contact['user_email'],
                'contact_email': contact['contact_email']
            }
            for contact in contacts
        ]
        
        return JSONResponse(
            content={"contacts": contacts_list},
            status_code=200
        )
        
    except sqlite3.Error as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/api/user-contacts/{user_id}")
async def get_user_contacts(user_id: int):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                c.id,
                c.contact_id,
                c.contact_name,
                u.status
            FROM contacts c
            JOIN users u ON c.contact_id = u.id
            WHERE c.user_id = ?
            ORDER BY c.contact_name
        """, (user_id,))
        
        contacts = cur.fetchall()
        return [dict(contact) for contact in contacts]
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/api/chats")
async def get_chats(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    conn = get_db()
    try:
        cur = conn.cursor()
        # Получаем все контакты и чаты с сообщениями
        cur.execute("""
            WITH user_contacts AS (
                -- Получаем контакты пользователя
                SELECT DISTINCT
                    u.id as contact_id,
                    COALESCE(c.contact_name, u.email) as contact_name,
                    u.status,
                    u.email,
                    CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_contact
                FROM users u
                LEFT JOIN contacts c ON c.contact_id = u.id AND c.user_id = ?
                WHERE u.id != ? AND (
                    -- Пользователь есть в контактах
                    c.id IS NOT NULL OR
                    -- Есть сообщения между пользователями
                    EXISTS (
                        SELECT 1 FROM messages m 
                        WHERE (m.sender_id = u.id AND m.receiver_id = ?) 
                           OR (m.sender_id = ? AND m.receiver_id = u.id)
                    )
                )
            )
            SELECT * FROM user_contacts
            ORDER BY is_contact DESC, contact_name
        """, (user["id"], user["id"], user["id"], user["id"]))
        
        chats = []
        for row in cur.fetchall():
            chats.append({
                'contact_id': row['contact_id'],
                'contact_name': row['contact_name'],
                'status': row['status'] or 'Offline',
                'email': row['email'],
                'is_contact': bool(row['is_contact'])
            })
        return chats
    finally:
        conn.close()

@router.get("/api/profile")
async def api_get_profile(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, email, first_name, last_name, bio, status, theme FROM users WHERE id = ?", (user["id"],))
        user_row = cur.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(user_row)
    finally:
        conn.close()

@router.post("/api/profile")
async def api_update_profile(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    data = await request.json()
    conn = get_db()
    try:
        cur = conn.cursor()
        fields = []
        values = []
        if "first_name" in data:
            fields.append("first_name = ?")
            values.append(data["first_name"])
        if "last_name" in data:
            fields.append("last_name = ?")
            values.append(data["last_name"])
        if "bio" in data:
            fields.append("bio = ?")
            values.append(data["bio"])
        if "status" in data:
            fields.append("status = ?")
            values.append(data["status"])
        if "email" in data:
            fields.append("email = ?")
            values.append(data["email"])
        if "theme" in data:
            if data["theme"] not in ["light", "blue", "dark"]:
                raise HTTPException(status_code=400, detail="Invalid theme")
            fields.append("theme = ?")
            values.append(data["theme"])
        if not fields:
            raise HTTPException(status_code=400, detail="No data to update")
        values.append(user["id"])
        cur.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        # Update session
        cur.execute("SELECT id, email, first_name, last_name, bio, status, theme FROM users WHERE id = ?", (user["id"],))
        updated_user = cur.fetchone()
        if updated_user:
            request.session["user"] = dict(updated_user)
        return {"success": True}
    finally:
        conn.close()

@router.get("/api/user/{user_id}")
async def get_user_profile_by_id(user_id: int):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, first_name, last_name, bio, status, theme FROM users WHERE id = ?",
            (user_id,)
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(user)
    finally:
        conn.close()

@router.get("/api/group/{group_id}")
async def get_group_info(group_id: int):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT g.id, g.name, g.description, g.creator_id, u.first_name, u.last_name, u.email
            FROM groups g
            JOIN users u ON g.creator_id = u.id
            WHERE g.id = ?
        """, (group_id,))
        group = cur.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")

        cur.execute("""
            SELECT u.id, u.first_name, u.last_name, u.email
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?
        """, (group_id,))
        members = [dict(row) for row in cur.fetchall()]

        return {
            "id": group["id"],
            "name": group["name"],
            "description": group["description"],
            "creator": {
                "id": group["creator_id"],
                "first_name": group["first_name"],
                "last_name": group["last_name"],
                "email": group["email"]
            },
            "members": members
        }
    finally:
        conn.close()

@router.get("/api/user-groups")
async def get_user_groups(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT g.id, g.name, g.description
            FROM groups g
            LEFT JOIN group_members gm ON g.id = gm.group_id
            WHERE g.creator_id = ?
               OR gm.user_id = ?
        """, (user["id"], user["id"]))
        groups = [dict(row) for row in cur.fetchall()]
        return groups
    finally:
        conn.close()

@router.get("/new_group", response_class=HTMLResponse)
@auth_required
async def new_group_page(request: Request):
    user = request.session.get("user")
    return templates.TemplateResponse("new_group.html", {"request": request, "user": user})

@router.post("/api/create-group")
async def create_group(request: Request):
    data = await request.json()
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    name = data.get("name")
    description = data.get("description")
    members = data.get("members", [])
    if not name:
        raise HTTPException(status_code=400, detail="Group name required")
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO groups (name, description, creator_id) VALUES (?, ?, ?)",
            (name, description, user["id"])
        )
        group_id = cur.lastrowid
        all_members = set(members)
        all_members.add(user["id"])
        for member_id in all_members:
            cur.execute(
                "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
                (group_id, member_id)
            )
        conn.commit()
        return {"success": True, "group_id": group_id}
    finally:
        conn.close()

@router.post("/api/admin/ban-user/{user_id}")
async def ban_user(request: Request, user_id: int):
    admin = request.session.get("user")
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    if user_id == admin.get("id"):
        raise HTTPException(status_code=400, detail="Cannot ban yourself")
    
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT email FROM users WHERE id = ?", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        cur.execute(
            "UPDATE users SET action = 'banned', status = 'Offline' WHERE id = ?",
            (user_id,)
        )
        conn.commit()
        return {"success": True}
    finally:
        conn.close()

@router.post("/api/admin/unban-user/{user_id}")
async def unban_user(request: Request, user_id: int):
    admin = request.session.get("user")
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE users 
            SET action = 'active' 
            WHERE id = ?
        """, (user_id,))
        conn.commit()
        return {"success": True}
    finally:
        conn.close()

@router.get("/api/admin/dashboard-stats")
async def get_dashboard_stats(request: Request):
    user = request.session.get("user")
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    conn = get_db()
    try:
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM users WHERE status = 'Online'")
        active_users = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM messages WHERE timestamp >= datetime('now', '-24 hours')")
        messages_24h = cur.fetchone()[0]
        
        cur.execute("""
            SELECT strftime('%H', timestamp) as hour, COUNT(*) as count
            FROM messages
            WHERE timestamp >= datetime('now', '-24 hours')
            GROUP BY hour
            ORDER BY hour
        """)
        hourly_stats = [dict(row) for row in cur.fetchall()]
        
        cur.execute("SELECT COUNT(*) FROM users")
        total_users = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM groups")
        total_groups = cur.fetchone()[0]
        
        return {
            "active_users": active_users,
            "total_users": total_users,
            "messages_24h": messages_24h,
            "total_groups": total_groups,
            "hourly_stats": hourly_stats
        }
    finally:
        conn.close()

@router.get("/api/admin/users")
async def get_admin_users(request: Request):
    user = request.session.get("user")
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                id, 
                email, 
                first_name, 
                last_name, 
                status, 
                action,
                theme,
                (SELECT MAX(timestamp) FROM messages WHERE sender_id = users.id) as last_active
            FROM users
            WHERE email != 'admin@gmail.com'
        """)
        users = [
            {
                **dict(row),
                "last_active": row["last_active"] if row["last_active"] else None
            }
            for row in cur.fetchall()
        ]
        return users
    finally:
        conn.close()

@router.delete("/api/group/{group_id}")
async def delete_group(request: Request, group_id: int):
    admin = request.session.get("user")
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM group_members WHERE group_id = ?", (group_id,))
        cur.execute("DELETE FROM groups WHERE id = ?", (group_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Group not found")
        conn.commit()
        return {"success": True}
    finally:
        conn.close()

@router.post("/api/admin/settings")
async def save_admin_settings(request: Request):
    admin = request.session.get("user")
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    data = await request.json()
    conn = get_db()
    try:
        cur = conn.cursor()
        settings_to_update = {
            "allow_file_uploads": str(data.get("allowFileUploads", False)).lower(),
            "max_message_length": str(data.get("maxMessageLength", 500)),
            "theme": data.get("theme", "blue")
        }
        for key, value in settings_to_update.items():
            cur.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (key, value)
            )
        conn.commit()
        return {"success": True}
    finally:
        conn.close()