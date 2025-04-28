from fastapi import WebSocket
from typing import Dict, List, Any

class ConnectionManager:
    def __init__(self):
        # Map group_id -> list of connected websockets
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # Map all active connections (for broadcasting to everyone)
        self.all_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, group_id: int):
        await websocket.accept()
        
        # Add to group-specific connections
        if group_id not in self.active_connections:
            self.active_connections[group_id] = []
        self.active_connections[group_id].append(websocket)
        
        # Add to all connections
        self.all_connections.append(websocket)

    def disconnect(self, websocket: WebSocket, group_id: int):
        if group_id in self.active_connections:
            if websocket in self.active_connections[group_id]:
                self.active_connections[group_id].remove(websocket)
            
            # Clean up empty groups
            if not self.active_connections[group_id]:
                del self.active_connections[group_id]
        
        if websocket in self.all_connections:
            self.all_connections.remove(websocket)

    async def broadcast_to_group(self, message: Any, group_id: int):
        if group_id in self.active_connections:
            for connection in self.active_connections[group_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error sending message to client: {e}")
                    # Connection is likely bad, will be cleaned up on next interaction

    async def broadcast_to_all(self, message: Any):
        for connection in self.all_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to client: {e}")
                # Connection is likely bad, will be cleaned up on next interaction