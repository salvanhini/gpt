const BRANDS_KEY = "femicgpt:brands";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function loadBrands() {
  return safeParse(localStorage.getItem(BRANDS_KEY), []);
}

export function saveBrands(brands) {
  localStorage.setItem(BRANDS_KEY, JSON.stringify(brands));
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
  const brand = {
    id: createBrandId(data.name, brands),
    name: String(data.name || "").trim(),
    primaryColor: String(data.primaryColor || "").trim() || "#1D4ED8",
    secondaryColor: String(data.secondaryColor || "").trim() || "#0F172A",
    logoUrl: String(data.logoUrl || "").trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

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
    ...brands[index],
    ...data,
    name: data.name?.trim() ?? brands[index].name,
    primaryColor: data.primaryColor?.trim() ?? brands[index].primaryColor,
    secondaryColor: data.secondaryColor?.trim() ?? brands[index].secondaryColor,
    logoUrl: data.logoUrl?.trim() ?? brands[index].logoUrl,
    updatedAt: new Date().toISOString(),
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
