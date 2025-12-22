import secrets


class UsersCache:
    def __init__(self, app):
        self.app = app
        self.cursor = app.cursor
        self.cache = {}

    def init_table(self):
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(255) NOT NULL,
            mail VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            date_of_birth VARCHAR(10),
            api_token VARCHAR(255) NOT NULL UNIQUE
        )
        """)
        users = self.get_users();
        for u in users:
            self.cache[u["id"]] = UserManager(u["id"], u, self)
        return self

    def create_user(self, data: dict):
        api_token = secrets.token_hex(32)
        data["api_token"] = api_token 
        self.cursor.execute(
        "INSERT INTO users (username, mail, password_hash, date_of_birth, api_token) VALUES (%s, %s, %s, %s, %s);",
        (data["username"], data["mail"], data["password_hash"], data["date_of_birth"], api_token)
        )
        user_id = self.cursor.lastrowid
        self.cache[user_id] = UserManager(user_id, data, self)
        self.app.relationships_cache.init_table()
        return self.cache[user_id]

    def delete_user(self, user_id: int):
        self.cursor.execute("DELETE FROM users WHERE id = %s;", (user_id,));
        if user_id in self.cache:
            del self.cache[user_id]
            
    def get_users(self):
        self.cursor.execute("SELECT * FROM users;")
        return self.cursor.fetchall()
    
    def get_user_by_token(self, api_token: str):
        for user in self.cache.values():
            if user.get("api_token") == api_token:
                return user
        return None


    


class UserManager:
    def __init__(self, user_id: int, data: dict, cache: UsersCache):
        self.user_id = user_id
        self.data = data
        self.cache = cache
        self.data["dirty"] = False

    def get(self, key: str):
        return self.data[key]

    def set(self, key: str, value: any):
        self.data[key] = value
        self.data["dirty"] = True
        return self

    def save(self):
        if not self.data.get("dirty"):
            return
        self.cache.cursor.execute("""
            UPDATE users
            SET username=%s,
                mail=%s,
                password_hash=%s,
                date_of_birth=%,
                api_token=%s
            WHERE id=%s;
        """, (
            self.data["username"],
            self.data["mail"],
            self.data["password_hash"],
            self.data["date_of_birth"],
            self.data["api_token"],
            self.user_id
        ))
        self.data["dirty"] = False
