import socketio

# Shared Socket.IO server instance
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],  # Adjust origins as needed
    async_handlers=True,
    ping_timeout=35000,
    logger=True,
    engineio_logger=True,
)

# Shared dictionary to store mapping of socket IDs (sid) to user IDs
connected_users = {}
