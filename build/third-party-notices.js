import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Vite sees these prebuilt bundles as single modules. Preserve the licenses of
// their dependencies too, including code embedded in the MapLibre worker.
const roots = [
  "maplibre-gl",
  "@maplibre/maplibre-gl-geocoder",
  "@maplibre/maplibre-gl-inspect",
];
const packages = new Map();

function findPackage(name, from) {
  let directory = from;
  while (true) {
    const candidate = join(directory, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Missing dependency: ${name}`);
    directory = parent;
  }
}

function collect(name, from) {
  // Type declarations are not distributed as browser code.
  if (name.startsWith("@types/")) return;
  const directory = findPackage(name, from);
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const key = `${manifest.name}@${manifest.version}`;
  if (packages.has(key)) return;
  const files = readdirSync(directory, { withFileTypes: true })
    .filter(file => file.isFile() && /^(licen[cs]e|copying|notice|copyright)/i.test(file.name))
    .map(file => file.name)
    .sort();
  let texts = files.map(file => `${file}\n\n${readFileSync(join(directory, file), "utf8").trim()}`);
  if (texts.length === 0) {
    // Some packages (e.g. murmurhash-js) put their license in the README.
    const readme = readFileSync(join(directory, "README.md"), "utf8");
    const license = readme.split(/\n## License[^\n]*\n/i)[1]?.trim();
    if (!license) throw new Error(`Missing license text: ${key}`);
    texts = [`README.md (license section)\n\n${license}`];
  }
  packages.set(key, `## ${key} (${manifest.license ?? "see license text"})\n\n${texts.join("\n\n")}`);
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    collect(dependency, directory);
  }
}

for (const name of roots) collect(name, resolve("."));
const sections = [...packages].sort(([a], [b]) => a.localeCompare(b, "en"));
const header = "# Prebundled dependency licenses and notices\n\n"
  + "Includes the dependency trees of MapLibre GL JS, its worker, geocoder and inspect plugins.\n";
writeFileSync("dist/THIRD_PARTY_NOTICES.txt", `${header}\n${sections.map(([, text]) => text).join("\n\n---\n\n")}\n`);
