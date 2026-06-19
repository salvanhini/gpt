const E2B_SDK_URL = "https://esm.sh/@e2b/code-interpreter@1.5.1?bundle";
const DEFAULT_E2B_TIMEOUT_MS = 5 * 60 * 1000;
const DATASET_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);
const OUTPUT_JSON_PATH = "/tmp/femic-e2b-analysis.json";
const OUTPUT_CHART_PATH = "/tmp/femic-e2b-chart.png";

function normalizePrompt(prompt = "") {
  return String(prompt || "").trim() || "Faça uma análise exploratória inicial com foco em resumo, qualidade dos dados e principais colunas.";
}

function toUint8Array(buffer) {
  if (buffer instanceof Uint8Array) {
    return buffer;
  }

  return new Uint8Array(buffer);
}

function getTabularFiles(runtimeFiles = []) {
  return (runtimeFiles || []).filter((file) => DATASET_EXTENSIONS.has(String(file.extension || "").toLowerCase()));
}

function buildDatasetManifest(files = []) {
  return files.map((file) => ({
    name: file.name,
    path: `/home/user/${file.name}`,
    type: file.extension,
  }));
}

function buildPythonAnalysisScript(datasetManifest, requestText) {
  return `
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

REQUEST = ${JSON.stringify(requestText)}
DATASETS = ${JSON.stringify(datasetManifest)}
OUTPUT_JSON_PATH = "${OUTPUT_JSON_PATH}"
OUTPUT_CHART_PATH = "${OUTPUT_CHART_PATH}"


def load_dataframe(dataset):
    path = dataset["path"]
    extension = dataset["type"].lower()
    if extension == "csv":
        return pd.read_csv(path)
    return pd.read_excel(path)


def describe_missing(df):
    missing = df.isna().sum()
    missing = missing[missing > 0].sort_values(ascending=False)
    return [
        {"column": str(column), "missing": int(count)}
        for column, count in missing.head(8).items()
    ]


def preview_rows(df):
    frame = df.head(5).copy()
    frame = frame.fillna("")
    rows = []
    for _, row in frame.iterrows():
        rows.append({str(column): str(value)[:120] for column, value in row.to_dict().items()})
    return rows


def numeric_summary(df):
    numeric = df.select_dtypes(include="number")
    if numeric.empty:
        return []
    described = numeric.describe().transpose().head(8).fillna(0)
    rows = []
    for column, stats in described.iterrows():
        rows.append({
            "column": str(column),
            "mean": round(float(stats.get("mean", 0.0)), 4),
            "std": round(float(stats.get("std", 0.0)), 4),
            "min": round(float(stats.get("min", 0.0)), 4),
            "max": round(float(stats.get("max", 0.0)), 4),
        })
    return rows


analysis = {
    "request": REQUEST,
    "datasets": [],
    "chart": None,
}

chart_created = False

for dataset in DATASETS:
    df = load_dataframe(dataset)
    summary = {
        "name": dataset["name"],
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "columnNames": [str(column) for column in list(df.columns[:20])],
        "missing": describe_missing(df),
        "preview": preview_rows(df),
        "numericSummary": numeric_summary(df),
    }
    analysis["datasets"].append(summary)

    if not chart_created:
        numeric = df.select_dtypes(include="number")
        if not numeric.empty:
            series = numeric.iloc[:, 0].dropna()
            if not series.empty:
                plt.figure(figsize=(8, 4.5))
                plt.hist(series, bins=min(12, max(5, len(series.unique()))), color="#2563eb", edgecolor="white")
                plt.title(f"Distribuição de {numeric.columns[0]}")
                plt.xlabel(str(numeric.columns[0]))
                plt.ylabel("Frequência")
                plt.tight_layout()
                plt.savefig(OUTPUT_CHART_PATH, dpi=160)
                plt.close()
                analysis["chart"] = {
                    "path": OUTPUT_CHART_PATH,
                    "title": f"Distribuição de {numeric.columns[0]}",
                    "dataset": dataset["name"],
                }
                chart_created = True

Path(OUTPUT_JSON_PATH).write_text(json.dumps(analysis, ensure_ascii=False), encoding="utf-8")
print("analysis-ready")
`;
}

export async function loadE2BCodeInterpreterSdk() {
  return import(E2B_SDK_URL);
}

export function formatPreviewTable(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "";
  }

  const columns = Object.keys(rows[0] || {});
  if (!columns.length) {
    return "";
  }

  const header = `| ${columns.join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(row[column] ?? "").replace(/\n/g, " ")).join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

export function formatNumericSummaryTable(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "";
  }

  const header = "| Coluna | Média | Desvio | Mínimo | Máximo |";
  const divider = "| --- | ---: | ---: | ---: | ---: |";
  const body = rows.map((row) => `| ${row.column} | ${row.mean} | ${row.std} | ${row.min} | ${row.max} |`);
  return [header, divider, ...body].join("\n");
}

export function buildAdvancedAnalysisMarkdown(result) {
  const lines = [
    "Analise avancada concluida com Python no sandbox E2B.",
    "",
    `Pedido: ${result.request}`,
  ];

  (result.datasets || []).forEach((dataset) => {
    lines.push("");
    lines.push(`## ${dataset.name}`);
    lines.push(`- Linhas: ${dataset.rows}`);
    lines.push(`- Colunas: ${dataset.columns}`);
    lines.push(`- Principais colunas: ${dataset.columnNames.join(", ") || "n/d"}`);

    if (dataset.missing?.length) {
      lines.push("- Campos com ausencias:");
      dataset.missing.forEach((item) => {
        lines.push(`  - ${item.column}: ${item.missing}`);
      });
    }

    const previewTable = formatPreviewTable(dataset.preview);
    if (previewTable) {
      lines.push("");
      lines.push("Prévia:");
      lines.push(previewTable);
    }

    const numericTable = formatNumericSummaryTable(dataset.numericSummary);
    if (numericTable) {
      lines.push("");
      lines.push("Resumo numérico:");
      lines.push(numericTable);
    }
  });

  if (result.chart?.title) {
    lines.push("");
    lines.push(`Gráfico gerado: ${result.chart.title}`);
  }

  return lines.join("\n").replace(/\n {2}- /g, "\n- ");
}

export async function analyzeSpreadsheetsWithE2B({
  files,
  prompt = "",
  settings,
  loadSdk = loadE2BCodeInterpreterSdk,
} = {}) {
  const tabularFiles = getTabularFiles(files);
  if (!tabularFiles.length) {
    throw new Error("Anexe pelo menos um arquivo CSV ou Excel para usar a análise avançada.");
  }

  if (!settings?.e2bApiKey) {
    throw new Error("Adicione sua chave da E2B nas configurações para usar a análise avançada.");
  }

  const { Sandbox } = await loadSdk();
  const sandbox = await Sandbox.create({
    apiKey: settings.e2bApiKey,
    timeoutMs: DEFAULT_E2B_TIMEOUT_MS,
    allowInternetAccess: false,
  });

  try {
    for (const file of tabularFiles) {
      await sandbox.files.write(`/home/user/${file.name}`, toUint8Array(file.bytes));
    }

    await sandbox.runCode(buildPythonAnalysisScript(buildDatasetManifest(tabularFiles), normalizePrompt(prompt)));
    const rawOutput = await sandbox.files.read(OUTPUT_JSON_PATH);
    const result = JSON.parse(typeof rawOutput === "string" ? rawOutput : new TextDecoder().decode(rawOutput));

    if (result.chart?.path && typeof sandbox.downloadUrl === "function") {
      result.chart.url = await sandbox.downloadUrl(result.chart.path, {
        useSignatureExpiration: 10 * 60 * 1000,
      });
    }

    return result;
  } finally {
    if (typeof sandbox.kill === "function") {
      await sandbox.kill().catch(() => {});
    }
  }
}
