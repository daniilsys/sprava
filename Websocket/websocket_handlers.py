from datetime import datetime


class WebSocketHandlers:
    def __init__(self, app, manager):
        self.app = app
        self.manager = manager

    async def handle_message(self, data, sender_id):
        message_type = data.get("type")

        handlers = {
            "send_message": self.handle_send_message,
            "typing": self.handle_typing,
            "stop_typing": self.handle_stop_typing,
            "mark_read": self.handle_mark_read,
            "get_online_friends": self.handle_get_online_friends,
        }
        handler = handlers.get(message_type)
        if handler:
            await handler(data, sender_id)

    async def handle_send_message(self, data, sender_id):
        receiver_id = data.get("receiver_id")
        content = data.get("content")

        if not receiver_id or not content:
            return

        conversation_manager = self.app.conversations_cache.cache[sender_id]
        message_id = conversation_manager.send_message_with_receiver(receiver_id, content)

        message_data = {
            "type": "new_message",
            "message_id": message_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "content": content,
            "timestamp": datetime.now().isoformat()
        }

        await self.manager.send_to_conversation(message_data, sender_id, receiver_id)

    async def handle_typing(self, data, sender_id):
        receiver_id = data.get("receiver_id")
        if not receiver_id:
            return

        typing_data = {
            "type": "user_typing",
            "user_id": sender_id,
            "is_typing": True,
        }

        await self.manager.send_personal_message(receiver_id, typing_data)

    async def handle_stop_typing(self, data, sender_id):
        receiver_id = data.get("receiver_id")
        if not receiver_id:
            return

        stop_typing_data = {
            "type": "user_typing",
            "user_id": sender_id,
            "is_typing": False,
        }

        await self.manager.send_personal_message(receiver_id, stop_typing_data)

    async def handle_mark_read(self, data, sender_id):
        conversation_id = data.get("conversation_id")
        if not conversation_id:
            return

        conversation_manager = self.app.conversations_cache.cache[sender_id]
        conversation_manager.mark_as_read(conversation_id)

        self.app.cursor.execute("""
        SELECT user1_id, user2_id
        FROM conversations
        WHERE id = %s
        """, (conversation_id,))

        result = self.app.cursor.fetchone()
        if not result:
            return

        other_user_id = result['user2_id'] if result['user1_id'] == sender_id else result['user1_id']

        mark_read_data = {
            "type": "messages_read",
            "conversation_id": conversation_id,
            "user_id": sender_id,
        }
        await self.manager.send_personal_message(-other_user_id, mark_read_data)

    async def handle_get_online_friends(self, data, sender_id):
        friends = self.app.relationships_cache.cache[sender_id]["friends"].get_friends()
        online_friends = [f for f in friends if self.manager.is_user_online(f)]

        online_friends_data = {
            "type": "online_friends",
            "friends": online_friends,
        }
        await self.manager.send_personal_message(sender_id, online_friends_data)

    async def notify_status_change(self, user_id, status):
        friends = self.app.relationships_cache.cache[user_id]["friends"].get_friends()
        status_data = {
            "type": "friend_status_change",
            "user_id": user_id,
            "status": status,
        }
        for friend_id in friends:
            if self.manager.is_user_online(friend_id):
                await self.manager.send_personal_message(friend_id, status_data)