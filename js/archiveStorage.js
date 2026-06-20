/* global Dexie */
const DB_NAME = "femicgpt-archive";
const STORE_NAME = "conversations";

let dbInstance = null;

function getDB() {
  if (!dbInstance) {
    dbInstance = new Dexie(DB_NAME);
    dbInstance.version(1).stores({
      [STORE_NAME]: "id, archivedAt, title",
    });
  }
  return dbInstance;
}

export async function archiveConversation(chat) {
  const db = getDB();
  const record = {
    ...chat,
    archivedAt: new Date().toISOString(),
  };
  await db[STORE_NAME].put(record);
  return record;
}

export async function archiveConversations(chats) {
  const db = getDB();
  const records = chats.map((chat) => ({
    ...chat,
    archivedAt: new Date().toISOString(),
  }));
  await db[STORE_NAME].bulkPut(records);
  return chats.length;
}

export async function getAllArchived() {
  const db = getDB();
  const all = await db[STORE_NAME].toArray();
  return all.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
}

export async function getArchivedById(id) {
  const db = getDB();
  return db[STORE_NAME].get(id);
}

export async function restoreConversation(id) {
  const db = getDB();
  const record = await db[STORE_NAME].get(id);
  if (!record) return null;
  await db[STORE_NAME].delete(id);
  const { archivedAt, ...chat } = record;
  return chat;
}

export async function deleteArchived(id) {
  const db = getDB();
  await db[STORE_NAME].delete(id);
}

export async function getArchivedCount() {
  const db = getDB();
  return db[STORE_NAME].count();
}
