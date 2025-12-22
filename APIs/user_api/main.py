from pydantic import BaseModel

class UserRequestsDatas(BaseModel):
    api_token: str

class FriendRequestDatas(BaseModel):
    api_token: str
    receiver_id: int = None
    sender_id: int = None
    friend_id : int = None

class UserAPI:
    def __init__(self, app):
        self.app = app
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
        
    def get_friends(self):
        @self.app.get("/me/friends", tags=["Friends"])
        def root(data: UserRequestsDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            relationship = self.app.relationships_cache.cache[user.user_id]["friends"]
            return {
                "status_code": 200,
                "friends_ids": relationship.get_friends()
            }

    def remove_friend(self):
        @self.app.delete("/me/remove_friend", tags=["Friends"])
        def root(data: FriendRequestDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            relationship = self.app.relationships_cache.cache[user.user_id]["friends"]
            if data.friend_id not in self.app.users_cache.cache:
                return {
                    "status_code": 401,
                    "message": "The given receiver_id is not related to any users."
                }
            friends = relationship.get_friends()
            if data.friend_id not in friends:
                return {
                    "status_code": 401,
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
        def root(data: UserRequestsDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            relationship = self.app.relationships_cache.cache[user.user_id]["requests"]
            return {
                "status_code": 200,
                "friend_requests_ids": relationship.get_received_requests()
            }

    def send_friend_request(self):
        @self.app.post("/me/send_friend_request", tags=["Friends Requests"])
        def root(data: FriendRequestDatas):
            user =  self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            relationship = self.app.relationships_cache.cache[user.user_id]["requests"]

            if data.receiver_id not in self.app.users_cache.cache:
                return {
                    "status_code": 401,
                    "message": "The given receiver_id is not related to any users."
                }
            
            if data.receiver_id == user.user_id:
                return {
                    "status_code": 401,
                    "message": "You cannot send a friend request to yourself."
                }
            
            if relationship.has_pending_request(data.receiver_id):
                return {
                    "status_code": 401,
                    "message": "A friend request already exists between these users."
                }
            
            friends = self.app.relationships_cache.cache[user.user_id]["friends"]
            if data.receiver_id in friends.get_friends():
                return {
                    "status_code":  401,
                    "message": "You are already friends with this user."
                }
            
            relationship.send_request(data.receiver_id)

            return {
                "status_code": 200,
                "message": "Friend request sent.",
                "user_id": user.user_id,
                "receiver_id": data.receiver_id
            }
    
    def cancel_friend_request(self):
        @self.app.delete("/me/cancel_friend_request", tags=["Friends Requests"])
        def root(data: FriendRequestDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            relationship = self.app.relationships_cache.cache[user.user_id]["requests"]
            if data.receiver_id not in self.app.users_cache.cache:
                return {
                    "status_code": 401,
                    "message": "The given receiver_id is not related to any users."
                }
            if not relationship.has_pending_request(data.receiver_id):
                return {
                    "status_code": 401,
                    "message": "No pending friend request exists between these users."
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
        def root(data: FriendRequestDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            relationship_requests = self.app.relationships_cache.cache[user.user_id]["requests"]
            if data.sender_id not in self.app.users_cache.cache:
                return {
                    "status_code": 401,
                    "message": "The given receiver_id is not related to any users."
                }
            if not relationship_requests.has_pending_request(data.sender_id):
                return {
                    "status_code": 401,
                    "message": "No pending friend request exists between these users."
                }
            relationship_requests.accept_request(data.sender_id)

            return {
                "status_code": 200,
                "message": "Friend request accepted.",
                "user_id": user.user_id,
                "new_friend_id": data.sender_id
            }

    def reject_friend_request(self):
        @self.app.delete("/me/reject_friend_request", tags=["Friends Requests"])
        def root(data: FriendRequestDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            relationship_requests = self.app.relationships_cache.cache[user.user_id]["requests"]
            if data.sender_id not in self.app.users_cache.cache:
                return {
                    "status_code": 401,
                    "message": "The given receiver_id is not related to any users."
                }
            if not relationship_requests.has_pending_request(data.sender_id):
                return {
                    "status_code": 401,
                    "message": "No pending friend request exists between these users."
                }
            relationship_requests.reject_request(data.sender_id)

            return {
                "status_code": 200,
                "message": "Friend request rejected.",
                "user_id": user.user_id,
                "rejected_friend_id": data.sender_id
            }


    def get_blocked_users(self):
        @self.app.get("/me/blocked_users", tags=["Blocked Users"])
        def root(data: UserRequestsDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            relationship_blocked = self.app.relationships_cache.cache[user.user_id]["blocked"]
            return {
                "status_code": 200,
                "blocked_users_ids": relationship_blocked.get_blocked_users()
            }

    def block_user(self):
        @self.app.post("/me/block_user", tags=["Blocked Users"])
        def root(data: FriendRequestDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            relationship_blocked = self.app.relationships_cache.cache[user.user_id]["blocked"]
            if data.friend_id not in self.app.users_cache.cache:
                return {
                    "status_code": 401,
                    "message": "The given blocked_id is not related to any users."
                }
            relationship_blocked.block_user(data.friend_id)

            return {
                "status_code": 200,
                "message": "User blocked.",
                "user_id": user.user_id,
                "blocked_user_id": data.friend_id
            }

    def unblock_user(self):
        @self.app.delete("/me/unblock_user", tags=["Blocked Users"])
        def root(data: FriendRequestDatas):
            user = self.app.users_cache.get_user_by_token(data.api_token)
            if not user:
                return {
                    "status_code": 401,
                    "message": "No user found with this token"
                }
            relationship_blocked = self.app.relationships_cache.cache[user.user_id]["blocked"]
            if data.friend_id not in self.app.users_cache.cache:
                return {
                    "status_code": 401,
                    "message": "The given blocked_id is not related to any users."
                }
            relationship_blocked.unblock_user(data.friend_id)

            return {
                "status_code": 200,
                "message": "User unblocked.",
                "user_id": user.user_id,
                "unblocked_user_id": data.friend_id
            }