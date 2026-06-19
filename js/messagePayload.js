export function buildChatMessages({
  globalSystemPrompt = "",
  agentSystemPrompt = "",
  history = [],
  attachmentContext = "",
  referenceContext = "",
  userMessage = "",
}) {
  const payload = [];

  if (globalSystemPrompt.trim()) {
    payload.push({
      role: "system",
      content: globalSystemPrompt.trim(),
    });
  }

  if (agentSystemPrompt.trim()) {
    payload.push({
      role: "system",
      content: agentSystemPrompt.trim(),
    });
  }

  payload.push(...history);

  if (attachmentContext.trim()) {
    payload.push({
      role: "user",
      content: `Use o contexto abaixo apenas como referência complementar para responder melhor:\n\n${attachmentContext.trim()}`,
    });
  }

  if (referenceContext.trim()) {
    payload.push({
      role: "user",
      content: `Use a referencia abaixo para responder com base nas fontes consultadas:\n\n${referenceContext.trim()}`,
    });
  }

  payload.push({
    role: "user",
    content: userMessage,
  });

  return payload;
}
