from fastapi import WebSocket
from typing import Dict, List, Any
from sqlalchemy.orm import Session
import datetime

from ..models.models import Group


class ConnectionManager:
    """
    WebSocket connection manager for handling real-time messaging
    """

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        """Connect a new WebSocket for a user"""
        try:
            await websocket.accept()
            user_id_str = str(user_id)

            print(f"WebSocket connected for user {user_id}")

            if user_id_str not in self.active_connections:
                self.active_connections[user_id_str] = []
            self.active_connections[user_id_str].append(websocket)

            # Log active connections for debugging
            self._log_connection_status()
        except Exception as e:
            print(f"Error connecting WebSocket for user {user_id}: {str(e)}")
            import traceback

            traceback.print_exc()

    def disconnect(self, websocket: WebSocket, user_id: int):
        """Disconnect a WebSocket for a user"""
        try:
            user_id_str = str(user_id)

            print(f"WebSocket disconnecting for user {user_id}")

            if user_id_str in self.active_connections:
                if websocket in self.active_connections[user_id_str]:
                    self.active_connections[user_id_str].remove(websocket)
                if not self.active_connections[user_id_str]:
                    del self.active_connections[user_id_str]

            # Log active connections for debugging
            self._log_connection_status()
        except Exception as e:
            print(f"Error disconnecting WebSocket for user {user_id}: {str(e)}")
            import traceback

            traceback.print_exc()

    async def send_personal_message(self, message: dict, user_id: int):
        """Send a message to a specific user"""
        try:
            user_id_str = str(user_id)

            if user_id_str not in self.active_connections:
                print(f"Failed to send message: User {user_id} not connected")
                return False

            connections = self.active_connections[user_id_str]
            if not connections:
                print(
                    f"Failed to send message: User {user_id} has no active connections"
                )
                return False

            print(
                f"Sending message to user {user_id} via {len(connections)} connection(s)"
            )

            # Track successful sends
            successful_sends = 0

            # Try to send to all connections
            for connection in connections:
                try:
                    await connection.send_json(message)
                    successful_sends += 1
                except Exception as e:
                    print(
                        f"Error sending message to one connection for user {user_id}: {str(e)}"
                    )
                    # Remove failed connection
                    try:
                        connections.remove(connection)
                    except ValueError:
                        pass

            # Clean up if all connections failed
            if successful_sends == 0 and user_id_str in self.active_connections:
                if not self.active_connections[user_id_str]:
                    del self.active_connections[user_id_str]
                print(f"All connections failed for user {user_id}")
                return False

            return successful_sends > 0
        except Exception as e:
            print(f"Error in send_personal_message for user {user_id}: {str(e)}")
            import traceback

            traceback.print_exc()
            return False

    async def broadcast_to_group(self, message: dict, group_id: int, db: Session):
        """Broadcast a message to all members of a group"""
        try:
            group = db.query(Group).filter(Group.id == group_id).first()
            if not group:
                print(f"Failed to broadcast: Group {group_id} not found")
                return False

            print(
                f"Broadcasting message to group {group_id} with {len(group.members)} members"
            )

            # Track successful broadcasts
            successful_broadcasts = 0

            for member in group.members:
                try:
                    result = await self.send_personal_message(message, member.id)
                    if result:
                        successful_broadcasts += 1
                except Exception as e:
                    print(
                        f"Error broadcasting to member {member.id} in group {group_id}: {str(e)}"
                    )

            print(
                f"Message broadcast to {successful_broadcasts}/{len(group.members)} members in group {group_id}"
            )
            return successful_broadcasts > 0
        except Exception as e:
            print(f"Error in broadcast_to_group for group {group_id}: {str(e)}")
            import traceback

            traceback.print_exc()
            return False

    async def broadcast_chat_cleared(
        self, chat_id: int, cleared_by_id: int, db: Session
    ):
        """Broadcast a chat cleared notification to both users in a direct chat"""
        try:
            # Find the direct chat and get both user IDs
            from ..models.models import DirectChat

            chat = db.query(DirectChat).filter(DirectChat.id == chat_id).first()
            if not chat:
                print(f"Failed to broadcast chat cleared: Chat {chat_id} not found")
                return False

            user1_id = chat.user1_id
            user2_id = chat.user2_id

            print(
                f"Broadcasting chat cleared notification for chat {chat_id} to users {user1_id} and {user2_id}"
            )

            # Create the notification message
            message = {
                "type": "chat_cleared",
                "chat_id": chat_id,
                "cleared_by": cleared_by_id,
                "timestamp": str(datetime.datetime.now().isoformat()),
            }

            # Send to both users
            await self.send_personal_message(message, user1_id)
            await self.send_personal_message(message, user2_id)

            return True
        except Exception as e:
            print(f"Error in broadcast_chat_cleared for chat {chat_id}: {str(e)}")
            import traceback

            traceback.print_exc()
            return False

    async def broadcast_chat_deleted(
        self, chat_id: int, deleted_by_id: int, other_user_id: int
    ):
        """Broadcast a chat deleted notification to both users in a direct chat"""
        try:
            print(
                f"Broadcasting chat deleted notification for chat {chat_id} to users {deleted_by_id} and {other_user_id}"
            )

            # Create the notification message
            message = {
                "type": "chat_deleted",
                "chat_id": chat_id,
                "deleted_by": deleted_by_id,
                "timestamp": str(datetime.datetime.now().isoformat()),
            }

            # Send to both users
            await self.send_personal_message(message, deleted_by_id)
            await self.send_personal_message(message, other_user_id)

            return True
        except Exception as e:
            print(f"Error in broadcast_chat_deleted for chat {chat_id}: {str(e)}")
            import traceback

            traceback.print_exc()
            return False

    async def broadcast_group_cleared(
        self, group_id: int, cleared_by_id: int, db: Session
    ):
        """Broadcast a group cleared notification to all members of a group"""
        try:
            message = {
                "type": "group_cleared",
                "group_id": group_id,
                "cleared_by": cleared_by_id,
                "timestamp": str(datetime.datetime.now().isoformat()),
            }

            return await self.broadcast_to_group(message, group_id, db)
        except Exception as e:
            print(f"Error in broadcast_group_cleared for group {group_id}: {str(e)}")
            import traceback

            traceback.print_exc()
            return False

    async def broadcast_user_left_group(
        self, group_id: int, user_id: int, username: str, db: Session
    ):
        """Broadcast a notification when a user leaves a group"""
        try:
            message = {
                "type": "user_left_group",
                "group_id": group_id,
                "user_id": user_id,
                "username": username,
                "timestamp": str(datetime.datetime.now().isoformat()),
            }

            return await self.broadcast_to_group(message, group_id, db)
        except Exception as e:
            print(f"Error in broadcast_user_left_group for group {group_id}: {str(e)}")
            import traceback

            traceback.print_exc()
            return False

    def _log_connection_status(self):
        """Log the current connection status for debugging"""
        total_connections = sum(
            len(connections) for connections in self.active_connections.values()
        )
        print(
            f"Active WebSocket connections: {total_connections} for {len(self.active_connections)} users"
        )
        for user_id, connections in self.active_connections.items():
            print(f"  - User {user_id}: {len(connections)} connection(s)")


# Create a global instance of the connection manager
manager = ConnectionManager()
