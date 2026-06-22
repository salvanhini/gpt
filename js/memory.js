const MEMORY_STORAGE_KEY = "femicgpt:memory";
const MAX_MEMORY_FACTS = 50;

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

    const lower = content.toLowerCase();

    // Name patterns
    const nameMatch = content.match(/(?:meu nome e|me chamo|sou o?|meu nome é|pode me chamar)\s+([A-ZÀ-Ú][a-zà-ú]+)/i);
    if (nameMatch) {
      facts.push(`Nome do usuario: ${nameMatch[1]}`);
    }

    // Profession patterns
    const profMatch = content.match(/(?:sou|trabalho como|exerço como|trabalho como|minha profissao e|sou formado em)\s+(.+?)(?:\.|,|$)/i);
    if (profMatch) {
      facts.push(`Profissao: ${profMatch[1].trim()}`);
    }

    // Location patterns
    const locMatch = content.match(/(?:moro em|resido em|sou de|cidade de|estou em)\s+([A-ZÀ-Ú][a-zà-ú\s]+)/i);
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

    // Preference patterns
    const prefMatch = content.match(/(?:eu (?:gosto|prefiro|adoro|odeio)|minha (?:preferencia|opiniao) e|acho que)\s+(.+?)(?:\.|$)/i);
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
