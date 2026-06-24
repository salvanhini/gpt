const MEMORY_STORAGE_KEY = "femicgpt:memory";
const LONG_TERM_SUMMARY_KEY = "femicgpt:long_term_summary";
const MAX_MEMORY_FACTS = 50;
const SUMMARY_MAX_TOKENS = 400;

function readMemory() {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeMemory(facts) {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(facts));
  } catch {
    // Storage failure should not break the app
  }
}

export function getMemoryFacts() {
  return readMemory();
}

export function addMemoryFact(fact, source = "conversation") {
  const facts = readMemory();
  const normalized = fact.trim().toLowerCase();

  // Avoid duplicates
  const exists = facts.some(
    (f) => f.text.trim().toLowerCase() === normalized
  );
  if (exists) return false;

  facts.push({
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: fact.trim(),
    source,
    createdAt: new Date().toISOString(),
  });

  // Keep only the most recent facts
  if (facts.length > MAX_MEMORY_FACTS) {
    facts.splice(0, facts.length - MAX_MEMORY_FACTS);
  }

  writeMemory(facts);
  return true;
}

export function removeMemoryFact(factId) {
  const facts = readMemory();
  const filtered = facts.filter((f) => f.id !== factId);
  writeMemory(filtered);
  return filtered.length < facts.length;
}

export function clearMemory() {
  writeMemory([]);
}

export function buildMemoryContext() {
  const facts = readMemory();
  if (facts.length === 0) return "";

  const lines = [
    "Memoria persistente do usuario (fatos conhecidos):",
    ...facts.map((f) => `- ${f.text}`),
  ];

  return lines.join("\n");
}

function extractFactsFromMessages(messages) {
  const facts = [];
  const userMessages = messages.filter((m) => m.role === "user");

  for (const msg of userMessages) {
    const content = (msg.content || "").trim();
    if (!content) continue;

    // Name patterns (more flexible)
    const nameMatch = content.match(/(?:meu nome e|me chamo|sou o?|meu nome é|pode me chamar|me chama|aqui é|aqui esta|falo com|nome:?)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i);
    if (nameMatch) {
      facts.push(`Nome do usuario: ${nameMatch[1]}`);
    }

    // Profession patterns (more flexible)
    const profMatch = content.match(/(?:sou|trabalho como|exerço como|trabalho como|minha profissao e|sou formado em|sou da area de|atuo como|meu trabalho e)\s+(.+?)(?:\.|,|$)/i);
    if (profMatch) {
      facts.push(`Profissao: ${profMatch[1].trim()}`);
    }

    // Location patterns (more flexible)
    const locMatch = content.match(/(?:moro em|resido em|sou de|cidade de|estou em|perto de|na regiao de)\s+([A-ZÀ-Ú][a-zà-ú\s]+)/i);
    if (locMatch) {
      facts.push(`Localizacao: ${locMatch[1].trim()}`);
    }

    // Phone patterns
    const phoneMatch = content.match(/(?:meu (?:telefone|celular|numero) e| whatsapp e|whatsapp:?)\s*(\d[\d\s\-]{8,})/i);
    if (phoneMatch) {
      facts.push(`Telefone: ${phoneMatch[1].trim()}`);
    }

    // Email patterns
    const emailMatch = content.match(/(?:meu email e|email para|email:?)\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (emailMatch) {
      facts.push(`Email: ${emailMatch[1]}`);
    }

    // Company / business patterns
    const companyMatch = content.match(/(?:minha (?:empresa|loja|firma|startup) e|trabalho na|meu negocio e|sou dono(?:a)? de|tenho uma?)\s+(.+?)(?:\.|,|$)/i);
    if (companyMatch) {
      facts.push(`Empresa/Negocio: ${companyMatch[1].trim()}`);
    }

    // Age patterns
    const ageMatch = content.match(/(?:tenho|meu(?:s)?\s+idade(?:s)?\s+(?:e|sao))\s+(\d{1,3})\s*(?:anos?|aninhos?)/i);
    if (ageMatch) {
      facts.push(`Idade: ${ageMatch[1]}`);
    }

    // Preference patterns
    const prefMatch = content.match(/(?:eu (?:gosto|prefiro|adoro|odeio|minha (?:preferencia|opiniao) e|acho que|curto|nao gosto))\s+(.+?)(?:\.|$)/i);
    if (prefMatch) {
      facts.push(`Preferencia: ${prefMatch[1].trim()}`);
    }
  }

  return facts;
}

export function autoExtractAndStore(messages) {
  const newFacts = extractFactsFromMessages(messages);
  let added = 0;
  for (const fact of newFacts) {
    if (addMemoryFact(fact, "auto-extract")) {
      added++;
    }
  }
  return added;
}

// --- Long-term summary (Token Economy) ---

function readLongTermSummary() {
  try {
    return JSON.parse(localStorage.getItem(LONG_TERM_SUMMARY_KEY) || "null");
  } catch {
    return null;
  }
}

function writeLongTermSummary(data) {
  try {
    localStorage.setItem(LONG_TERM_SUMMARY_KEY, JSON.stringify(data));
  } catch {
    // storage failure
  }
}

export function getLongTermSummary() {
  const data = readLongTermSummary();
  return data?.text || "";
}

export function clearLongTermSummary() {
  localStorage.removeItem(LONG_TERM_SUMMARY_KEY);
}

export function shouldGenerateSummary(totalMessages) {
  if (totalMessages <= 10) return false;
  const data = readLongTermSummary();
  if (!data) return true;
  return totalMessages - (data.messageCount || 0) >= 10;
}

export async function generateLongTermSummary(messages, existingSummary, settings) {
  const { sendTextMessage } = await import("./api.js");

  const messagesToSummarize = messages.slice(0, -10);
  if (!messagesToSummarize.length) return existingSummary || "";

  const conversationText = messagesToSummarize
    .map((m) => {
      const role = m.role === "user" ? "Usuario" : "Assistente";
      const content = String(m.content || "").replace(/\s+/g, " ").slice(0, 300);
      return `${role}: ${content}`;
    })
    .join("\n");

  const existingBlock = existingSummary
    ? `\n\nResumo anterior para atualizar:\n${existingSummary}`
    : "";

  const summaryPrompt = `Gere um resumo executivo conciso em Portugues do Brasil dos pontos-chave desta conversa.
Foco em: decisoes tomadas, dados importantes, preferencias do usuario, conclusoes.
Maximo de ${SUMMARY_MAX_TOKENS} tokens. Seja direto e objetivo.
Nao inclua saudacoes ou frases de cortesia.${existingBlock}

Conversa para resumir:
${conversationText}`;

  try {
    const result = await sendTextMessage({
      messages: [
        { role: "system", content: "Voce e um assistente que gera resumos executivos concisos." },
        { role: "user", content: summaryPrompt },
      ],
      settings,
      webSearchMode: false,
    });

    const summaryText = (result.content || "").trim();
    if (summaryText) {
      writeLongTermSummary({
        text: summaryText,
        messageCount: messages.length,
        updatedAt: new Date().toISOString(),
      });
      return summaryText;
    }
  } catch (err) {
    console.warn("[Memory] Erro ao gerar resumo longo prazo:", err.message);
  }

  return existingSummary || "";
}
