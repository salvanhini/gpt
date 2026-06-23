/* global Dexie */

let db = null;

function getDB() {
  if (db) return db;
  db = new Dexie("SistemaProdutivoDB");
  db.version(1).stores({
    tarefas: "++id, texto, status, dataCriacao, dataExecucao, recorrencia",
    configuracoes: "chave, valor",
  });
  return db;
}

export async function initTaskSystem() {
  try {
    await getDB().open();
    await checkAuto();
  } catch (e) {
    console.warn("[TASK] Erro ao inicializar sistema de tarefas:", e);
  }
}

export async function addTask(texto, recorrencia = "unica", tipo = "manual") {
  const dataAgora = new Date();
  let dataExecucao = new Date(dataAgora);

  if (recorrencia === "diaria") dataExecucao.setDate(dataExecucao.getDate() + 1);
  else if (recorrencia === "semanal") dataExecucao.setDate(dataExecucao.getDate() + 7);
  else if (recorrencia === "mensal") dataExecucao.setMonth(dataExecucao.getMonth() + 1);

  const id = await getDB().tarefas.add({
    texto: texto.trim(),
    status: "pendente",
    tipo,
    dataCriacao: dataAgora.toISOString(),
    dataExecucao: dataExecucao.toISOString(),
    recorrencia,
  });

  return id;
}

export async function getPendingTasks() {
  return getDB().tarefas
    .where("status")
    .equals("pendente")
    .sortBy("dataExecucao");
}

export async function getTasksByType(tipo) {
  const pendentes = await getPendingTasks();
  return pendentes.filter((t) => t.tipo === tipo);
}

export async function getOverdueTasks() {
  const pendentes = await getPendingTasks();
  const agora = new Date();
  return pendentes.filter((t) => new Date(t.dataExecucao) <= agora);
}

export async function completeTask(id) {
  await getDB().tarefas.update(id, { status: "concluida" });
}

export async function deleteTask(id) {
  await getDB().tarefas.delete(id);
}

async function updateTaskRecurrence(task) {
  if (task.recorrencia === "mensal") {
    const novaData = new Date(task.dataExecucao);
    novaData.setMonth(novaData.getMonth() + 1);
    await getDB().tarefas.update(task.id, { dataExecucao: novaData.toISOString() });
    return true;
  }
  if (task.recorrencia === "diaria") {
    const novaData = new Date(task.dataExecucao);
    novaData.setDate(novaData.getDate() + 1);
    await getDB().tarefas.update(task.id, { dataExecucao: novaData.toISOString() });
    return true;
  }
  if (task.recorrencia === "semanal") {
    const novaData = new Date(task.dataExecucao);
    novaData.setDate(novaData.getDate() + 7);
    await getDB().tarefas.update(task.id, { dataExecucao: novaData.toISOString() });
    return true;
  }
  return false;
}

async function checkAuto() {
  try {
    const pendentes = await getPendingTasks();
    const agora = new Date();
    for (const task of pendentes) {
      const dataExec = new Date(task.dataExecucao);
      if (dataExec <= agora) {
        if (task.tipo === "pesquisa") continue;
        const renewed = await updateTaskRecurrence(task);
        if (!renewed) {
          await getDB().tarefas.update(task.id, { status: "concluida" });
        }
      }
    }
    const atrasadas = pendentes.filter((t) => new Date(t.dataExecucao) <= agora && t.tipo !== "pesquisa");
    return atrasadas;
  } catch (e) {
    console.warn("[TASK] Erro no check automático:", e);
    return [];
  }
}

export async function checkOverdueTasks() {
  return checkAuto();
}

export function parseTaskCommand(message) {
  const patterns = [
    { regex: /me\s+lembre\s+de\s+(.+?)\s+(?:(?:uma\s+vez\s+por|todo|toda)\s+)?(m[eê]s|semana|dia)/i, rec: null, tipo: "manual" },
    { regex: /criar\s+tarefa\s*:?\s*(.+)/i, rec: "unica", tipo: "manual" },
    { regex: /lembrar\s+de\s+(.+)/i, rec: "unica", tipo: "manual" },
    { regex: /tarefa\s+nova\s*:?\s*(.+)/i, rec: "unica", tipo: "manual" },
    { regex: /^(?:adicione|crie|registre)\s+.*?(?:tarefa|lembrete)\s+(.+)/i, rec: "unica", tipo: "manual" },
    { regex: /^(?:pesquise|busque|procure)\s+(.+?)\s+(?:(?:uma\s+vez\s+por|todo|toda)\s+)?(m[eê]s|semana|dia)/i, rec: null, tipo: "pesquisa" },
    { regex: /^(?:pesquise|busque|procure)\s+(.+)/i, rec: "unica", tipo: "pesquisa" },
  ];

  for (const { regex, rec, tipo } of patterns) {
    const match = message.match(regex);
    if (match) {
      let texto, recorrencia;
      if (rec) {
        texto = match[1];
        recorrencia = rec;
      } else {
        texto = match[1].trim();
        const recWord = (match[2] || "").toLowerCase();
        if (recWord.startsWith("m")) recorrencia = "mensal";
        else if (recWord.startsWith("s")) recorrencia = "semanal";
        else if (recWord.startsWith("d")) recorrencia = "diaria";
        else recorrencia = "unica";
      }
      return { texto, recorrencia, tipo };
    }
  }
  return null;
}
