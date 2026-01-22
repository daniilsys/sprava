# WebSocket API

## Connection

- **URL:** `ws://<host>:8000/ws/{api_token}`
- **Auth:** `api_token` is part of the path. If invalid, server closes with code `4008`.
- **Heartbeat:** none implemented.
- **Reconnection:** none implemented server-side.

On connect, the server:
- Accepts the socket.
- Marks the user online and notifies online friends via `friend_status_change`.

On disconnect, the server:
- Marks the user offline and notifies online friends via `friend_status_change`.

## Client → Server messages

| Type | Payload | Behavior |
| --- | --- | --- |
| `send_message` | `{ type: "send_message", receiver_id, content }` | Creates/sends message between sender/receiver. |
| `typing` | `{ type: "typing", receiver_id }` | Notifies receiver that sender is typing. |
| `stop_typing` | `{ type: "stop_typing", receiver_id }` | Notifies receiver typing stopped. |
| `mark_read` | `{ type: "mark_read", conversation_id }` | Marks conversation read and notifies other user. **Note:** implementation sends to `-other_user_id`. |
| `get_online_friends` | `{ type: "get_online_friends" }` | Returns list of online friends. |

## Server → Client messages

### Presence and typing

- `friend_status_change`
  ```json
  { "type": "friend_status_change", "user_id": 2, "status": "online" }
  ```
- `user_typing`
  ```json
  { "type": "user_typing", "user_id": 2, "is_typing": true }
  ```

### Chat messages

- `new_message` (from WebSocket `send_message`)
  ```json
  {
    "type": "new_message",
    "message_id": 123,
    "sender_id": 1,
    "receiver_id": 2,
    "content": "Hello",
    "timestamp": "2024-01-01T12:00:00.000000"
  }
  ```
- `new_message` (from REST `/conversation/send_message`)
  ```json
  {
    "type": "new_message",
    "conversation_id": 10,
    "message_id": 456,
    "sender_id": 1,
    "content": "Hello",
    "created_at": "2024-01-01T12:00:00.000000",
    "media_ids": []
  }
  ```
- `delete_message`
  ```json
  { "type": "delete_message", "message_id": 456 }
  ```
- `messages_read`
  ```json
  { "type": "messages_read", "conversation_id": 10, "user_id": 1 }
  ```

### Friends and conversations

- `new_friend_request`
  ```json
  { "type": "new_friend_request", "sender_id": 1, "sender_username": "alice" }
  ```
- `friend_request_accepted`
  ```json
  { "type": "friend_request_accepted", "friend_id": 2, "friend_username": "bob" }
  ```
- `new_conversation`
  ```json
  { "type": "new_conversation", "conversation_id": 10, "other_user_id": 2 }
  ```
- `online_friends`
  ```json
  { "type": "online_friends", "friends": [2, 3] }
  ```
