import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreativeBrief,
  buildInstagramCopyFallback,
  buildInstagramCopyPrompt,
  buildInstagramImagePrompt,
  buildInstagramVariationPrompt,
  getInstagramFormatById,
  INSTAGRAM_AGENT_ID,
  isInstagramAgent,
} from "../js/instagramCreator.js";

test("buildCreativeBrief joins filled Instagram fields in order", () => {
  const brief = buildCreativeBrief({
    objective: "Divulgar promocao",
    headline: "Laser com valor especial",
    supportingText: "Vagas limitadas nesta semana",
    cta: "Chame no direct",
  });

  assert.match(brief, /Objetivo: Divulgar promocao/);
  assert.match(brief, /Texto principal: Laser com valor especial/);
  assert.match(brief, /Texto complementar: Vagas limitadas nesta semana/);
  assert.match(brief, /CTA: Chame no direct/);
});

test("buildInstagramImagePrompt includes brand, format and premium direction", () => {
  const prompt = buildInstagramImagePrompt({
    brand: {
      name: "Clinica Bem Viver",
      primaryColor: "#1D4ED8",
      secondaryColor: "#0F172A",
      logoUrl: "data:image/png;base64,abc",
    },
    formatId: "story_9_16",
    draft: {
      objective: "Gerar leads",
      headline: "Avaliacao gratuita",
    },
  });

  assert.match(prompt, /Clinica Bem Viver/);
  assert.match(prompt, /Story 9:16/);
  assert.match(prompt, /#1D4ED8/);
  assert.match(prompt, /executivo claro/i);
  assert.match(prompt, /Avaliacao gratuita/);
});

test("getInstagramFormatById maps story and square formats to image sizes", () => {
  assert.equal(getInstagramFormatById("story_9_16").imageSize, "portrait_16_9");
  assert.equal(getInstagramFormatById("post_square").imageSize, "square_hd");
  assert.equal(getInstagramFormatById("carousel_cover_4_5").imageSize, "portrait_4_3");
  assert.equal(getInstagramFormatById("highlight_cover_square").imageSize, "square_hd");
});

test("isInstagramAgent detects the dedicated Instagram agent", () => {
  assert.equal(isInstagramAgent(INSTAGRAM_AGENT_ID), true);
  assert.equal(isInstagramAgent("agent-general"), false);
});

test("buildInstagramVariationPrompt injects variation guidance", () => {
  const prompt = buildInstagramVariationPrompt({
    basePrompt: "Base",
    variationIndex: 2,
    totalVariations: 4,
  });

  assert.match(prompt, /variacao 2 de 4/i);
  assert.match(prompt, /mesma marca/i);
});

test("buildInstagramCopyPrompt requests caption and hashtags in a strict format", () => {
  const prompt = buildInstagramCopyPrompt({
    brand: { name: "Marca A" },
    formatId: "reel_cover_9_16",
    variationCount: 3,
    draft: {
      objective: "Vender mais",
      headline: "Oferta premium",
    },
  });

  assert.match(prompt, /LEGENDA:/);
  assert.match(prompt, /HASHTAGS:/);
  assert.match(prompt, /Marca A/);
  assert.match(prompt, /3/);
});

test("buildInstagramCopyFallback creates a basic caption and hashtags without API access", () => {
  const fallback = buildInstagramCopyFallback({
    brand: { name: "Clinica Bem Viver" },
    draft: {
      headline: "Avaliacao gratuita",
      cta: "Chame no WhatsApp",
    },
  });

  assert.match(fallback, /LEGENDA:/);
  assert.match(fallback, /HASHTAGS:/);
  assert.match(fallback, /#clinicabemviver/i);
});
