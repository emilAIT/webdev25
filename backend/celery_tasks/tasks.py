from asgiref.sync import async_to_sync
from backend.celery_tasks.celery_worker import celery
from backend.celery_tasks.email_utils import send_verification_email

@celery.task(name="backend.tasks.send_verification_email_task")
def send_verification_email_task(to_email: str, code: str):
    async_to_sync(send_verification_email)(to_email, code)
