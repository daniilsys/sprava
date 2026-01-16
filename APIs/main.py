from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .auth_api.main import AuthAPI
from Database.users import UsersCache
from .user_api.main import UserAPI
from Database.relationships import RelationshipsCache
from .conversation_api.main import ConversationsAPI
from Database.conversations import ConversationsCache
from Websocket.websocket_routes import WebsocketRoutes
from Database.pool import pool, get_cursor 

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.db_pool = pool
app.get_cursor = get_cursor

app.users_cache = UsersCache(app).init_table()
app.relationships_cache = RelationshipsCache(app).init_table()
app.conversations_cache = ConversationsCache(app).init_table()

AuthAPI(app)
UserAPI(app)
ConversationsAPI(app)
websocket_routes = WebsocketRoutes(app)
app.websocket_managers = websocket_routes.manager

if __name__ == "__main__": 
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)