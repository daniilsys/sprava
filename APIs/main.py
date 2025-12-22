from fastapi import FastAPI
from .auth_api.main import AuthAPI
from Database.users import UsersCache
from .user_api.main import UserAPI
from Database.relationships import RelationshipsCache
from .conversation_api.main import ConversationsAPI
from Database.conversations import ConversationsCache
from Websocket.websocket_routes import WebsocketRoutes
import pymysql
from pymysql.cursors import DictCursor

conn = pymysql.connect(
    host="localhost",
    user="root",
    password="",
    database="sprava",
    port=3306,
    cursorclass=DictCursor,
    autocommit=True
)

app = FastAPI()
app.cursor = conn.cursor()

app.users_cache = UsersCache(app).init_table()
app.relationships_cache = RelationshipsCache(app).init_table()
app.conversations_cache = ConversationsCache(app).init_table()

AuthAPI(app)
UserAPI(app)
ConversationsAPI(app)
WebsocketRoutes(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
