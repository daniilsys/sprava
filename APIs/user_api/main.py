from pydantic import BaseModel
from fastapi import HTTPException, Header
from typing import Optional

class UserInfoDatas(BaseModel):
    user_id: int

class UserBatchInfoDatas(BaseModel):
    user_id: list[int]

class FriendRequestDatas(BaseModel):
    receiver_id: Optional[int] = None
    sender_id: Optional[int] = None
    friend_id: Optional[int] = None

class UserAPI:
    def __init__(self, app):
        self.app = app
        self.get_user()
        self.get_user_batch()

        self.get_friends()
        self.remove_friend()

        self.get_friend_requests()
        self.send_friend_request()
        self.accept_friend_request()
        self.reject_friend_request()
        self.cancel_friend_request()

        self.get_blocked_users()
        self.block_user()
        self.unblock_user()

    def _get_user_from_token(self, authorization):
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header given")
        
        user = self.app.users_cache.get_user_by_token(authorization)
        if not user: 
            raise HTTPException(status_code=401, detail="No user found with this token")
        
        return user
    
    def get_user(self):
        @self.app.get("/user", tags=["User Info"])
        def root(user_id:  int, authorization: str = Header(None)):
            requester = self._get_user_from_token(authorization)
            
            if user_id not in self.app.users_cache.cache:
                return {
                    "status_code": 404,
                    "message": "The given user_id is not related to any users."
                }
            user = self.app.users_cache.cache[user_id]
            return {
                "status_code": 200,
                "user_id": user.user_id,
                "username": user.get("username"),
                "mail": user.get("mail"),
                "date_of_birth": user.get("date_of_birth")
            }

    def get_user_batch(self):
        @self.app.post("/user/batch", tags=["User Info"])
        def root(data: UserBatchInfoDatas, authorization: str = Header(None)):
            self._get_user_from_token(authorization)

            user_ids = data.user_id
            users_info = []

            for uid in user_ids:
                if uid in self.app.users_cache.cache:
                    user = self.app.users_cache.cache[uid]
                    users_info.append({
                        "user_id": user.user_id,
                        "username": user.get("username"),
                        "mail": user.get("mail"),
                        "date_of_birth": user.get("date_of_birth")
                    })

            return {
                "status_code":  200,
                "users":  users_info
            }

    def get_friends(self):
        @self.app.get("/me/friends", tags=["Friends"])
        def root(authorization:  str = Header(None)):
            user = self._get_user_from_token(authorization)

            relationship = self.app.relationships_cache.cache[user.user_id]["friends"]
            return {
                "status_code": 200,
                "friends_ids": relationship.get_friends()
            }

    def remove_friend(self):
        @self.app.delete("/me/remove_friend", tags=["Friends"])
        def root(data: FriendRequestDatas, authorization: str = Header(None)):
            user = self._get_user_from_token(authorization)

            relationship = self.app.relationships_cache.cache[user.user_id]["friends"]

            if data.friend_id not in self.app.users_cache.cache:
                return {
                    "status_code":  404,
                    "message": "The given friend_id is not related to any users."
                }

            friends = relationship.get_friends()
            if data.friend_id not in friends: 
                return {
                    "status_code": 400,
                    "message": "You are not friends with this user."
                }

            relationship.remove_friend(data.friend_id)

            return {
                "status_code": 200,
                "message": "Friend removed.",
                "user_id": user.user_id,
                "removed_friend_id": data.friend_id
            }

    def get_friend_requests(self):
        @self.app.get("/me/friend_requests", tags=["Friends Requests"])
        def root(authorization: str = Header(None)):
            user = self._get_user_from_token(authorization)

            relationship = self.app.relationships_cache.cache[user.user_id]["requests"]
            return {
                "status_code": 200,
                "friend_requests_ids": relationship.get_received_requests()
            }

    def send_friend_request(self):
        @self.app.post("/me/send_friend_request", tags=["Friends Requests"])
        async def root(data: FriendRequestDatas, authorization: str = Header(None)):
            user = self._get_user_from_token(authorization)

            relationship = self.app.relationships_cache.cache[user.user_id]["requests"]

            if data.receiver_id not in self.app.users_cache.cache:
                return {
                    "status_code":  404,
                    "message": "The given receiver_id is not related to any users."
                }

            if data.receiver_id == user.user_id:
                return {
                    "status_code":  400,
                    "message": "You cannot send a friend request to yourself."
                }

            if relationship.has_pending_request(data.receiver_id):
                return {
                    "status_code": 409,
                    "message": "A friend request already exists between these users."
                }

            friends = self.app.relationships_cache.cache[user.user_id]["friends"]
            if data.receiver_id in friends.get_friends():
                return {
                    "status_code": 409,
                    "message": "You are already friends with this user."
                }

            relationship.send_request(data.receiver_id)

            await self.app.websocket_managers.send_personal_message(data.receiver_id, {
                "type": "new_friend_request",
                "sender_id": user.user_id,
                "sender_username": user.get("username")
            })

            return {
                "status_code":  200,
                "message":  "Friend request sent.",
                "user_id": user.user_id,
                "receiver_id": data.receiver_id
            }

    def cancel_friend_request(self):
        @self.app.delete("/me/cancel_friend_request", tags=["Friends Requests"])
        def root(data: FriendRequestDatas, authorization: str = Header(None)):
            user = self._get_user_from_token(authorization)

            relationship = self.app.relationships_cache.cache[user.user_id]["requests"]

            if data.receiver_id not in self.app.users_cache.cache:
                return {
                    "status_code":  404,
                    "message": "The given receiver_id is not related to any users."
                }

            if not relationship.has_pending_request(data.receiver_id):
                return {
                    "status_code": 404,
                    "message":  "No pending friend request exists between these users."
                }

            relationship.cancel_request(data.receiver_id)

            return {
                "status_code": 200,
                "message": "Friend request canceled.",
                "user_id": user.user_id,
                "receiver_id": data.receiver_id
            }

    def accept_friend_request(self):
        @self.app.post("/me/accept_friend_request", tags=["Friends Requests"])
        async def root(data: FriendRequestDatas, authorization: str = Header(None)):
            user = self._get_user_from_token(authorization)

            relationship_requests = self.app.relationships_cache.cache[user.user_id]["requests"]

            if data.sender_id not in self.app.users_cache.cache:
                return {
                    "status_code":  404,
                    "message": "The given sender_id is not related to any users."
                }

            if not relationship_requests.has_pending_request(data.sender_id):
                return {
                    "status_code": 404,
                    "message": "No pending friend request exists between these users."
                }

            relationship_requests.accept_request(data.sender_id)
            await self.app.websocket_managers.send_personal_message(data.sender_id, {
                "type": "friend_request_accepted",
                "friend_id": user.user_id,
                "friend_username": user.get("username")
            })

            return {
                "status_code": 200,
                "message": "Friend request accepted.",
                "user_id": user.user_id,
                "new_friend_id": data.sender_id
            }

    def reject_friend_request(self):
        @self.app.delete("/me/reject_friend_request", tags=["Friends Requests"])
        def root(data: FriendRequestDatas, authorization:  str = Header(None)):
            user = self._get_user_from_token(authorization)

            relationship_requests = self.app.relationships_cache.cache[user.user_id]["requests"]

            if data.sender_id not in self.app.users_cache.cache:
                return {
                    "status_code": 404,
                    "message": "The given sender_id is not related to any users."
                }

            if not relationship_requests.has_pending_request(data.sender_id):
                return {
                    "status_code": 404,
                    "message":  "No pending friend request exists between these users."
                }

            relationship_requests.reject_request(data.sender_id)

            return {
                "status_code":  200,
                "message":  "Friend request rejected.",
                "user_id": user.user_id,
                "rejected_friend_id": data.sender_id
            }

    def get_blocked_users(self):
        @self.app.get("/me/blocked_users", tags=["Blocked Users"])
        def root(authorization: str = Header(None)):
            user = self._get_user_from_token(authorization)

            relationship_blocked = self.app.relationships_cache.cache[user.user_id]["blocked"]
            return {
                "status_code": 200,
                "blocked_users_ids":  relationship_blocked.get_blocked_users()
            }

    def block_user(self):
        @self.app.post("/me/block_user", tags=["Blocked Users"])
        def root(data: FriendRequestDatas, authorization: str = Header(None)):
            user = self._get_user_from_token(authorization)

            relationship_blocked = self.app.relationships_cache.cache[user.user_id]["blocked"]
            
            if data.friend_id not in self.app.users_cache.cache:
                return {
                    "status_code": 404,
                    "message": "The given user_id is not related to any users."
                }

            relationship_blocked.block_user(data.friend_id)

            return {
                "status_code": 200,
                "message": "User blocked.",
                "user_id": user.user_id,
                "blocked_user_id":  data.friend_id
            }

    def unblock_user(self):
        @self.app.delete("/me/unblock_user", tags=["Blocked Users"])
        def root(data:  FriendRequestDatas, authorization: str = Header(None)):
            user = self._get_user_from_token(authorization)

            relationship_blocked = self.app.relationships_cache.cache[user.user_id]["blocked"]

            if data.friend_id not in self.app.users_cache.cache:
                return {
                    "status_code": 404,
                    "message":  "The given user_id is not related to any users."
                }

            relationship_blocked.unblock_user(data.friend_id)

            return {
                "status_code": 200,
                "message": "User unblocked.",
                "user_id": user.user_id,
                "unblocked_user_id": data.friend_id
            }