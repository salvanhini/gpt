/**
 * Supabase Cloud Sync — Backup permanente de mensagens
 *
 * SQL para criar a tabela no painel do Supabase:
 *
 * CREATE TABLE mensagens_chat (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   session_id TEXT NOT NULL,
 *   role TEXT NOT NULL,
 *   content TEXT NOT NULL,
 *   meta JSONB DEFAULT '{}',
 *   user_id TEXT DEFAULT 'default'
 * );
 *
 * CREATE INDEX idx_mensagens_session ON mensagens_chat(session_id);
 * CREATE INDEX idx_mensagens_created ON mensagens_chat(created_at);
 */

const SUPABASE_CONFIG_KEY = "femicgpt:supabase_config";
const TABLE_NAME = "mensagens_chat";

let _client = null;
let _config = null;

function readConfig() {
  try {
    return JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || "null");
  } catch {
    return null;
  }
}

function writeConfig(config) {
  try {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // storage failure
  }
}

function getClient() {
  if (_client) return _client;
  const config = _config || readConfig();
  if (!config?.url || !config?.key) return null;
  if (config.url.includes("YOUR_SUPABASE") || config.key.includes("YOUR_SUPABASE")) return null;
  if (!window.supabase?.createClient) return null;
  _client = window.supabase.createClient(config.url, config.key);
  _config = config;
  return _client;
}

export function isSupabaseConfigured() {
  return getClient() !== null;
}

export function initSupabase(url, key) {
  if (!url || !key) return false;
  if (url.includes("YOUR_SUPABASE") || key.includes("YOUR_SUPABASE")) return false;
  _config = { url, key };
  writeConfig(_config);
  _client = null;
  return getClient() !== null;
}

export function bootstrapSupabase(settingsConfig) {
  if (_client) return true;
  if (settingsConfig?.url && settingsConfig?.key) {
    if (!settingsConfig.url.includes("YOUR_SUPABASE") && !settingsConfig.key.includes("YOUR_SUPABASE")) {
      return initSupabase(settingsConfig.url, settingsConfig.key);
    }
  }
  const stored = readConfig();
  if (stored?.url && stored?.key) {
    return initSupabase(stored.url, stored.key);
  }
  return false;
}

export function getSessionId() {
  const STORAGE_KEY = "femicgpt:session_id";
  try {
    let sid = localStorage.getItem(STORAGE_KEY);
    if (sid) return sid;
    const raw = `${navigator.userAgent}-${screen.width}x${screen.height}-${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const chr = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    sid = `session-${Math.abs(hash).toString(36)}`;
    localStorage.setItem(STORAGE_KEY, sid);
    return sid;
  } catch {
    return "session-default";
  }
}

function mapMessageForInsert(message, sessionId) {
  return {
    session_id: sessionId,
    role: message.role || "user",
    content: String(message.content || ""),
    meta: message.meta || {},
    user_id: "default",
  };
}

export async function syncMessageToSupabase(message, sessionId) {
  const client = getClient();
  if (!client) {
    console.warn("[Supabase] No client available. Check URL and Key in settings.");
    return false;
  }
  try {
    const row = mapMessageForInsert(message, sessionId || getSessionId());
    console.log("[Supabase] Inserting row:", { session_id: row.session_id, role: row.role, contentLength: row.content.length });
    const { data, error } = await client.from(TABLE_NAME).insert(row).select();
    if (error) {
      console.warn("[Supabase] Sync error:", error.message, error.details, error.hint, error.code);
      return false;
    }
    console.log("[Supabase] Sync OK:", data?.[0]?.id);
    return true;
  } catch (err) {
    console.warn("[Supabase] Sync exception:", err.message, err);
    return false;
  }
}

export async function loadMessagesFromSupabase(sessionId) {
  const client = getClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from(TABLE_NAME)
      .select("*")
      .eq("session_id", sessionId || getSessionId())
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[Supabase] Load error:", error.message);
      return [];
    }
    return (data || []).map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      meta: row.meta || {},
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function restoreFromSupabaseIfEmpty() {
  const client = getClient();
  if (!client) return null;
  try {
    const messages = await loadMessagesFromSupabase();
    if (!messages.length) return null;
    const chat = {
      id: crypto.randomUUID(),
      agentId: "no-agent",
      title: "Conversa restaurada da nuvem",
      titleMode: "auto",
      createdAt: messages[0]?.createdAt || new Date().toISOString(),
      updatedAt: messages[messages.length - 1]?.createdAt || new Date().toISOString(),
      category: "",
      summary: "",
      pinned: false,
      messages,
    };
    return chat;
  } catch {
    return null;
  }
}

export async function syncPendingMessages(messages, sessionId) {
  const client = getClient();
  if (!client || !messages?.length) return;
  const sid = sessionId || getSessionId();
  const pending = messages.filter((m) => m.meta?.cloudStatus === "pending");
  for (const msg of pending) {
    const ok = await syncMessageToSupabase(msg, sid);
    msg.meta.cloudStatus = ok ? "synced" : "error";
  }
}
