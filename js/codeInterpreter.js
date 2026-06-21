// E2B Code Interpreter using Pyodide (client-side Python in browser)
let pyodideInstance = null;
let loadingPromise = null;

async function loadPyodideScript() {
  if (globalThis.loadPyodide) {
    return globalThis.loadPyodide;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
    script.onload = () => resolve(globalThis.loadPyodide);
    script.onerror = () => reject(new Error("Falha ao carregar Pyodide."));
    document.head.appendChild(script);
  });
}

export async function initPyodide() {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const loadPyodide = await loadPyodideScript();
      pyodideInstance = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
      });

      // Install common packages
      await pyodideInstance.loadPackage(["micropip"]);

      return pyodideInstance;
    } catch (error) {
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

export async function executePython(code, onOutput = null) {
  const pyodide = await initPyodide();

  // Capture stdout/stderr
  pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
  `);

  let result = "";
  let error = "";

  try {
    // Execute the code
    const output = await pyodide.runPythonAsync(code);

    // Get captured output
    const stdout = pyodide.runPython("sys.stdout.getvalue()");
    const stderr = pyodide.runPython("sys.stderr.getvalue()");

    if (stdout) {
      result += stdout;
    }
    if (output !== undefined && output !== null) {
      result += String(output);
    }
    if (stderr) {
      error += stderr;
    }
  } catch (err) {
    error = err.message || String(err);
  }

  // Reset stdout/stderr
  pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
  `);

  return {
    success: !error,
    result: result.trim(),
    error: error.trim(),
  };
}

export async function installPackage(packageName) {
  const pyodide = await initPyodide();
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  await micropip.install(packageName);
  return true;
}

export async function isPyodideReady() {
  return pyodideInstance !== null;
}

export async function getPyodideVersion() {
  if (!pyodideInstance) return null;
  return pyodideInstance.runPython("import sys; sys.version");
}
