# Sprava REST API

## Service basics

- **Base URL:** `http://<host>:8000` (Uvicorn runs on `0.0.0.0:8000`).
- **CORS:** Fully open (all origins / methods / headers).
- **Auth:** Most endpoints expect an `authorization` header containing the user `api_token` (**no** `Bearer` prefix).
- **Body format:** JSON for most endpoints, `multipart/form-data` for file uploads.

### Common concepts

#### Visibility enum (user profile)

Some profile fields use a visibility enum:

- `nobody` — never visible to other users
- `friends` — visible only to friends
- `everyone` — visible to all users

Backend should apply the visibility rules (frontend should not “guess” what is visible).

---

## Endpoint catalog

### Authentication

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/signup` | Create user account | No | JSON: `{ username, mail, password, date_of_birth }` | `200` body: `{ status_code: 200, user_id, username, mail, date_of_birth, api_token }` | `401` body: `{ status_code: 401, message }` |
| POST | `/login` | Login | No | JSON: `{ mail, password }` | `200` body: `{ status_code: 200, user_id, username, mail, date_of_birth, api_token, avatar_id }` | `401` body: `{ status_code: 401, message }` |

### Users

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/me` | Get information about me | Yes | — | `200` body: `{ status_code: 200, user_id, username, mail, date_of_birth, api_token, avatar_id }` | `401` body: `{ status_code: 401, message }` |
| GET | `/user` | Get user by id | Yes | Query: `user_id` | `200` body: `{ status_code: 200, user_id, username, mail, date_of_birth, avatar_id }` | `404` body: `{ status_code: 404, message }` |
| GET | `/user/username` | Get user by username | Yes | Query: `username` | `200` body: `{ status_code: 200, user_id, username, mail, date_of_birth, avatar_id }` | `404` body: `{ status_code: 404, message }` |
| POST | `/user/batch` | Get user info for multiple ids | Yes | JSON: `{ user_id: [int, ...] }` | `200` body: `{ status_code: 200, users: [ { user_id, username, mail, date_of_birth, avatar_id }, ... ] }` | — |
| POST | `/me/change_username` | Update username | Yes | JSON: `{ username }` | `200` body: `{ status_code: 200, message, user_id, new_username }` | — |
| POST | `/me/change_password` | Update password | Yes | JSON: `{ password }` | `200` body: `{ status_code: 200, message, user_id }` | — |
| POST | `/me/change_date_of_birth` | Update date of birth | Yes | JSON: `{ date_of_birth }` | `200` body: `{ status_code: 200, message, user_id, new_date_of_birth }` | — |
| POST | `/me/change_mail` | Update email | Yes | JSON: `{ mail }` | `200` body: `{ status_code: 200, message, user_id, new_mail }` | — |
| POST | `/me/change_avatar` | Update avatar | Yes | Multipart: `file` (image) | `200` body: `{ status_code: 200, message, user_id, avatar_id }` | `400` invalid file type; `413` file too large (5MB) |

### User Profile (privacy-controlled fields)

This is the “shareable profile” layer (bio, location, website, and visibility flags).

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/me/update_profile` | Update **my** profile fields (partial update) | Yes | JSON (any subset): `{ bio?, location?, website?, share_location?, share_mail?, share_phone?, share_date_of_birth? }` where each `share_*` is one of `nobody \| friends \| everyone` | `200` body: `{ status_code: 200, message, user_id }` | `401` invalid token; `400` invalid visibility |
| GET | `/user/profile` | Get profile view for a given user (filtered by visibility + friendship + blocking rules) | Yes | Query: `user_id` | `200` body: `{ status_code: 200, user_id, bio, website, location?, phone?, mail?, date_of_birth? }` (hidden fields are `null`) | `404` unknown user; `403` blocked |

> Recommendation: also expose `GET /me/profile` (unfiltered) for settings pages. (Not required if you already use `/me` + cached profile internally.)

### Friends

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/me/friends` | List friend ids | Yes | — | `200` body: `{ status_code: 200, friends_ids: [int, ...] }` | — |
| DELETE | `/me/remove_friend` | Remove a friend | Yes | JSON: `{ friend_id }` | `200` body: `{ status_code: 200, message, user_id, removed_friend_id }` | `404` unknown friend id; `400` not friends |

### Friend requests

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/me/friend_requests` | List received request sender ids | Yes | — | `200` body: `{ status_code: 200, friend_requests: [int, ...] }` | — |
| POST | `/me/send_friend_request` | Send request | Yes | JSON: `{ receiver_id }` | `200` body: `{ status_code: 200, message, user_id, receiver_id }` | `404` unknown receiver; `400` self-request; `409` request exists or already friends |
| DELETE | `/me/cancel_friend_request` | Cancel sent request | Yes | JSON: `{ receiver_id }` | `200` body: `{ status_code: 200, message, user_id, receiver_id }` | `404` unknown receiver or no pending request |
| POST | `/me/accept_friend_request` | Accept received request | Yes | JSON: `{ sender_id }` | `200` body: `{ status_code: 200, message, user_id, new_friend_id }` | `404` unknown sender or no pending request |
| DELETE | `/me/reject_friend_request` | Reject received request | Yes | JSON: `{ sender_id }` | `200` body: `{ status_code: 200, message, user_id, rejected_friend_id }` | `404` unknown sender or no pending request |

> Note: older implementations sometimes returned `friend_requests_ids`. Standardize on `friend_requests`.

### Blocking

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/me/blocked_users` | List blocked user ids | Yes | — | `200` body: `{ status_code: 200, blocked_users_ids: [int, ...] }` | — |
| POST | `/me/block_user` | Block user | Yes | JSON: `{ friend_id }` | `200` body: `{ status_code: 200, message, user_id, blocked_user_id }` | `404` unknown user id |
| DELETE | `/me/unblock_user` | Unblock user | Yes | JSON: `{ friend_id }` | `200` body: `{ status_code: 200, message, user_id, unblocked_user_id }` | `404` unknown user id |

### Conversations

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/create_conversation` | Start (or get) a conversation | Yes | JSON: `{ user2_id }` | `200` body: `{ status_code: 200, conversation_id }` | `404` unknown user; `403` not friends or blocked |
| DELETE | `/delete_conversation` | Delete conversation | Yes | JSON: `{ conversation_id }` | `200` body: `{ status_code: 200, message }` | — |
| GET | `/me/conversations` | List conversations | Yes | — | `200` body: `{ status_code: 200, conversations: [...] }` | — |
| GET | `/conversation/messages` | List messages | Yes | Query: `conversation_id`, `limit` (default 50), `offset` (default 0) | `200` body: `{ status_code: 200, messages: [...] }` | — |
| POST | `/conversation/send_message` | Send message | Yes | JSON: `{ conversation_id, content }` | `200` body: `{ status_code: 200, message_id, content, message }` | `403` blocked |
| DELETE | `/conversation/delete_message` | Delete own message | Yes | JSON: `{ message_id }` | `200` body: `{ status_code: 200, deleted_message_id, message }` | `403` not sender; `404` message not found |
| PUT | `/conversation/read` | Mark conversation read | Yes | JSON: `{ conversation_id }` | `200` body: `{ status_code: 200, message }` | — |

### Media

| Method | Path | Purpose | Auth | Request | Success response | Error response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/media` | Retrieve media **metadata** by id | No (header accepted but not validated) | Query: `media_id` | JSON: `{ id, filename, file_size, message_id }` | `404` HTTP error |
| GET | `/media/download` | Download a media file by id | No | Query: `media_id` | File response | `404` HTTP error |
| GET | `/media/avatar` | Download avatar by `avatar_id` | Yes | Query: `avatar_id` | File response | `404` HTTP error |
| GET | `/media/message/` | List media ids for a message | Yes | Query: `message_id` | `200` body: `[media_id, ...]` | `404` HTTP error |
| POST | `/media/upload` | Upload message media | Yes | Query: `message_id`, Multipart: `file` | `200` body: result from `MediaDatabase.create_media` | — |

---

## Example requests

### Update my profile

```bash
curl -X POST http://localhost:8000/me/update_profile   -H 'Content-Type: application/json'   -H 'authorization: <api_token>'   -d '{"bio":"Hello","share_mail":"friends","share_location":"everyone"}'
```

### Get a user profile (filtered)

```bash
curl 'http://localhost:8000/user/profile?user_id=2'   -H 'authorization: <api_token>'
```

### Upload avatar

```bash
curl -X POST http://localhost:8000/me/change_avatar   -H 'authorization: <api_token>'   -F 'file=@/path/to/avatar.png'
```

### Upload message media

```bash
curl -X POST 'http://localhost:8000/media/upload?message_id=123'   -H 'authorization: <api_token>'   -F 'file=@/path/to/file.png'
```
