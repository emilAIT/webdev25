import sqlite3

try:
    print("Исправляю доступ к группе '123'...")
    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    # Получаем ID сессионного пользователя (всех пользователей)
    c.execute("SELECT id, username FROM users")
    users = c.fetchall()
    
    # Проверка существования группы
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
    
    # Проверяем и исправляем членство в группе для всех пользователей
    for user_id, username in users:
        print(f"Проверяю пользователя {username} (ID: {user_id})...")
        
        # Проверяем членство в группе
        c.execute("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
                  (group_id, user_id))
        if c.fetchone():
            print(f"Пользователь {username} уже в группе '123'")
        else:
            # Добавляем пользователя в группу
            c.execute("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
                     (group_id, user_id))
            print(f"Пользователь {username} добавлен в группу '123'")

    # Проверяем общее количество участников в группе
    c.execute("SELECT COUNT(*) FROM group_members WHERE group_id = ?", (group_id,))
    count = c.fetchone()[0]
    print(f"Всего участников в группе '123': {count}")
    
    c.execute("SELECT u.username FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?", (group_id,))
    members = [row[0] for row in c.fetchall()]
    print(f"Участники группы '123': {', '.join(members)}")

    conn.commit()
    conn.close()
    print("Операция успешно завершена")
except Exception as e:
    print(f"Произошла ошибка: {e}")

input("Нажмите Enter для завершения...") 