from core.database import engine
from db.base_class import Base
from db import models  # это нужно, чтобы модели загрузились

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()
