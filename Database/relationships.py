class RelationshipsCache:
    def __init__(self, app):
        self.app = app
        self.cache = {}


    def init_table(self):
        self.cache = {}
        self.app.cursor.execute("""
        CREATE TABLE IF NOT EXISTS friends (
        user1_id INT,
        user2_id INT,
        PRIMARY KEY (user1_id, user2_id),
        FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        self.app.cursor.execute("""
        CREATE TABLE IF NOT EXISTS blocked_users(
        blocker_id INTEGER,
        blocked_id INTEGER,
        PRIMARY KEY (blocker_id, blocked_id),
        FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE                        
        )
        """)
        self.app.cursor.execute("""
        CREATE TABLE IF NOT EXISTS friends_requests(
        sender_id INTEGER,
        receiver_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (sender_id, receiver_id),
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        users = self.app.users_cache.get_users()
        for u in users:
            self.cache[u["id"]] = {
                "friends": FriendsManager(u["id"], self),
                "requests": FriendRequestsManager(u["id"], self),
                "blocked": BlockedUsersManager(u["id"], self)
            }
        return self



class FriendsManager:
    def __init__(self, user_id, cache):
        self.user_id = user_id
        self.cache = cache
    
    def get_friends(self):
        self.cache.app.cursor.execute("""
            SELECT user2_id AS friend_id FROM friends WHERE user1_id = %s
            UNION
            SELECT user1_id AS friend_id FROM friends WHERE user2_id = %s
        """, (self.user_id, self.user_id))
        results = self.cache.app.cursor.fetchall()
        return [row['friend_id'] for row in results]
    
    def add_friend(self, user2_id):
        self.cache.app.cursor.execute("""
            INSERT INTO friends VALUES (%s, %s)
        """, (self.user_id, user2_id))
        return self
    
    def remove_friend(self, user2_id):
        self.cache.app.cursor.execute("""
            DELETE FROM friends
            WHERE (user1_id = %s AND user2_id = %s)
            OR (user1_id = %s AND user2_id = %s)
        """, (self.user_id, user2_id, user2_id, self.user_id))
        return self

class FriendRequestsManager:
    def __init__(self, user_id, cache):
        self.user_id = user_id
        self.cache = cache
    
    def send_request(self, receiver_id):
        self.cache.app.cursor.execute("""
            INSERT INTO friends_requests (sender_id, receiver_id) 
            VALUES (%s, %s)
        """, (self.user_id, receiver_id))
        return self
    
    def cancel_request(self, receiver_id):
        self.cache.app.cursor.execute("""
            DELETE FROM friends_requests 
            WHERE sender_id = %s AND receiver_id = %s
        """, (self.user_id, receiver_id))
        return self
    
    def get_sent_requests(self):
        self.cache.app.cursor.execute("""
            SELECT receiver_id, created_at 
            FROM friends_requests 
            WHERE sender_id = %s
        """, (self.user_id,))
        return self.cache.app.cursor.fetchall()
    
    def get_received_requests(self):
        self.cache.app.cursor.execute("""
            SELECT sender_id, created_at 
            FROM friends_requests 
            WHERE receiver_id = %s
        """, (self.user_id,))
        return self.cache.app. cursor.fetchall()
    
    def accept_request(self, sender_id):
        self.cache.app.cursor.execute("""
            INSERT INTO friends (user1_id, user2_id) 
            VALUES (%s, %s)
        """, (self.user_id, sender_id))
        
        self.reject_request(sender_id)
        return self
    
    def reject_request(self, sender_id):
        self.cache.app.cursor.execute("""
            DELETE FROM friends_requests 
            WHERE sender_id = %s AND receiver_id = %s
        """, (sender_id, self.user_id))
        return self
    
    def has_pending_request(self, other_user_id):
        self.cache.app.cursor.execute("""
            SELECT 1 FROM friends_requests 
            WHERE (sender_id = %s AND receiver_id = %s)
               OR (sender_id = %s AND receiver_id = %s)
            LIMIT 1
        """, (self. user_id, other_user_id, other_user_id, self.user_id))
        return self.cache.app.cursor.fetchone() is not None


class BlockedUsersManager:
    def __init__(self, user_id, cache):
        self.user_id = user_id
        self.cache = cache

    def block_user(self, blocked_id):
        self.cache.cache[self.user_id]["friends"].remove_friend(blocked_id)
        self.cache.app.cursor.execute("""
            INSERT INTO blocked_users (blocker_id, blocked_id) 
            VALUES (%s, %s)
        """, (self.user_id, blocked_id))
        return self

    def unblock_user(self, blocked_id):
        self.cache.app.cursor.execute("""
            DELETE FROM blocked_users 
            WHERE blocker_id = %s AND blocked_id = %s
        """, (self.user_id, blocked_id))
        return self

    def get_blocked_users(self):
        self.cache.app.cursor.execute("""
            SELECT blocked_id 
            FROM blocked_users 
            WHERE blocker_id = %s
        """, (self.user_id,))
        results = self.cache.app.cursor.fetchall()
        return [row['blocked_id'] for row in results]