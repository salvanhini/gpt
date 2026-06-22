const BRANDS_KEY = "femicgpt:brands";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeTemplate(template, index = 0) {
  return {
    id: template?.id || `template-${index + 1}`,
    name: String(template?.name || "").trim() || `Template ${index + 1}`,
    formatId: String(template?.formatId || "").trim() || "story_9_16",
    objective: String(template?.objective || "").trim(),
    audience: String(template?.audience || "").trim(),
    headline: String(template?.headline || "").trim(),
    supportingText: String(template?.supportingText || "").trim(),
    cta: String(template?.cta || "").trim(),
    variationCount: Number(template?.variationCount) > 0 ? Number(template.variationCount) : 1,
    createdAt: template?.createdAt || new Date().toISOString(),
  };
}

function normalizeBrand(brand, index = 0) {
  const templates = Array.isArray(brand?.templates) ? brand.templates.map((item, templateIndex) => normalizeTemplate(item, templateIndex)) : [];
  const defaultTemplateId = templates.some((template) => template.id === brand?.defaultTemplateId)
    ? brand.defaultTemplateId
    : templates[0]?.id || "";

  return {
    id: brand?.id || `brand-${index + 1}`,
    name: String(brand?.name || "").trim(),
    primaryColor: String(brand?.primaryColor || "").trim() || "#1D4ED8",
    secondaryColor: String(brand?.secondaryColor || "").trim() || "#0F172A",
    logoUrl: String(brand?.logoUrl || "").trim(),
    templateStyle: String(brand?.templateStyle || "").trim(),
    templateNotes: String(brand?.templateNotes || "").trim(),
    templates,
    defaultTemplateId,
    createdAt: brand?.createdAt || new Date().toISOString(),
    updatedAt: brand?.updatedAt || new Date().toISOString(),
  };
}

export function loadBrands() {
  const raw = safeParse(localStorage.getItem(BRANDS_KEY), []);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((brand, index) => normalizeBrand(brand, index));
}

export function saveBrands(brands) {
  try {
    localStorage.setItem(BRANDS_KEY, JSON.stringify(brands));
  } catch {
    // Storage quota excedida ou modo privado
  }
  return brands;
}

export function createBrandId(name, brands = [], randomId = () => crypto.randomUUID()) {
  const slug = String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const baseId = `brand-${slug || randomId()}`;
  const existingIds = new Set((brands || []).map((brand) => brand?.id).filter(Boolean));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

export function createBrand(data) {
  const brands = loadBrands();
  const brand = normalizeBrand({
    id: createBrandId(data.name, brands),
    name: data.name,
    primaryColor: data.primaryColor,
    secondaryColor: data.secondaryColor,
    logoUrl: data.logoUrl,
    templateStyle: data.templateStyle,
    templateNotes: data.templateNotes,
    templates: Array.isArray(data.templates) ? data.templates : [],
    defaultTemplateId: data.defaultTemplateId || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  brands.unshift(brand);
  saveBrands(brands);
  return brand;
}

export function updateBrand(id, data) {
  const brands = loadBrands();
  const index = brands.findIndex((brand) => brand.id === id);
  if (index === -1) {
    throw new Error("Marca não encontrada.");
  }

  brands[index] = {
    ...normalizeBrand({
      ...brands[index],
      ...data,
      templates: Array.isArray(data.templates) ? data.templates : brands[index].templates,
      updatedAt: new Date().toISOString(),
    }),
  };

  saveBrands(brands);
  return brands[index];
}

export function deleteBrand(id) {
  const brands = loadBrands();
  const target = brands.find((brand) => brand.id === id);
  if (!target) {
    throw new Error("Marca não encontrada.");
  }

  const nextBrands = brands.filter((brand) => brand.id !== id);
  saveBrands(nextBrands);
  return nextBrands;
}
