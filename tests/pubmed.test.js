import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPubMedContext,
  buildPubMedFetchUrl,
  buildPubMedSearchUrl,
  buildPubMedSummaryUrl,
  extractPubMedAbstractsFromXml,
  normalizePubMedSummaryRecord,
  parsePubMedSearchResponse,
} from "../js/pubmed.js";

test("buildPubMedSearchUrl includes retmax and encoded query", () => {
  const url = buildPubMedSearchUrl("breast cancer", { retmax: 8 });

  assert.match(url, /esearch\.fcgi/);
  assert.match(url, /retmax=8/);
  assert.match(url, /term=breast\+cancer/);
});

test("buildPubMedSummaryUrl and buildPubMedFetchUrl include PMID list", () => {
  assert.match(buildPubMedSummaryUrl(["1", "2"]), /id=1%2C2/);
  assert.match(buildPubMedFetchUrl(["1", "2"]), /id=1%2C2/);
});

test("parsePubMedSearchResponse extracts idlist safely", () => {
  const ids = parsePubMedSearchResponse({
    esearchresult: {
      idlist: ["123", "456"],
    },
  });

  assert.deepEqual(ids, ["123", "456"]);
});

test("normalizePubMedSummaryRecord maps title authors and journal", () => {
  const article = normalizePubMedSummaryRecord({
    uid: "12345",
    title: "Example paper",
    authors: [{ name: "Smith J" }, { name: "Silva M" }],
    fulljournalname: "Nature",
    pubdate: "2024 Jan",
  });

  assert.equal(article.pmid, "12345");
  assert.equal(article.title, "Example paper");
  assert.deepEqual(article.authors, ["Smith J", "Silva M"]);
  assert.equal(article.journal, "Nature");
  assert.equal(article.year, "2024");
});

test("extractPubMedAbstractsFromXml groups abstract sections by PMID", () => {
  globalThis.DOMParser = class FakeDomParser {
    parseFromString() {
      return {
        querySelectorAll(selector) {
          if (selector === "PubmedArticle") {
            return [
              {
                querySelector(nodeSelector) {
                  if (nodeSelector === "PMID") {
                    return { textContent: "123" };
                  }
                  return null;
                },
                querySelectorAll(nodeSelector) {
                  if (nodeSelector === "Abstract AbstractText") {
                    return [
                      { getAttribute: () => "Background", textContent: "First part" },
                      { getAttribute: () => "", textContent: "Second part" },
                    ];
                  }
                  return [];
                },
              },
            ];
          }
          return [];
        },
      };
    }
  };

  const abstracts = extractPubMedAbstractsFromXml("<xml />");
  assert.equal(abstracts["123"], "Background: First part\nSecond part");
});

test("buildPubMedContext formats multiple article references", () => {
  const context = buildPubMedContext([
    {
      pmid: "1",
      title: "Study A",
      authors: ["A", "B"],
      journal: "Journal",
      year: "2025",
      abstract: "Summary",
      pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/1/",
    },
  ]);

  assert.match(context, /Artigo 1/);
  assert.match(context, /PMID: 1/);
  assert.match(context, /Study A/);
});
