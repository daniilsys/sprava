from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from Websocket.websocket_manager import ConnectionManager
from Websocket.websocket_handlers import WebSocketHandlers


class WebsocketRoutes:
    def __init__(self, app):
        self.app = app
        self.manager = ConnectionManager()
        self.handlers = WebSocketHandlers(app, self.manager)
        self.setup_routes()

    def setup_routes(self):
        @self.app.websocket("/ws/{api_token}")
        async def root(websocket: WebSocket, api_token: str):
            await self.handle_connection(websocket, api_token)

    async def handle_connection(self, websocket: WebSocket, api_token: str):
        user = self.app.users_cache.get_user_by_token(api_token)

        if not user:
            await websocket.close(code=4008)
            return

        user_id = user.user_id
        await self.manager.connect(websocket, user_id)

        await self.handlers.notify_status_change(user_id, "online")

        try:
            while True:
                data = await websocket.receive_json()
                await self.handlers.handle_message(data, user_id)

        except WebSocketDisconnect:
            self.manager.disconnect(websocket, user_id)
            await self.handlers.notify_status_change(user_id, "offline")

        except Exception as e:
            print(f"Websocket error for user {user_id}: {e}")
            self.manager.disconnect(websocket, user_id)
            await self.handlers.notify_status_change(user_id, "offline")