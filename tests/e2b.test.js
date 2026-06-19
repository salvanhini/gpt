import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeSpreadsheetsWithE2B,
  buildAdvancedAnalysisMarkdown,
} from "../js/e2b.js";

test("buildAdvancedAnalysisMarkdown formats dataset sections and chart summary", () => {
  const markdown = buildAdvancedAnalysisMarkdown({
    request: "Resuma a planilha",
    datasets: [
      {
        name: "dados.csv",
        rows: 10,
        columns: 3,
        columnNames: ["nome", "idade", "cidade"],
        missing: [{ column: "idade", missing: 1 }],
        preview: [{ nome: "Ana", idade: "32", cidade: "BH" }],
        numericSummary: [{ column: "idade", mean: 32, std: 0, min: 32, max: 32 }],
      },
    ],
    chart: { title: "Distribuição de idade" },
  });

  assert.match(markdown, /Analise avancada concluida/);
  assert.match(markdown, /dados\.csv/);
  assert.match(markdown, /Distribuição de idade/);
});

test("analyzeSpreadsheetsWithE2B writes files, executes Python and returns chart url", async () => {
  const calls = {
    writes: [],
    code: "",
    download: [],
    killed: false,
  };

  const mockSandbox = {
    files: {
      async write(path, bytes) {
        calls.writes.push({ path, bytes });
      },
      async read(path) {
        assert.equal(path, "/tmp/femic-e2b-analysis.json");
        return JSON.stringify({
          request: "Analise a planilha",
          datasets: [{ name: "dados.csv", rows: 2, columns: 2, columnNames: ["a", "b"], missing: [], preview: [], numericSummary: [] }],
          chart: { path: "/tmp/femic-e2b-chart.png", title: "Distribuição de a" },
        });
      },
    },
    async runCode(code) {
      calls.code = code;
      return { text: "analysis-ready" };
    },
    async downloadUrl(path) {
      calls.download.push(path);
      return `https://example.com${path}`;
    },
    async kill() {
      calls.killed = true;
    },
  };

  const result = await analyzeSpreadsheetsWithE2B({
    files: [
      {
        name: "dados.csv",
        extension: "csv",
        bytes: new TextEncoder().encode("a,b\n1,2").buffer,
      },
    ],
    prompt: "Analise a planilha",
    settings: { e2bApiKey: "e2b_test" },
    loadSdk: async () => ({
      Sandbox: {
        async create(options) {
          assert.equal(options.apiKey, "e2b_test");
          assert.equal(options.allowInternetAccess, false);
          return mockSandbox;
        },
      },
    }),
  });

  assert.equal(calls.writes.length, 1);
  assert.match(calls.code, /dados\.csv/);
  assert.deepEqual(calls.download, ["/tmp/femic-e2b-chart.png"]);
  assert.equal(result.chart.url, "https://example.com/tmp/femic-e2b-chart.png");
  assert.equal(calls.killed, true);
});
