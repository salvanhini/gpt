// E2B Code Interpreter - REST API Client
const E2B_API_BASE = "https://api.e2b.app";

let sandboxId = null;
let sandboxReady = false;
let creationPromise = null;

function getE2BKey() {
  try {
    const raw = localStorage.getItem("femicgpt:settings");
    if (!raw) return null;
    const settings = JSON.parse(raw);
    return settings?.e2bKey || null;
  } catch {
    return null;
  }
}

async function ensureSandbox() {
  if (sandboxId && sandboxReady) {
    return sandboxId;
  }

  if (creationPromise) {
    return creationPromise;
  }

  creationPromise = (async () => {
    try {
      const apiKey = getE2BKey();
      if (!apiKey) {
        throw new Error("Chave API do E2B nao configurada. Configure nas configuracoes.");
      }

      const response = await fetch(`${E2B_API_BASE}/sandboxes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          templateID: "code-interpreter",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar sandbox E2B (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      sandboxId = data.sandboxID || data.id;
      if (!sandboxId) {
        throw new Error("Resposta E2B invalida: sandboxID nao encontrado.");
      }

      sandboxReady = true;
      return sandboxId;
    } catch (error) {
      creationPromise = null;
      sandboxReady = false;
      throw error;
    }
  })();

  return creationPromise;
}

export async function executePython(code, onOutput = null) {
  try {
    const sid = await ensureSandbox();

    const response = await fetch(`${E2B_API_BASE}/sandboxes/${sid}/executions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": getE2BKey(),
      },
      body: JSON.stringify({
        language: "python",
        code: code,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na execucao E2B (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    return {
      success: !data.error,
      result: (data.stdout || "") + (data.text || ""),
      error: data.error || "",
    };
  } catch (error) {
    return {
      success: false,
      result: "",
      error: error.message || String(error),
    };
  }
}

export async function isPyodideReady() {
  return sandboxReady;
}

export async function getPyodideVersion() {
  if (!sandboxReady) return null;
  try {
    const result = await executePython("import sys; sys.version");
    return result.success ? result.result : null;
  } catch {
    return null;
  }
}

export async function killSandbox() {
  if (!sandboxId) return;

  try {
    const apiKey = getE2BKey();
    if (apiKey) {
      await fetch(`${E2B_API_BASE}/sandboxes/${sandboxId}`, {
        method: "DELETE",
        headers: {
          "X-API-Key": apiKey,
        },
      });
    }
  } catch {
    // Ignore cleanup errors
  } finally {
    sandboxId = null;
    sandboxReady = false;
    creationPromise = null;
  }
}

export async function installPackage(packageName) {
  return executePython(`import subprocess; subprocess.check_call(['pip', 'install', '${packageName}'])`);
}
