const EMAILJS_URL = "https://api.emailjs.com/api/v1.0/email/send";

const SENDER_KEYS = {
  marco: {
    serviceId: "emailJSMarcoServiceId",
    templateId: "emailJSMarcoTemplateId",
    publicKey: "emailJSMarcoPublicKey",
    fromName: "Marco - FEMIC GPT",
  },
  alessandra: {
    serviceId: "emailJSAlessandraServiceId",
    templateId: "emailJSAlessandraTemplateId",
    publicKey: "emailJSAlessandraPublicKey",
    fromName: "Alessandra - FEMIC GPT",
  },
};

export async function sendEmail({ toEmail, toName, subject, message, sender, settings }) {
  const s = sender === "alessandra" ? SENDER_KEYS.alessandra : SENDER_KEYS.marco;

  const serviceId = settings[s.serviceId] || "";
  const templateId = settings[s.templateId] || "";
  const publicKey = settings[s.publicKey] || "";

  if (!serviceId || !templateId || !publicKey) {
    const label = sender === "alessandra" ? "Alessandra" : "Marco";
    throw new Error(`Configure o EmailJS do ${label} nas configuracoes (Service ID, Template ID, Public Key).`);
  }

  if (!toEmail) {
    throw new Error("Informe o email do destinatario.");
  }

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      to_email: toEmail,
      to_name: toName || toEmail,
      from_name: s.fromName,
      subject: subject || "Mensagem do FEMIC GPT",
      message: message || "",
    },
  };

  let response;
  try {
    response = await fetch(EMAILJS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Nao foi possivel conectar ao EmailJS. Verifique internet.");
  }

  const responseText = await response.text().catch(() => "");
  console.log("[DEBUG] EmailJS response:", response.status, responseText);

  if (!response.ok) {
    throw new Error(`EmailJS falhou (${response.status}): ${responseText}`);
  }

  return { success: true };
}
