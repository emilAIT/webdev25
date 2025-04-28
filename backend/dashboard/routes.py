# import sys
import os
# sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import APIRouter, Request, Form, Depends, HTTPException, Response, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates  
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from backend.database import get_db
from backend.models.models import User, Contact, ChatRoom, RoomParticipant, Message
from backend.auth.token_utils import verify_access_token_for_user_id
from sqlalchemy import or_, and_
from sqlalchemy.sql import exists
from pathlib import Path
import shutil
import base64
from datetime import datetime
import uuid
from base64 import b64encode

router_dash = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "frontend", "templates"))

def b64encode_filter(value: bytes) -> str:
    return base64.b64encode(value).decode('utf-8')

# Регистрируем собственный фильтр
templates.env.filters['b64encode'] = b64encode_filter

from sqlalchemy.orm import aliased
from sqlalchemy.sql import select, and_, or_, exists
from fastapi import HTTPException

@router_dash.get("/", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(verify_access_token_for_user_id),
    selected_contact_id: int = None,
):
    request.state.user_id = current_user_id
    message_exists = exists().where(Message.room_id == ChatRoom.id).correlate(ChatRoom)
    selected_contact = None
    contact_data_dict = {}

    if selected_contact_id:
        # Создаем псевдонимы для таблицы RoomParticipant
        rp1 = aliased(RoomParticipant, name='rp1')
        rp2 = aliased(RoomParticipant, name='rp2')

        # Запрос для получения ID приватной комнаты
        subquery = (
            select(ChatRoom.id)
            .join(rp1, rp1.room_id == ChatRoom.id)
            .join(rp2, rp2.room_id == ChatRoom.id)
            .where(
                and_(
                    ChatRoom.type == "private",
                    rp1.user_id == current_user_id,
                    rp2.user_id == selected_contact_id
                )
            )
            .scalar_subquery()  # Преобразуем в скалярный подзапрос
        )

        # Оборачиваем подзапрос в select для выполнения
        executable_query = select(subquery)

        # Выполним запрос для получения ID комнаты
        room_id_result = await db.execute(executable_query)
        room_id = room_id_result.scalar()  # Получаем первый (и единственный) результат подзапроса

        if room_id is None:
            print(f"Приватная комната не найдена для текущего пользователя {current_user_id} и контакта с ID {selected_contact_id}")

    if selected_contact_id and room_id:
    # Запрос для получения контакта, пользователя и комнаты
        selected_contact_result = await db.execute(
            select(Contact, User, ChatRoom)
            .join(User, User.id == Contact.contact_id)
            .outerjoin(ChatRoom, ChatRoom.id == room_id)  # Используем полученный room_id
            .where(Contact.contact_id == selected_contact_id, Contact.owner_id == current_user_id)
        )

        selected_contact = selected_contact_result.first()  # Получаем первый результат (Contact, User, ChatRoom)
        if selected_contact is None:
            print(f"Contact ID {selected_contact_id} not found for user {current_user_id}")

    # Запрос для получения всех чатов и контактов
    result = await db.execute(
        select(ChatRoom, User)
        .select_from(ChatRoom)
        .outerjoin(RoomParticipant, RoomParticipant.room_id == ChatRoom.id)
        .outerjoin(Message, Message.room_id == ChatRoom.id)
        .outerjoin(Contact, and_(Contact.owner_id == current_user_id))
        .outerjoin(User, User.id == Contact.contact_id)
        .where(
            or_(
                and_(
                    RoomParticipant.user_id == current_user_id,
                    message_exists
                ),
                and_(
                    RoomParticipant.user_id == current_user_id,
                    ChatRoom.type != "private"
                )
            )
        )
        .group_by(ChatRoom.id, User.id)
    )

    chats_with_contacts = result.all()

    # Обработка данных для шаблона
    if selected_contact:
        contact_obj, user_obj, room_obj = selected_contact
        user_ids = {user.id for room, user in chats_with_contacts if user}
        if user_obj.id not in user_ids:
            chats_with_contacts.insert(0, (room_obj, user_obj))
        contact_data_dict[user_obj.id] = user_obj

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "contacts": chats_with_contacts,
            "selected_contact": selected_contact,
            "selected_contact_user": selected_contact[1] if selected_contact else None,
            "selected_contact_room": selected_contact[2] if selected_contact else None,
            "contact_data_dict": contact_data_dict,
        },
        response=response
    )

@router_dash.get("/add_con", response_class=HTMLResponse)
async def add_con_page(request: Request, db: AsyncSession = Depends(get_db), current_user_id: int = Depends(verify_access_token_for_user_id)):
    result = await db.execute(
        select(User)
        .join(Contact, Contact.contact_id == User.id)
        .where(Contact.owner_id == current_user_id)
    )
    contacts = result.scalars().all()
    return templates.TemplateResponse("add_contacts.html", {"request": request, "contacts": contacts})

@router_dash.get("/new_con", response_class=HTMLResponse)
async def new_con_page(request: Request, db: AsyncSession = Depends(get_db)):
    return templates.TemplateResponse("new_contact.html", {"request": request})


@router_dash.post("/add_new_contact")
async def add_contact(
    request: Request,
    username: str = Form(...),
    session: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(verify_access_token_for_user_id)
):
    # Создаем алиас для таблицы Contact
    ContactAlias = aliased(Contact)

    # Выполняем запрос для получения пользователя и проверки контакта
    result = await session.execute(
        select(User, ContactAlias)
        .outerjoin(
            ContactAlias,
            (ContactAlias.owner_id == current_user_id) & (ContactAlias.contact_id == User.id)
        )
        .where(User.username == username)
    )

    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    target_user, existing_contact = row

    # Проверяем, что пользователь не добавляет сам себя
    if target_user.id == current_user_id:
        raise HTTPException(status_code=400, detail="Нельзя добавить себя в контакты")

    # Проверяем, что контакт еще не добавлен
    if existing_contact:
        raise HTTPException(status_code=400, detail="Контакт уже добавлен")

    # Создаем новый контакт
    contact = Contact(owner_id=current_user_id, contact_id=target_user.id)
    session.add(contact)

    # Создаем приватную комнату для чата
    room = ChatRoom(name=f"Chat with {target_user.username}", type="private")
    session.add(room)
    await session.commit()  # Сохраняем комнату
    await session.refresh(room)  

    # Добавляем участников комнаты
    # Используем target_user.id напрямую, но сначала убеждаемся, что объект не expired
    await session.refresh(target_user)  # Обновляем объект target_user
    room_participant_1 = RoomParticipant(user_id=current_user_id, room_id=room.id)
    room_participant_2 = RoomParticipant(user_id=target_user.id, room_id=room.id)
    session.add(room_participant_1)
    session.add(room_participant_2)
    await session.commit()  

    return RedirectResponse(url="/dash/new_con", status_code=303)

@router_dash.get("/profile", response_class=HTMLResponse)
async def profile_page(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(verify_access_token_for_user_id)
):
    result = await db.execute(select(User).where(User.id == current_user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    avatar_url = None
    if user.avatar_data:
        avatar_url = "data:image/png;base64," + base64.b64encode(user.avatar_data).decode('utf-8')
        print("Avatar URL:", avatar_url)

    print("avatarrrrrr", avatar_url)
    print("user", user)


    return templates.TemplateResponse("profile.html", {
        "request": request,
        "user": {
            "username": user.username,
            "email": user.email,
            "about": user.about,
            "avatar_url": avatar_url
        }
    })

@router_dash.post("/profile/update")
async def update_profile(
    request: Request,
    username: str = Form(...),
    email: str = Form(None),
    about: str = Form(None),
    status: str = Form(None),
    avatar: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(verify_access_token_for_user_id)
):

    try:
        result = await db.execute(select(User).where(User.id == current_user_id))
        user = result.scalar_one()

        # Обновление текстовых данных
        user.username = username
        user.email = email
        user.about = about
        user.status = status

        # Обновление аватара
        if avatar and avatar.filename:
            avatar_bytes = await avatar.read()
            user.avatar_data = avatar_bytes
            print("Avatar updated")
            print(avatar.filename)

        await db.commit()
        print("Changes saved to DB")
        return RedirectResponse(url="/dash/profile", status_code=303)

    except Exception as e:
        await db.rollback()
        print(f"Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    

@router_dash.get("/status", response_class=HTMLResponse)
async def statuses_page(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(verify_access_token_for_user_id)
):
    # Получить пользователя
    result = await db.execute(select(User).where(User.id == current_user_id))
    user = result.scalar_one_or_none()
    
    my_status = None
    avatar_url = None
    if user:
        # Если есть статус, используем его
        if user.status:
            my_status = "/static/statuses/" + user.status
        # Если нет статуса, проверяем аватар
        if not my_status:
            if user.avatar_data:
                # Преобразуем бинарные данные аватарки в base64
                avatar_url = f"data:image/png;base64,{b64encode(user.avatar_data).decode('utf-8')}"
            else:
                # Если нет аватарки, используем дефолтную
                avatar_url = "/static/avatars/default_avatar.png"

    # Получить контактов
    contacts_query = await db.execute(
        select(Contact.contact_id)
        .where(Contact.owner_id == current_user_id)
    )
    contact_ids = [row[0] for row in contacts_query.all()]
    
    users_query = await db.execute(
        select(User.id, User.username, User.status)
        .where(User.id.in_(contact_ids))
        .where(User.status.isnot(None))
    )
    
    contacts_statuses = users_query.all()
    
    contacts_statuses_list = [
        {"id": row.id, "username": row.username, "status": "/static/statuses/" + row.status if row.status else None}
        for row in contacts_statuses
    ]
    
    return templates.TemplateResponse(
        "status.html",
        {
            "request": request,
            "view_mode": "list",
            "my_status": my_status,
            "avatar_url": avatar_url,
            "contacts_statuses": contacts_statuses_list,
            "selected_contact": None
        }
    )



@router_dash.get("/contact_status/{contact_id}", response_class=HTMLResponse)
async def contact_status(
    contact_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(verify_access_token_for_user_id)
):
    # Проверка, что контакт принадлежит текущему пользователю
    result = await db.execute(
        select(Contact)
        .where(Contact.owner_id == current_user_id, Contact.contact_id == contact_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=403, detail="Not a contact")

    # Получить данные пользователя (контакта)
    result = await db.execute(
        select(User.username, User.status)
        .where(User.id == contact_id)
    )
    user = result.first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    status_url = "/static/statuses/" + user.status if user.status else None
    return templates.TemplateResponse(
        "status.html",
        {
            "request": request,
            "view_mode": "contact",  # Режим отображения: статус контакта
            "my_status": None,
            "contacts_statuses": [],
            "selected_contact": {"username": user.username, "status": status_url}
        }
    )


@router_dash.post("/upload_status")
async def upload_status(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(verify_access_token_for_user_id)
):
    status_dir = os.path.join(BASE_DIR, "frontend", "static", "statuses")
    os.makedirs(status_dir, exist_ok=True)

    file_extension = file.filename.split(".")[-1]
    status_filename = f"{current_user_id}_{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(status_dir, status_filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    result = await db.execute(select(User).where(User.id == current_user_id))
    user = result.scalar_one_or_none()
    if user:
        user.status = status_filename
        await db.commit()

    return RedirectResponse(url="/dash/status", status_code=303)

@router_dash.post("/delete_status")
async def delete_status(
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(verify_access_token_for_user_id)
):
    # Получить пользователя
    result = await db.execute(select(User).where(User.id == current_user_id))
    user = result.scalar_one_or_none()

    if user and user.status:
        # Путь к файлу статуса
        status_path = os.path.join(BASE_DIR, "frontend", "static", "statuses", user.status)

        # Удаление файла, если он существует
        if os.path.exists(status_path):
            os.remove(status_path)

        # Очистка поля статуса у пользователя
        user.status = None
        await db.commit()

    return RedirectResponse(url="/dash/status", status_code=303)