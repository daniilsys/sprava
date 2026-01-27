# WebSocket API

## Connection

- **URL:** `ws://<host>:8000/ws/{api_token}`
- **Authentification:** Le `api_token` fait partie du chemin. Si le token est invalide, le serveur ferme la connexion avec le code `4008`.
- **Heartbeat:** Non implémenté.
- **Reconnexion:** Non implémentée côté serveur.

### Comportement à la connexion

À la connexion, le serveur :
1. Accepte le socket
2. Ajoute l'utilisateur aux connexions actives (supporte plusieurs connexions par utilisateur)
3. Marque l'utilisateur comme en ligne et notifie tous ses amis connectés via `friend_status_change`

### Comportement à la déconnexion

À la déconnexion, le serveur :
1. Retire la connexion de la liste des connexions actives
2. Si c'était la dernière connexion de l'utilisateur, le marque comme hors ligne
3. Notifie tous ses amis connectés via `friend_status_change`

---

## Messages Client → Serveur

| Type | Payload | Description |
| --- | --- | --- |
| `send_message` | `{ "type": "send_message", "receiver_id": int, "content": string }` | Envoie un message à un utilisateur. Le message est envoyé aux deux participants de la conversation. |
| `typing` | `{ "type": "typing", "receiver_id": int }` | Notifie le destinataire que l'expéditeur est en train d'écrire. |
| `stop_typing` | `{ "type": "stop_typing", "receiver_id": int }` | Notifie le destinataire que l'expéditeur a arrêté d'écrire. |
| `mark_read` | `{ "type": "mark_read", "conversation_id": int }` | Marque la conversation comme lue et notifie l'autre participant. |
| `get_online_friends` | `{ "type": "get_online_friends" }` | Demande la liste des amis actuellement en ligne. |

---

## Messages Serveur → Client

### Présence et frappe

#### `friend_status_change`
Notifie un changement de statut en ligne/hors ligne d'un ami.
```json
{
  "type": "friend_status_change",
  "user_id": 2,
  "status": "online"
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `user_id` | int | ID de l'ami dont le statut a changé |
| `status` | string | `"online"` ou `"offline"` |

#### `user_typing`
Notifie qu'un utilisateur est en train d'écrire ou a arrêté.
```json
{
  "type": "user_typing",
  "user_id": 2,
  "is_typing": true
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `user_id` | int | ID de l'utilisateur qui écrit |
| `is_typing` | boolean | `true` si en train d'écrire, `false` sinon |

#### `online_friends`
Réponse à la demande `get_online_friends`.
```json
{
  "type": "online_friends",
  "friends": [2, 3, 5]
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `friends` | int[] | Liste des IDs des amis actuellement en ligne |

---

### Messages de chat

#### `new_message` (via WebSocket `send_message`)
Nouveau message envoyé via WebSocket. Envoyé aux deux participants.
```json
{
  "type": "new_message",
  "message_id": 123,
  "sender_id": 1,
  "receiver_id": 2,
  "content": "Bonjour !",
  "timestamp": "2024-01-01T12:00:00.000000"
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `message_id` | int | ID du message créé |
| `sender_id` | int | ID de l'expéditeur |
| `receiver_id` | int | ID du destinataire |
| `content` | string | Contenu du message |
| `timestamp` | string | Date et heure ISO 8601 |

#### `new_message` (via REST `/conversation/send_message`)
Nouveau message envoyé via l'API REST. Envoyé uniquement au destinataire.
```json
{
  "type": "new_message",
  "conversation_id": 10,
  "message_id": 456,
  "sender_id": 1,
  "content": "Bonjour !",
  "created_at": "2024-01-01T12:00:00.000000",
  "media_ids": []
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `conversation_id` | int | ID de la conversation |
| `message_id` | int | ID du message créé |
| `sender_id` | int | ID de l'expéditeur |
| `content` | string | Contenu du message |
| `created_at` | string | Date et heure ISO 8601 |
| `media_ids` | int[] | Liste des IDs de médias attachés |

#### `delete_message`
Un message a été supprimé (via REST `/conversation/delete_message`).
```json
{
  "type": "delete_message",
  "message_id": 456
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `message_id` | int | ID du message supprimé |

#### `messages_read`
Les messages d'une conversation ont été marqués comme lus.
```json
{
  "type": "messages_read",
  "conversation_id": 10,
  "user_id": 1
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `conversation_id` | int | ID de la conversation |
| `user_id` | int | ID de l'utilisateur qui a lu les messages |

---

### Conversations

#### `new_conversation`
Une nouvelle conversation a été créée (via REST `/create_conversation`).
```json
{
  "type": "new_conversation",
  "conversation_id": 10,
  "other_user_id": 2
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `conversation_id` | int | ID de la nouvelle conversation |
| `other_user_id` | int | ID de l'autre participant de la conversation |

#### `conversation_deleted`
Une conversation a été supprimée (via REST `/delete_conversation`).
```json
{
  "type": "conversation_deleted",
  "conversation_id": 10
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `conversation_id` | int | ID de la conversation supprimée |

---

### Relations (amis)

#### `new_friend_request`
Une demande d'ami a été reçue (via REST `/me/send_friend_request`).
```json
{
  "type": "new_friend_request",
  "sender_id": 1,
  "sender_username": "alice"
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `sender_id` | int | ID de l'utilisateur qui envoie la demande |
| `sender_username` | string | Nom d'utilisateur de l'expéditeur |

#### `friend_request_accepted`
Une demande d'ami a été acceptée (via REST `/me/accept_friend_request`).
```json
{
  "type": "friend_request_accepted",
  "friend_id": 2,
  "friend_username": "bob"
}
```
| Champ | Type | Description |
| --- | --- | --- |
| `friend_id` | int | ID du nouvel ami |
| `friend_username` | string | Nom d'utilisateur du nouvel ami |

---

## Architecture technique

### ConnectionManager

Le `ConnectionManager` gère les connexions WebSocket actives :

- **Connexions multiples:** Un utilisateur peut avoir plusieurs connexions simultanées (plusieurs appareils/onglets)
- **Envoi de messages:** Les messages sont envoyés à toutes les connexions actives d'un utilisateur
- **Détection hors ligne:** Un utilisateur est considéré hors ligne uniquement quand toutes ses connexions sont fermées

### Méthodes disponibles

| Méthode | Description |
| --- | --- |
| `connect(websocket, user_id)` | Ajoute une connexion pour un utilisateur |
| `disconnect(websocket, user_id)` | Retire une connexion spécifique |
| `send_personal_message(user_id, message)` | Envoie un message à toutes les connexions d'un utilisateur |
| `send_to_multiple(user_ids, message, exclude_user_id)` | Envoie à plusieurs utilisateurs |
| `send_to_conversation(message, user1_id, user2_id)` | Envoie aux deux participants d'une conversation |
| `is_user_online(user_id)` | Vérifie si un utilisateur a au moins une connexion active |
| `get_online_users()` | Retourne la liste des utilisateurs connectés |
