const DB_NAME = "femicgpt-editor";
const DB_VERSION = 1;

let db = null;

function getDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains("projetos_editor")) {
        database.createObjectStore("projetos_editor", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("templates")) {
        database.createObjectStore("templates", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("posts")) {
        database.createObjectStore("posts", { keyPath: "id" });
      }
    };
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function salvarProjetoEditor(projeto) {
  const database = await getDB();
  const tx = database.transaction("projetos_editor", "readwrite");
  const store = tx.objectStore("projetos_editor");
  const agora = new Date().toISOString();
  const data = {
    ...projeto,
    id: projeto.id || generateId(),
    atualizadoEm: agora,
    criadoEm: projeto.criadoEm || agora,
  };
  store.put(data);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(data);
    tx.onerror = () => reject(tx.error);
  });
}

export async function buscarProjetoEditor(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("projetos_editor", "readonly");
    const store = tx.objectStore("projetos_editor");
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function listarProjetosEditor() {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("projetos_editor", "readonly");
    const store = tx.objectStore("projetos_editor");
    const request = store.getAll();
    request.onsuccess = () => {
      const items = (request.result || []).sort((a, b) =>
        new Date(b.atualizadoEm || 0) - new Date(a.atualizadoEm || 0)
      );
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deletarProjetoEditor(id) {
  const database = await getDB();
  const tx = database.transaction("projetos_editor", "readwrite");
  const store = tx.objectStore("projetos_editor");
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function salvarTemplate(template) {
  const database = await getDB();
  const tx = database.transaction("templates", "readwrite");
  const store = tx.objectStore("templates");
  const data = {
    ...template,
    id: template.id || generateId(),
    criadoEm: template.criadoEm || new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
  store.put(data);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(data);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listarTemplates(categoria) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("templates", "readonly");
    const store = tx.objectStore("templates");
    const request = store.getAll();
    request.onsuccess = () => {
      let items = request.result || [];
      if (categoria) {
        items = items.filter((t) => t.categoria === categoria);
      }
      resolve(items.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0)));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function carregarTemplate(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("templates", "readonly");
    const store = tx.objectStore("templates");
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deletarTemplate(id) {
  const database = await getDB();
  const tx = database.transaction("templates", "readwrite");
  const store = tx.objectStore("templates");
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function salvarPost(post) {
  const database = await getDB();
  const tx = database.transaction("posts", "readwrite");
  const store = tx.objectStore("posts");
  const data = {
    ...post,
    id: post.id || generateId(),
    criadoEm: post.criadoEm || new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
  store.put(data);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(data);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listarPosts(filtros) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("posts", "readonly");
    const store = tx.objectStore("posts");
    const request = store.getAll();
    request.onsuccess = () => {
      let items = request.result || [];
      if (filtros?.tipo) {
        items = items.filter((p) => p.tipo === filtros.tipo);
      }
      resolve(items.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0)));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function buscarPost(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("posts", "readonly");
    const store = tx.objectStore("posts");
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deletarPost(id) {
  const database = await getDB();
  const tx = database.transaction("posts", "readwrite");
  const store = tx.objectStore("posts");
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
