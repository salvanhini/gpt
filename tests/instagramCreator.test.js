import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreativeBrief,
  buildInstagramImagePrompt,
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
});

test("isInstagramAgent detects the dedicated Instagram agent", () => {
  assert.equal(isInstagramAgent(INSTAGRAM_AGENT_ID), true);
  assert.equal(isInstagramAgent("agent-general"), false);
});
