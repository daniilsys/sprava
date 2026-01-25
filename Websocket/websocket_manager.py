class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket, user_id):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket, user_id):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, user_id:  int, message:  dict):
        if user_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except: 
                    disconnected.append(connection)
            for connection in disconnected:
                self.disconnect(connection, user_id)

    async def send_to_multiple(self, user_ids: list, message: dict, exclude_user_id: int = None):
        for user_id in user_ids: 
            if exclude_user_id and user_id == exclude_user_id: 
                continue
            await self.send_personal_message(user_id, message)

    async def send_to_conversation(self, message: dict, user1_id, user2_id):
        await self.send_personal_message(user1_id, message)
        await self.send_personal_message(user2_id, message)

    def is_user_online(self, user_id:  int):
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    def get_online_users(self):
        return list(self.active_connections.keys())