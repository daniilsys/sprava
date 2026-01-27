class UsersProfileCache:
    def __init__(self, app):
        self.app = app
        self.cache = {}
    
    def create_user_profile(self, data: dict):
        conn, cursor = self.app.get_cursor()
        try:
            cursor.execute(
            "INSERT INTO users_profile (user_id, bio, avatar_url, location, website, share_location, share_mail, share_phone, share_date_of_birth) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);",
            (data["user_id"], data.get("bio"), data.get("avatar_url"), data.get("location"), data.get("website"), data.get("share_location", "nobody"), data.get("share_mail", "nobody"), data.get("share_phone", "nobody"), data.get("share_date_of_birth", "nobody"))
            )
            user_id = data["user_id"]
            self.cache[user_id] = UsersProfileManager(user_id, data, self)
            return self.cache[user_id]
        finally: 
            cursor.close()
            conn.close()

    def get_users_profile(self):
        conn, cursor = self.app.get_cursor()
        try:
            cursor.execute("SELECT * FROM users_profile;")
            rows = cursor.fetchall()
            for row in rows:
                user_id = row["user_id"]
                self.cache[user_id] = UsersProfileManager(user_id, row, self)
            return self.cache
        finally:
            cursor.close()
            conn.close()

    def get_or_create(self, user_id: int):
        if user_id in self.cache:
            return self.cache[user_id]
        conn, cursor = self.app.get_cursor()
        try:
            cursor.execute("SELECT * FROM users_profile WHERE user_id = %s;", (user_id,))
            row = cursor.fetchone()
            if row:
                self.cache[user_id] = UsersProfileManager(user_id, row, self)
                return self.cache[user_id]
            else:
                data = {
                    "user_id": user_id,
                    "bio": None,
                    "avatar_url": None,
                    "location": None,
                    "website": None,
                    "share_location": "nobody",
                    "share_mail": "nobody",
                    "share_phone": "nobody",
                    "share_date_of_birth": "nobody"
                }
                return self.create_user_profile(data)
        finally:
            cursor.close()
            conn.close()
        
    def init_table(self):
        conn, cursor = self.app.get_cursor()
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users_profile (
                    user_id INT PRIMARY KEY,
                    bio TEXT,
                    avatar_url VARCHAR(255),
                    location VARCHAR(100),
                    website VARCHAR(255),
                    share_location ENUM ('nobody', 'friends', 'everyone') DEFAULT 'nobody',
                    share_mail ENUM ('nobody', 'friends', 'everyone') DEFAULT 'nobody',
                    share_phone ENUM ('nobody', 'friends', 'everyone') DEFAULT 'nobody',
                    share_date_of_birth ENUM ('nobody', 'friends', 'everyone') DEFAULT 'nobody',
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """)
            self.get_users_profile()
            return self
        finally:
            cursor.close()
            conn.close()
            




class UsersProfileManager:
    def __init__(self, user_id: int, data: dict, cache: UsersProfileCache):
        self.user_id = user_id
        self.data = data
        self.cache = cache
        self.data["dirty"] = False

    def get(self, key: str):
        return self.data[key] if key in self.data else None

    def set(self, key: str, value: any):
        self.data[key] = value
        self.data["dirty"] = True
        return self

    def save(self):
        if not self.data.get("dirty"):
            return
        conn, cursor = self.cache.app.get_cursor()
        try:
            cursor.execute("""
                UPDATE users_profile
                SET bio = %s,
                    avatar_url = %s,
                    location = %s,
                    website = %s,
                    share_location = %s,
                    share_mail = %s,
                    share_phone = %s,
                    share_date_of_birth = %s
                WHERE user_id = %s;
            """, (
                self.data.get("bio"),
                self.data.get("avatar_url"),
                self.data.get("location"),
                self.data.get("website"),
                self.data.get("share_location", "nobody"),
                self.data.get("share_mail", "nobody"),
                self.data.get("share_phone", "nobody"),
                self.data.get("share_date_of_birth", "nobody"),
                self.user_id
            ))
            self.data["dirty"] = False
            return self
        finally:
            cursor.close()
            conn.close()