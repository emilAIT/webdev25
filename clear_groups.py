import sqlite3

try:
    print("Начинаю очистку групп...")
    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    # Удаляем все группы
    c.execute('DELETE FROM groups')
    print("Все группы удалены")

    # Удаляем все связи пользователей с группами
    c.execute('DELETE FROM group_members')
    print("Все связи с группами удалены")

    # Удаляем групповые сообщения
    c.execute("DELETE FROM messages WHERE mode = 'groups'")
    print("Все групповые сообщения удалены")

    # Сохраняем изменения
    conn.commit()
    conn.close()

    print("Операция успешно завершена")
except Exception as e:
    print(f"Произошла ошибка: {e}")

input("Нажмите Enter для завершения...") 