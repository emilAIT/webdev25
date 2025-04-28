import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.config import settings

async def send_verification_email(to_email: str, code: str):
    from_email = settings.EMAIL
    from_password = settings.EMAIL_PASSWORD

    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = 'Your Verification Code'

    body = f'Your verification code is: {code}'
    msg.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(from_email, from_password)
            server.sendmail(from_email, to_email, msg.as_string())
            server.quit()

        print("Verification email sent successfully")
    except smtplib.SMTPAuthenticationError as e:
        print(f"SMTP Authentication failed: {e.smtp_code} - {e.smtp_error.decode()}")
    except Exception as e:
        print(f"Error: {str(e)}")
