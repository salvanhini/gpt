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
  const db = getDB();
  const now = new Date().toISOString();
  const record = { ...contact, createdAt: now, updatedAt: now };
  return db.contacts.add(record);
}

export async function updateContact(id, changes) {
  const db = getDB();
  changes.updatedAt = new Date().toISOString();
  return db.contacts.update(id, changes);
}

export async function deleteContact(id) {
  const db = getDB();
  return db.contacts.delete(id);
}

export async function loadContacts() {
  const db = getDB();
  return db.contacts.toArray();
}

export async function getContactByEmail(email) {
  const db = getDB();
  return db.contacts.where("email").equalsIgnoreCase(email).first();
}

export async function getContactByPhone(phone) {
  const db = getDB();
  return db.contacts.where("phone").equals(phone).first();
}

export async function findOrCreateContact(data) {
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
}

// Email History
export async function addEmailRecord(record) {
  const db = getDB();
  return db.emailHistory.add({
    ...record,
    sentAt: new Date().toISOString(),
  });
}

export async function loadEmailHistory(limit = 50) {
  const db = getDB();
  return db.emailHistory
    .orderBy("sentAt")
    .reverse()
    .limit(limit)
    .toArray();
}

export async function deleteEmailRecord(id) {
  const db = getDB();
  return db.emailHistory.delete(id);
}

// WhatsApp History
export async function addWhatsAppRecord(record) {
  const db = getDB();
  return db.whatsappHistory.add({
    ...record,
    sentAt: new Date().toISOString(),
  });
}

export async function loadWhatsAppHistory(limit = 50) {
  const db = getDB();
  return db.whatsappHistory
    .orderBy("sentAt")
    .reverse()
    .limit(limit)
    .toArray();
}

export async function deleteWhatsAppRecord(id) {
  const db = getDB();
  return db.whatsappHistory.delete(id);
}
