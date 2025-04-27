import sqlite3

try:
    print("Проверяю группу '123'...")
    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    # Проверяем существование группы
    c.execute("SELECT id FROM groups WHERE name = '123'")
    group = c.fetchone()
    
    if not group:
        print("Группа '123' не найдена. Создаю группу...")
        c.execute("INSERT INTO groups (name) VALUES ('123')")
        group_id = c.lastrowid
        print(f"Группа '123' создана с ID: {group_id}")
    else:
        group_id = group[0]
        print(f"Группа '123' найдена с ID: {group_id}")
    
    # Получаем список всех пользователей
    c.execute("SELECT id, username FROM users")
    users = c.fetchall()
    
    print(f"Найдено пользователей: {len(users)}")
    for user_id, username in users:
        print(f"Пользователь: {username} (ID: {user_id})")
        
        # Проверяем, является ли пользователь участником группы
        c.execute("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, user_id))
        is_member = c.fetchone()
        
        if not is_member:
            # Добавляем пользователя в группу
            c.execute("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", (group_id, user_id))
            print(f"Пользователь {username} добавлен в группу '123'")
        else:
            print(f"Пользователь {username} уже в группе '123'")
    
    # Сохраняем изменения
    conn.commit()
    conn.close()
    
    print("Операция успешно завершена")
except Exception as e:
    print(f"Произошла ошибка: {e}")

input("Нажмите Enter для завершения...") 