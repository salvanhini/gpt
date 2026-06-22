export async function sendWhatsApp({ number, text, settings }) {
  if (!settings.evolutionInstanceUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
    throw new Error("Configure Evolution WhatsApp nas configuracoes (URL, API Key, Instance Name).");
  }

  if (!number) {
    throw new Error("Informe o numero do destinatario.");
  }

  if (!text) {
    throw new Error("Informe a mensagem.");
  }

  const cleanNumber = number.replace(/\D/g, "");
  const url = `${settings.evolutionInstanceUrl.replace(/\/+$/, "")}/message/sendText/${settings.evolutionInstanceName}`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: settings.evolutionApiKey,
      },
      body: JSON.stringify({
        number: cleanNumber,
        text,
        delay: 1200,
      }),
    });
  } catch {
    throw new Error("Nao foi possivel conectar a Evolution API. Verifique a URL da instancia.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      data?.error || data?.message || `Evolution API falhou (${response.status}).`
    );
  }

  return { success: true };
}
