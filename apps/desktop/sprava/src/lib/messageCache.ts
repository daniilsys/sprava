import { openDB, type IDBPDatabase } from "idb";

interface CachedMessage {
  id: string;
  contextId: string; // channelId or dmConversationId
  data: unknown; // full message JSON
  createdAt: string;
}

const DB_NAME = "sprava-messages";
const DB_VERSION = 1;
const STORE_NAME = "messages";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("contextId", "contextId");
        store.createIndex("contextId_createdAt", ["contextId", "createdAt"]);
      },
    });
  }
  return dbPromise;
}

export async function getCachedMessages(contextId: string, limit = 50): Promise<unknown[]> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const index = tx.store.index("contextId");
  const messages: CachedMessage[] = [];
  let cursor = await index.openCursor(IDBKeyRange.only(contextId), "prev");
  while (cursor && messages.length < limit) {
    messages.push(cursor.value);
    cursor = await cursor.continue();
  }
  return messages.reverse().map(m => m.data);
}

export async function cacheMessages(contextId: string, messages: Array<{ id: string; createdAt: string }>) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  for (const msg of messages) {
    await tx.store.put({ id: msg.id, contextId, data: msg, createdAt: msg.createdAt });
  }
  await tx.done;
}

export async function getLatestCachedMessageId(contextId: string): Promise<string | null> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const index = tx.store.index("contextId");
  const cursor = await index.openCursor(IDBKeyRange.only(contextId), "prev");
  return cursor ? (cursor.value as CachedMessage).id : null;
}

export async function cacheSingleMessage(contextId: string, message: { id: string; createdAt: string }) {
  const db = await getDb();
  await db.put(STORE_NAME, { id: message.id, contextId, data: message, createdAt: message.createdAt });
}

export async function removeCachedMessage(messageId: string) {
  const db = await getDb();
  await db.delete(STORE_NAME, messageId);
}

export async function clearContextCache(contextId: string) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const index = tx.store.index("contextId");
  let cursor = await index.openCursor(IDBKeyRange.only(contextId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
