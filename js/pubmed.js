const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PUBMED_TOOL = "femic-gpt";

function safeText(value) {
  return String(value || "").trim();
}

export function buildPubMedSearchUrl(query, { retmax = 5 } = {}) {
  const url = new URL(`${PUBMED_BASE}/esearch.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("retmode", "json");
  url.searchParams.set("sort", "relevance");
  url.searchParams.set("tool", PUBMED_TOOL);
  url.searchParams.set("retmax", String(retmax));
  url.searchParams.set("term", safeText(query));
  return url.toString();
}

export function buildPubMedSummaryUrl(pmids = []) {
  const url = new URL(`${PUBMED_BASE}/esummary.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("retmode", "json");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("tool", PUBMED_TOOL);
  url.searchParams.set("id", pmids.join(","));
  return url.toString();
}

export function buildPubMedFetchUrl(pmids = []) {
  const url = new URL(`${PUBMED_BASE}/efetch.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("retmode", "xml");
  url.searchParams.set("tool", PUBMED_TOOL);
  url.searchParams.set("id", pmids.join(","));
  return url.toString();
}

export function parsePubMedSearchResponse(data) {
  return data?.esearchresult?.idlist?.filter(Boolean) || [];
}

function normalizeAuthors(authors = []) {
  return (authors || [])
    .map((author) => safeText(author?.name || ""))
    .filter(Boolean);
}

export function normalizePubMedSummaryRecord(record = {}) {
  const pmid = safeText(record.uid);
  return {
    pmid,
    title: safeText(record.title),
    authors: normalizeAuthors(record.authors),
    journal: safeText(record.fulljournalname || record.source),
    year: safeText(record.pubdate).slice(0, 4),
    abstract: "",
    pubmedUrl: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
  };
}

export function extractPubMedAbstractsFromXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const articles = Array.from(doc.querySelectorAll("PubmedArticle"));
  const byPmid = {};

  for (const article of articles) {
    const pmid = safeText(article.querySelector("PMID")?.textContent);
    const abstractParts = Array.from(article.querySelectorAll("Abstract AbstractText"))
      .map((node) => {
        const label = safeText(node.getAttribute("Label"));
        const text = safeText(node.textContent);
        return label ? `${label}: ${text}` : text;
      })
      .filter(Boolean);
    byPmid[pmid] = abstractParts.join("\n");
  }

  return byPmid;
}

export function buildPubMedContext(articles = []) {
  return articles
    .map((article, index) => [
      `Artigo ${index + 1}`,
      `PMID: ${article.pmid}`,
      `Titulo: ${article.title}`,
      `Autores: ${(article.authors || []).join(", ") || "Nao informado"}`,
      `Revista: ${article.journal || "Nao informada"}`,
      `Ano: ${article.year || "Nao informado"}`,
      `Resumo: ${article.abstract || "Resumo indisponivel."}`,
      `Link: ${article.pubmedUrl || ""}`,
    ].join("\n"))
    .join("\n\n---\n\n");
}

export async function searchPubMed(query, { retmax = 5 } = {}) {
  let response;
  try {
    response = await fetch(buildPubMedSearchUrl(query, { retmax }));
  } catch {
    throw new Error("Nao foi possivel conectar a PubMed. Verifique sua conexao.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error("Falha ao consultar a PubMed.");
  }
  return parsePubMedSearchResponse(data);
}

export async function fetchPubMedSummaries(pmids = []) {
  if (!pmids.length) {
    return [];
  }

  let response;
  try {
    response = await fetch(buildPubMedSummaryUrl(pmids));
  } catch {
    throw new Error("Nao foi possivel carregar metadados da PubMed.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error("Falha ao carregar metadados da PubMed.");
  }

  return pmids
    .map((pmid) => normalizePubMedSummaryRecord(data?.result?.[pmid] || { uid: pmid }))
    .filter((article) => article.pmid);
}

export async function fetchPubMedAbstracts(pmids = []) {
  if (!pmids.length) {
    return {};
  }

  let response;
  try {
    response = await fetch(buildPubMedFetchUrl(pmids));
  } catch {
    throw new Error("Nao foi possivel carregar abstracts da PubMed.");
  }
  const xmlText = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error("Falha ao carregar abstracts da PubMed.");
  }

  return extractPubMedAbstractsFromXml(xmlText);
}

export async function lookupPubMedArticles(query, { retmax = 5 } = {}) {
  const pmids = await searchPubMed(query, { retmax });
  const summaries = await fetchPubMedSummaries(pmids);
  const abstractsByPmid = await fetchPubMedAbstracts(pmids);

  return summaries.map((article) => ({
    ...article,
    abstract: abstractsByPmid[article.pmid] || "",
  }));
}
