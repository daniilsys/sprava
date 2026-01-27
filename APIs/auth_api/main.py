from pydantic import BaseModel
import bcrypt


class SignUpDatas(BaseModel):
    username: str
    mail: str
    password: str
    date_of_birth: str

class LoginDatas(BaseModel):
    mail: str
    password: str

class AuthAPI:
    def __init__(self, app):
        self.app = app
        self.signup()
        self.login()

    def signup(self):
        @self.app.post("/signup", tags=["Authentication"],
                       description="Create a new user account.")
        def root(data: SignUpDatas):
            if not data.username or  not data.mail or not data.password:
                return {
                    "status_code": 401,
                    "message": "Missing required informations about user."
            }
            
            password_hash = bcrypt.hashpw(
                data.password.encode("utf-8"),
                bcrypt.gensalt()
            ).decode("utf-8")

            created_user = self.app.users_cache.create_user({
                "username": data.username,
                "mail": data.mail,
                "password_hash": password_hash,
                "date_of_birth": data.date_of_birth
            })

            return {
                "status_code": 200,
                "user_id": created_user.user_id,
                "username": created_user.get("username"),
                "mail": created_user.get("mail"),
                "phone": created_user.get("phone"),
                "date_of_birth": created_user.get("date_of_birth"),
                "api_token": created_user.get("api_token")
            }
        
    def login(self):
        @self.app.post("/login", tags=["Authentication"], 
                       description="Login to an existing user account.")
        def root(data: LoginDatas):
            if not data.mail or not data.password:
                return {
                    "status_code": 401,
                    "message": "Missing informations (mail, password) for a login attempt."
                }
            user = None
            for u in self.app.users_cache.cache.values():
                if u.get("mail") == data.mail:
                    user = u
                    break

            if not user:
                return {"status_code": 401, "message": "User or password invalid."}

            if bcrypt.checkpw(data.password.encode(), user.get("password_hash").encode()):
                return {
                    "status_code": 200,
                    "user_id": user.user_id,
                    "username": user.get("username"),
                    "mail": user.get("mail"),
                    "phone": user.get("phone"),
                    "date_of_birth": user.get("date_of_birth"),
                    "api_token": user.get("api_token"),
                    "avatar_id": user.get("avatar_id")
                }
            else:
                return {"status_code": 401, "message": "User or password invalid."}
            

            

            