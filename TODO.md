# API Review — TODO

## 🔴 Critique (bloquant à l'échelle)

- [x] **Socket.io Redis adapter manquant** — Redis est configuré mais non branché à Socket.io. Avec plusieurs instances Node, les messages émis sur l'instance A ne sont pas reçus par les sockets de l'instance B. Installer `@socket.io/redis-adapter` et l'initialiser dans `websocket/index.ts`.

- [x] **`emitReady` charge tous les membres sans limite** — `members: true` dans la query `ready` charge la totalité des membres de chaque serveur. Prévoir un seuil ou ne renvoyer que les membres en ligne via Redis presence.

- [x] **`lastMessageId` absent du payload `ready`** — Le client reçoit les `readStates` mais pas le dernier message de chaque channel/DM. Impossible de calculer les badges non-lus au boot sans refetch. Ajouter `messages: { take: 1, orderBy: { createdAt: "desc" } }` dans la query channels et DMs de `emitReady`.

---

## 🟠 Important (bugs et manques fonctionnels)

- [ ] **Réactions sans broadcast socket** — `addReaction` / `removeReaction` dans `messages.service.ts` n'émettent aucun événement socket. Les autres clients ne sont jamais notifiés en temps réel.

- [ ] **Typing indicators sans timeout serveur** — Si un client crashe après `typing:start`, l'indicateur reste bloqué pour les autres. Ajouter un TTL Redis (5s) ou un `setTimeout` par socket+channel.

---

## 🟡 Qualité (nécessaire à terme)

- [ ] **Index DB manquants sur les hot paths** — Ajouter dans le schema Prisma :

  ```prisma
  model Message {
    @@index([channelId, createdAt])
    @@index([dmConversationId, createdAt])
  }
  model ReadState {
    @@index([userId])
  }
  ```

- [ ] **Payloads socket non validés** — `typing:start`, `channel:read`, `dm:read` n'ont aucune validation. Un payload malformé peut passer un `undefined` à Prisma. Ajouter une validation Zod dans chaque handler.

- [ ] **`getDmConversations` sans pagination** — Un utilisateur avec beaucoup de DMs charge tout en une requête. Ajouter `cursor` / `limit`.

- [ ] **Pas de curseur `after` sur les messages** — Il y a `before` pour scroller vers le haut, mais pas `after` ni `around`. Nécessaire pour le "jump to message" depuis les notifications.

---

## 🔵 Nice to have (prod)

- [ ] **Mentions (`@user`)** — Modèle `Mention` + event socket dédié + badge séparé des non-lus.
- [ ] **Push notifications** — Notifier les users offline via FCM / APNs.
- [ ] **Message search** — Full-text search avec Postgres `tsvector` ou Meilisearch.
- [ ] **Présence multi-device robuste** — L'actuel `remaining.length === 0` casse si Redis ne sync pas les sockets cross-instance.
