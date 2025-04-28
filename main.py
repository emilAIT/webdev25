import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from random import randint

sender = "for.yu.chat@gmail.com"
password = "wegp lwio ndpt nevl"

async def send_email(message, recipient_email=None, code=None):
    recipient = recipient_email if recipient_email else "mamatjanovalymbek@gmail.com"
    
    # Создаем объект MIMEMultipart
    msg = MIMEMultipart('alternative')
    msg["Subject"] = "YuChat - Email Verification"
    msg["From"] = sender
    msg["To"] = recipient
    
    # Если передан код, используем его, иначе используем сообщение как есть
    if code:
        # Текстовая версия для клиентов без поддержки HTML
        text_content = f"Ваш код подтверждения: {code}\nВведите его на сайте для завершения регистрации."
        
        # HTML версия письма
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
                
                body {{
                    font-family: 'Poppins', Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #f4f4f4;
                }}
                .container {{
                    max-width: 600px;
                    margin: 20px auto;
                    background-color: #ffffff;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    background-color: rgba(34, 61, 85, 0.95);
                    padding: 30px;
                    text-align: center;
                    color: white;
                }}
                .header h1 {{
                    margin: 0;
                    font-size: 28px;
                }}
                .content {{
                    padding: 30px;
                    text-align: center;
                }}
                .verification-code {{
                    font-size: 32px;
                    font-weight: 600;
                    letter-spacing: 5px;
                    margin: 30px 0;
                    color: #333;
                    background-color: #f0f0f0;
                    padding: 15px;
                    border-radius: 8px;
                    display: inline-block;
                }}
                .message {{
                    font-size: 16px;
                    color: #555;
                    line-height: 1.5;
                    margin-bottom: 30px;
                }}
                .footer {{
                    background-color: #f0f0f0;
                    padding: 20px;
                    text-align: center;
                    color: #777;
                    font-size: 12px;
                }}
                .button {{
                    background-color: rgba(34, 61, 85, 0.95);
                    color: white;
                    padding: 12px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: 500;
                    display: inline-block;
                    margin-top: 20px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>YuChat</h1>
                </div>
                <div class="content">
                    <p class="message">Здравствуйте! Спасибо за регистрацию в YuChat. Для завершения регистрации, пожалуйста, введите указанный ниже код подтверждения на странице верификации.</p>
                    
                    <div class="verification-code">{code}</div>
                    
                    <p class="message">Если вы не регистрировались на нашем сайте, пожалуйста, проигнорируйте это сообщение.</p>
                </div>
                <div class="footer">
                    <p>© {2025} YuChat</p>
                    <p>Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Прикрепляем текстовую и HTML версии письма
        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')
        
        msg.attach(part1)
        msg.attach(part2)
    else:
        # Если код не передан, просто отправляем текстовое сообщение
        msg.attach(MIMEText(message, 'plain'))
    
    server = None
    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender, password)
        server.sendmail(sender, recipient, msg.as_string())
        return "The message was sent successfully!"
    except Exception as _ex:
        return f"{_ex}\nCheck your login or password pls"
    finally:
        # Закрываем соединение только если оно было успешно установлено
        if server is not None:
            try:
                server.quit()
            except:
                pass  # Игнорируем ошибку при закрытии соединения

def main():
    codeNumber = randint(100000, 999999)
    # Обратите внимание, что теперь мы передаем код отдельно
    send_email(message="", recipient_email="test@example.com", code=codeNumber)

if __name__ == "__main__":
    main()