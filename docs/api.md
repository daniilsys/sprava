# REST API

## Service basics

- **Base URL:** `http://<host>:8000` (Uvicorn in `backend/APIs/main.py` runs on `0.0.0.0:8000`).
- **CORS:** Fully open (`allow_origins=["*"]`, all methods/headers allowed).
- **Auth:** Most endpoints expect an `authorization` header containing the user `api_token` (not `Bearer`-prefixed).
- **Body format:** JSON for most endpoints, `multipart/form-data` for file uploads.

## Endpoint catalog

### Authentication

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/signup` | Create user account | No | JSON: `{ username, mail, password, date_of_birth }` | `200` body: `{ status_code: 200, user_id, username, mail, date_of_birth, api_token }` | `401` body: `{ status_code: 401, message }` |
| POST | `/login` | Login | No | JSON: `{ mail, password }` | `200` body: `{ status_code: 200, user_id, username, mail, date_of_birth, api_token, avatar_id }` | `401` body: `{ status_code: 401, message }` |

### Users

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/me` | Get information about me | Yes | - | `{status_code: 200, user_id, username, mail, date_of_birth, api_token, avatar_id }` | `{ status_code: 401, message }` |
| GET | `/user` | Get user by id | Yes | Query: `user_id` | `200` body: `{ status_code: 200, user_id, username, mail, date_of_birth, avatar_id }` | `404` body: `{ status_code: 404, message }` |
| GET | `/user/username` | Get user by username | Yes | Query: `username` | `200` body: `{ status_code: 200, user_id, username, mail, date_of_birth, avatar_id }` | `404` body: `{ status_code: 404, message }` |
| POST | `/user/batch` | Get user info for multiple ids | Yes | JSON: `{ user_id: [int, ...] }` | `200` body: `{ status_code: 200, users: [ { user_id, username, mail, date_of_birth, avatar_id }, ... ] }` | — |
| POST | `/me/change_username` | Update username | Yes | JSON: `{ username }` | `200` body: `{ status_code: 200, message, user_id, new_username }` | — |
| POST | `/me/change_password` | Update password | Yes | JSON: `{ password }` | `200` body: `{ status_code: 200, message, user_id }` | — |
| POST | `/me/change_date_of_birth` | Update date of birth | Yes | JSON: `{ date_of_birth }` | `200` body: `{ status_code: 200, message, user_id, new_date_of_birth }` | — |
| POST | `/me/change_mail` | Update email | Yes | JSON: `{ mail }` | `200` body: `{ status_code: 200, message, user_id, new_mail }` | — |
| POST | `/me/change_avatar` | Update avatar | Yes | Multipart: `file` (image) | `200` body: `{ status_code: 200, message, user_id, avatar_id }` | `400` invalid file type; `413` file too large (5MB) |

### Friends

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/me/friends` | List friend ids | Yes | — | `200` body: `{ status_code: 200, friends_ids: [int, ...] }` | — |
| DELETE | `/me/remove_friend` | Remove a friend | Yes | JSON: `{ friend_id }` | `200` body: `{ status_code: 200, message, user_id, removed_friend_id }` | `404` unknown friend id; `400` not friends |

### Friend requests

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/me/friend_requests` | List received request ids | Yes | — | `200` body: `{ status_code: 200, friend_requests_ids: [int, ...] }` | — |
| POST | `/me/send_friend_request` | Send request | Yes | JSON: `{ receiver_id }` | `200` body: `{ status_code: 200, message, user_id, receiver_id }` | `404` unknown receiver; `400` self-request; `409` request exists or already friends |
| DELETE | `/me/cancel_friend_request` | Cancel sent request | Yes | JSON: `{ receiver_id }` | `200` body: `{ status_code: 200, message, user_id, receiver_id }` | `404` unknown receiver or no pending request |
| POST | `/me/accept_friend_request` | Accept received request | Yes | JSON: `{ sender_id }` | `200` body: `{ status_code: 200, message, user_id, new_friend_id }` | `404` unknown sender or no pending request |
| DELETE | `/me/reject_friend_request` | Reject received request | Yes | JSON: `{ sender_id }` | `200` body: `{ status_code: 200, message, user_id, rejected_friend_id }` | `404` unknown sender or no pending request |

### Blocking

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/me/blocked_users` | List blocked user ids | Yes | — | `200` body: `{ status_code: 200, blocked_users_ids: [int, ...] }` | — |
| POST | `/me/block_user` | Block user | Yes | JSON: `{ friend_id }` | `200` body: `{ status_code: 200, message, user_id, blocked_user_id }` | `404` unknown user id |
| DELETE | `/me/unblock_user` | Unblock user | Yes | JSON: `{ friend_id }` | `200` body: `{ status_code: 200, message, user_id, unblocked_user_id }` | `404` unknown user id |

### Conversations

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/create_conversation` | Start a conversation | Yes | JSON: `{ user2_id }` | `200` body: `{ status_code: 200, conversation_id }` | `404` unknown user; `403` not friends or blocked |
| DELETE | `/delete_conversation` | Delete conversation | Yes | JSON: `{ conversation_id }` | `200` body: `{ status_code: 200, message }` | — |
| GET | `/me/conversations` | List conversations | Yes | — | `200` body: `{ status_code: 200, conversations: [...] }` | — |
| GET | `/conversation/messages` | List messages | Yes | Query: `conversation_id`, `limit` (default 50), `offset` (default 0) | `200` body: `{ status_code: 200, messages: [...] }` | — |
| POST | `/conversation/send_message` | Send message | Yes | JSON: `{ conversation_id, content }` | `200` body: `{ status_code: 200, message_id, content, message }` | `403` blocked |
| DELETE | `/conversation/delete_message` | Delete own message | Yes | JSON: `{ message_id }` | `200` body: `{ status_code: 200, deleted_message_id, message }` | `403` not sender; `404` message not found |
| PUT | `/conversation/read` | Mark conversation read | Yes | JSON: `{ conversation_id }` | `200` body: `{ status_code: 200, message }` | — |

### Media

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/media/` | Download media by id | No (header accepted but not validated) | Query: `media_id` | `200` file response | `404` HTTP error |
| GET | `/media/avatar` | Download avatar | Yes | Query: `avatar_id` | `200` file response | `404` HTTP error |
| GET | `/media/message/` | List media ids for message | Yes | Query: `message_id` | `200` body: `[media_id, ...]` | `404` HTTP error |
| POST | `/media/upload` | Upload message media | Yes | Query: `message_id`, Multipart: `file` | `200` body: result from `MediaDatabase.create_media` | — |

## Example requests

### Sign up

```bash
curl -X POST http://localhost:8000/signup \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","mail":"alice@example.com","password":"secret","date_of_birth":"1990-01-01"}'
```

### Get user

```bash
curl http://localhost:8000/user?user_id=1 \
  -H 'authorization: <api_token>'
```

### Send friend request

```bash
curl -X POST http://localhost:8000/me/send_friend_request \
  -H 'Content-Type: application/json' \
  -H 'authorization: <api_token>' \
  -d '{"receiver_id": 2}'
```

### Send conversation message

```bash
curl -X POST http://localhost:8000/conversation/send_message \
  -H 'Content-Type: application/json' \
  -H 'authorization: <api_token>' \
  -d '{"conversation_id": 10, "content": "Hello"}'
```

### Upload avatar

```bash
curl -X POST http://localhost:8000/me/change_avatar \
  -H 'authorization: <api_token>' \
  -F 'file=@/path/to/avatar.png'
```

### Upload message media

```bash
curl -X POST 'http://localhost:8000/media/upload?message_id=123' \
  -H 'authorization: <api_token>' \
  -F 'file=@/path/to/file.png'
```
