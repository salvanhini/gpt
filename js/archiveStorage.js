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
  try {
    const db = getDB();
    const record = {
      ...chat,
      archivedAt: new Date().toISOString(),
    };
    await db[STORE_NAME].put(record);
    return record;
  } catch {
    throw new Error("Erro ao arquivar conversa.");
  }
}

export async function archiveConversations(chats) {
  try {
    const db = getDB();
    const records = chats.map((chat) => ({
      ...chat,
      archivedAt: new Date().toISOString(),
    }));
    await db[STORE_NAME].bulkPut(records);
    return chats.length;
  } catch {
    throw new Error("Erro ao arquivar conversas.");
  }
}

export async function getAllArchived() {
  try {
    const db = getDB();
    const all = await db[STORE_NAME].toArray();
    return all.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  } catch {
    return [];
  }
}

export async function getArchivedById(id) {
  try {
    const db = getDB();
    return db[STORE_NAME].get(id);
  } catch {
    return null;
  }
}

export async function restoreConversation(id) {
  try {
    const db = getDB();
    const record = await db[STORE_NAME].get(id);
    if (!record) return null;
    await db[STORE_NAME].delete(id);
    const { archivedAt, ...chat } = record;
    return chat;
  } catch {
    return null;
  }
}

export async function deleteArchived(id) {
  try {
    const db = getDB();
    await db[STORE_NAME].delete(id);
  } catch {
    // Silently ignore
  }
}

export async function getArchivedCount() {
  try {
    const db = getDB();
    return db[STORE_NAME].count();
  } catch {
    return 0;
  }
}
