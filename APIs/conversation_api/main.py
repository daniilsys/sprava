from pydantic import BaseModel

class ConversationCreationDatas(BaseModel):
    api_token: str
    user1_id: int
    user2_id: int

class ConversationRequestDatas(BaseModel):
    api_token: str
    conversation_id: int

class ConversationMessageRequestDatas(BaseModel):
    api_token: str
    conversation_id: int
    limit: int = 50
    offset: int = 0

class ConversationMessageDeleteDatas(BaseModel):
    api_token: str
    message_id: int

class ConversationMessageSendDatas(BaseModel):
    api_token: str
    conversation_id: int
    content: str

class ConversationsAPI:
    def __init__(self, app):
        self.app = app
        self.create_conversation()
        self.delete_conversation()
        self.get_conversations()
        self.get_conversation_messages()
        self.conversation_send_message()
        self.conversation_delete_message()
        self.conversation_read()


    def create_conversation(self):
        @self.app.post("/create_conversation", tags=["Conversations"])
        def root(data: ConversationCreationDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            if data.user1_id not in self.app.users_cache.cache or data.user2_id not in self.app.users_cache.cache:
                return {
                    "status_code": 401,
                    "message": "One of the given user IDs does not correspond to any user."
                }

            conversation_manager = self.app.conversations_cache.cache[user.user_id]
            conversation_id = conversation_manager.get_or_create_conversation(data.user2_id)
            return {
                "status_code": 200,
                "conversation_id": conversation_id
            }

    def delete_conversation(self):
        @self.app.delete("/delete_conversation", tags=["Conversations"])
        def root(data: ConversationRequestDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            conversation_manager = self.app.conversations_cache.cache[user.user_id]
            conversation_manager.delete_conversation(data.conversation_id)
            return {
                "status_code": 200,
                "message": "Conversation deletion not yet implemented."
            }

    def get_conversations(self):
        @self.app.get("/me/conversations", tags=["Conversations"])
        def root(data: ConversationRequestDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            conversation_manager = self.app.conversations_cache.cache[user.user_id]
            conversations = conversation_manager.get_conversations()
            return {
                "status_code": 200,
                "conversations": conversations
            }

    def get_conversation_messages(self):
        @self.app.get("/conversation/messages", tags=["Conversations"])
        def root(data: ConversationMessageRequestDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            conversation_manager = self.app.conversations_cache.cache[user.user_id]
            messages = conversation_manager.get_messages(data.conversation_id, data.limit, data.offset)

            return {
                "status_code": 200,
                "messages": messages
            }

    def conversation_send_message(self):
        @self.app.post("/conversation/send_message", tags=["Conversations"])
        def root(data: ConversationMessageSendDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            conversation_manager = self.app.conversations_cache.cache[user.user_id]
            message_id = conversation_manager.send_message(data.conversation_id, data.content)

            return {
                "status_code": 200,
                "message_id": message_id,
                "content": data.content,
                "message": "Message sent successfully."
            }

    def conversation_delete_message(self):
        @self.app.delete("/conversation/delete_message", tags=["Conversations"])
        def root(data: ConversationMessageDeleteDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            conversation_manager = self.app.conversations_cache.cache[user.user_id]
            conversation_manager.delete_message(data.message_id)

            return {
                "status_code": 200,
                "deleted_message_id": data.message_id,
                "message": "Message deleted successfully."
            }

    def conversation_read(self):
        @self.app.put("/conversation/read", tags=["Conversations"])
        def root(data: ConversationRequestDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            conversation_manager = self.app.conversations_cache.cache[user.user_id]
            conversation_manager.mark_as_read(data.conversation_id)

            return {
                "status_code": 200,
                "message": "Messages marked as read."
            }