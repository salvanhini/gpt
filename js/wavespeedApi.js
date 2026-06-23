const WAVESPEED_ENDPOINT = "https://api.wavespeed.ai/v1/run";
const FLUX_MODEL = "wavespeed-ai/flux-2-klein-9b-text-to-image";

export async function generateImageWavespeed({ prompt, settings, imageSize }) {
  const apiKey = settings.wavespeedKey?.trim();
  if (!apiKey) {
    throw new Error("Chave da Wavespeed.ai nao configurada. Adicione nas Configuracoes.");
  }

  const dimensions = getDimensions(imageSize || "landscape_4_3");

  const body = {
    model: FLUX_MODEL,
    input: {
      prompt,
      width: dimensions.width,
      height: dimensions.height,
    },
  };

  let response;
  try {
    response = await fetch(WAVESPEED_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error("Sem conexao com Wavespeed.ai. Verifique internet.");
  }

  if (!response.ok) {
    let errorMsg = "Falha na Wavespeed.ai.";
    try {
      const errData = await response.json();
      errorMsg = errData?.error || errData?.message || errorMsg;
    } catch {}
    if (response.status === 401 || response.status === 403) {
      throw new Error("Chave da Wavespeed.ai invalida.");
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const imageUrl = data?.output?.images?.[0]?.url || data?.output?.[0]?.url;
  if (!imageUrl) {
    throw new Error("Wavespeed.ai nao retornou URL de imagem.");
  }

  const imgResponse = await fetch(imageUrl);
  const blob = await imgResponse.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return { url: dataUrl, provider: "wavespeed" };
}

function getDimensions(size) {
  const map = {
    landscape_4_3: { width: 1024, height: 768 },
    landscape_16_9: { width: 1280, height: 720 },
    landscape_3_2: { width: 1152, height: 768 },
    square_hd: { width: 1024, height: 1024 },
    square: { width: 1080, height: 1080 },
    portrait_4_3: { width: 768, height: 1024 },
    portrait_16_9: { width: 720, height: 1280 },
  };
  return map[size] || { width: 1024, height: 768 };
}
