from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from core.database import get_db  # твоя функция подключения к БД
from db.models import User  # твои модели
from pydantic import BaseModel

router = APIRouter()

class SearchResult(BaseModel):
    id: int
    name: str
    avatar: str | None = None

@router.get("/search", response_model=List[SearchResult])
async def search(query: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.username.ilike(f"%{query}%")).all()

    results = []

    for user in users:
        results.append(SearchResult(
            id=user.id,
            name=user.username,
            avatar=user.profile_picture if user.profile_picture else None
        ))



    return results
