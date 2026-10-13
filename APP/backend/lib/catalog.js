import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadCatalog() {
  const path = process.env.CATALOG_PATH || join(root, "data", "catalog.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadServices() {
  const path = process.env.SERVICES_PATH || join(root, "data", "services.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

export function findProduct(catalog, id) {
  return catalog.products.find((product) => product.id === id) || null;
}
