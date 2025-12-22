class ConversationsCache:
    def __init__(self, app):
        self.app = app
        self.cache = {}

    def init_table(self):
        self.cache = {}
        self.app.cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user1_id INT,
            user2_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_conversation (user1_id, user2_id)
        )
        """)

        self.app.cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INT PRIMARY KEY AUTO_INCREMENT,
            conversation_id INT,
            sender_id INT,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_read BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        users = self.app.users_cache.get_users()
        for u in users:
            self.cache[u["id"]] = ConversationManager(u["id"], self)
        return self


class ConversationManager:
    def __init__(self, user_id, cache):
        self.user_id = user_id
        self.cache = cache

    def get_or_create_conversation(self, other_user_id):
        user1_id = min(self.user_id, other_user_id)
        user2_id = max(self.user_id, other_user_id)

        self.cache.app.cursor.execute("""
            SELECT id FROM conversations 
            WHERE user1_id = %s AND user2_id = %s
        """, (user1_id, user2_id))

        result = self.cache.app.cursor.fetchone()
        if result:
            return result['id']

        self.cache.app.cursor.execute("""
            INSERT INTO conversations (user1_id, user2_id) 
            VALUES (%s, %s)
        """, (user1_id, user2_id))

        return self.cache.app.cursor. lastrowid

    def get_conversations(self):
        self.cache.app.cursor.execute("""
            SELECT 
                c.id,
                c.user1_id,
                c.user2_id,
                c.created_at,
                CASE 
                    WHEN c.user1_id = %s THEN c.user2_id 
                    ELSE c.user1_id 
                END AS other_user_id,
                (SELECT content FROM messages 
                 WHERE conversation_id = c.id 
                 ORDER BY created_at DESC LIMIT 1) AS last_message,
                (SELECT created_at FROM messages 
                 WHERE conversation_id = c.id 
                 ORDER BY created_at DESC LIMIT 1) AS last_message_at,
                (SELECT COUNT(*) FROM messages 
                 WHERE conversation_id = c.id 
                 AND sender_id != %s 
                 AND is_read = FALSE) AS unread_count
            FROM conversations c
            WHERE c.user1_id = %s OR c.user2_id = %s
            ORDER BY last_message_at DESC
        """, (self.user_id, self.user_id, self.user_id, self.user_id))

        return self.cache.app.cursor.fetchall()

    def send_message(self, conversation_id, content):
        self.cache.app.cursor.execute("""
            INSERT INTO messages (conversation_id, sender_id, content) 
            VALUES (%s, %s, %s)
        """, (conversation_id, self.user_id, content))

        return self.cache.app.cursor.lastrowid

    def get_messages(self, conversation_id, limit=50, offset=0):
        self.cache.app.cursor.execute("""
            SELECT * FROM conversations 
            WHERE id = %s AND (user1_id = %s OR user2_id = %s)
        """, (conversation_id, self.user_id, self.user_id))

        if not self.cache.app.cursor.fetchone():
            return []

        self.cache.app. cursor.execute("""
            SELECT 
                m.id,
                m.conversation_id,
                m.sender_id,
                m.content,
                m.created_at,
                m.is_read
            FROM messages m
            WHERE m.conversation_id = %s
            ORDER BY m.created_at ASC
            LIMIT %s OFFSET %s
        """, (conversation_id, limit, offset))

        messages = self.cache.app.cursor.fetchall()
        return list(messages)

    def mark_as_read(self, conversation_id):
        self.cache.app. cursor.execute("""
            UPDATE messages 
            SET is_read = TRUE 
            WHERE conversation_id = %s 
            AND sender_id != %s 
            AND is_read = FALSE
        """, (conversation_id, self.user_id))
        return self

    def delete_message(self, message_id):
        self.cache.app.cursor.execute("""
            DELETE FROM messages 
            WHERE id = %s AND sender_id = %s
        """, (message_id, self.user_id))
        return self

    def delete_conversation(self, conversation_id):
        self.cache.app.cursor.execute("""
            SELECT * FROM conversations 
            WHERE id = %s AND (user1_id = %s OR user2_id = %s)
        """, (conversation_id, self.user_id, self.user_id))

        if self.cache.app.cursor.fetchone():
            self.cache. app.cursor.execute("""
                DELETE FROM conversations WHERE id = %s
            """, (conversation_id,))
        return self