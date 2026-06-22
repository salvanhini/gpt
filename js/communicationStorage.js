/* global Dexie */

const DB_NAME = "femicgpt-communications";

let dbInstance = null;

function getDB() {
  if (!dbInstance) {
    dbInstance = new Dexie(DB_NAME);
    dbInstance.version(1).stores({
      contacts: "++id, name, email, phone, tags, createdAt, updatedAt",
      emailHistory: "++id, to, toName, subject, status, sentAt, contactId",
      whatsappHistory: "++id, to, toName, message, status, sentAt, contactId",
    });
  }
  return dbInstance;
}

// Contacts
export async function addContact(contact) {
  try {
    const db = getDB();
    const now = new Date().toISOString();
    const record = { ...contact, createdAt: now, updatedAt: now };
    return db.contacts.add(record);
  } catch {
    throw new Error("Erro ao adicionar contato.");
  }
}

export async function updateContact(id, changes) {
  try {
    const db = getDB();
    changes.updatedAt = new Date().toISOString();
    return db.contacts.update(id, changes);
  } catch {
    throw new Error("Erro ao atualizar contato.");
  }
}

export async function deleteContact(id) {
  try {
    const db = getDB();
    return db.contacts.delete(id);
  } catch {
    throw new Error("Erro ao excluir contato.");
  }
}

export async function loadContacts() {
  try {
    const db = getDB();
    return db.contacts.toArray();
  } catch {
    return [];
  }
}

export async function getContactByEmail(email) {
  try {
    const db = getDB();
    return db.contacts.where("email").equalsIgnoreCase(email).first();
  } catch {
    return null;
  }
}

export async function getContactByPhone(phone) {
  try {
    const db = getDB();
    return db.contacts.where("phone").equals(phone).first();
  } catch {
    return null;
  }
}

export async function findOrCreateContact(data) {
  try {
    let contact = null;
    if (data.email) {
      contact = await getContactByEmail(data.email);
    }
    if (!contact && data.phone) {
      contact = await getContactByPhone(data.phone);
    }
    if (!contact) {
      const id = await addContact({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        tags: data.tags || [],
        notes: data.notes || "",
      });
      contact = { id, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
    return contact;
  } catch {
    return null;
  }
}

// Email History
export async function addEmailRecord(record) {
  try {
    const db = getDB();
    return db.emailHistory.add({
      ...record,
      sentAt: new Date().toISOString(),
    });
  } catch {
    throw new Error("Erro ao registrar envio de email.");
  }
}

export async function loadEmailHistory(limit = 50) {
  try {
    const db = getDB();
    return db.emailHistory
      .orderBy("sentAt")
      .reverse()
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
}

export async function deleteEmailRecord(id) {
  try {
    const db = getDB();
    return db.emailHistory.delete(id);
  } catch {
    // Silently ignore
  }
}

// WhatsApp History
export async function addWhatsAppRecord(record) {
  try {
    const db = getDB();
    return db.whatsappHistory.add({
      ...record,
      sentAt: new Date().toISOString(),
    });
  } catch {
    throw new Error("Erro ao registrar envio de WhatsApp.");
  }
}

export async function loadWhatsAppHistory(limit = 50) {
  try {
    const db = getDB();
    return db.whatsappHistory
      .orderBy("sentAt")
      .reverse()
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
}

export async function deleteWhatsAppRecord(id) {
  try {
    const db = getDB();
    return db.whatsappHistory.delete(id);
  } catch {
    // Silently ignore
  }
}
