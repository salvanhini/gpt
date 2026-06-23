export function buildChatMessages({
  globalSystemPrompt = "",
  agentSystemPrompt = "",
  responseStyle = "",
  history = [],
  attachmentContext = "",
  referenceContext = "",
  userMessage = "",
  imageDataUrls = [],
}) {
  const payload = [];

  if (globalSystemPrompt.trim()) {
    payload.push({
      role: "system",
      content: globalSystemPrompt.trim(),
    });
  }

  const agentInstructions = [
    agentSystemPrompt.trim(),
    responseStyle.trim() ? `Estilo de resposta:\n${responseStyle.trim()}` : "",
  ].filter(Boolean).join("\n\n");

  if (agentInstructions) {
    payload.push({
      role: "system",
      content: agentInstructions,
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

  if (imageDataUrls.length > 0) {
    payload.push({
      role: "user",
      content: [
        { type: "text", text: userMessage },
        ...imageDataUrls.map((img) => ({
          type: "image_url",
          image_url: { url: img.dataUrl },
        })),
      ],
    });
  } else {
    payload.push({
      role: "user",
      content: userMessage,
    });
  }

  return payload;
}
