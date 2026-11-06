import { copyFile, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const isHtml = name => /\.html?(?:\.(?:gz|br))?$/i.test(name);

function contains(directory, file) {
  const path = relative(directory, file);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}

// Resolve existing parents as well as complete paths, including symlinks and
// Windows junctions, before checking whether the two destinations overlap.
async function outputPath(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("htmlFile and publicDir must be non-empty path strings");
  }
  let path = resolve(value);
  const missing = [];
  while (true) {
    try {
      return join(await realpath(path), ...missing.reverse());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = dirname(path);
      if (parent === path) throw error;
      missing.push(basename(path));
      path = parent;
    }
  }
}

async function filesIn(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(join(directory, entry.name), `${name}/`));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Symbolic links and special files are not supported: ${name}`);
  }
  return files.sort();
}

/** Export the packaged application without placing HTML in the public directory. */
export async function exportResources({ htmlFile, publicDir } = {}) {
  const [html, destination, source] = await Promise.all([
    outputPath(htmlFile), outputPath(publicDir), realpath(packageRoot),
  ]);
  if (contains(destination, html) || contains(html, destination)) {
    throw new Error("htmlFile must be outside publicDir");
  }
  if (contains(source, html) || contains(source, destination) || contains(destination, source)) {
    throw new Error("Output paths must not overlap the installed package");
  }

  const dist = join(source, "dist");
  const distFiles = await filesIn(dist);
  const htmlBytes = await readFile(join(dist, "index.html"));
  const resources = distFiles.filter(name => name !== "index.html");
  if (resources.some(name => isHtml(name) || name.endsWith(".map"))) {
    throw new Error("Unexpected HTML or sourcemap in packaged resources");
  }
  for (const name of ["THIRD_PARTY_LICENSES.md", "THIRD_PARTY_NOTICES.txt"]) {
    await readFile(join(dist, name));
  }
  const copies = resources.map(name => [join(dist, name), name]);
  for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
    await readFile(join(source, name));
    copies.push([join(source, name), name]);
  }
  for (const name of await filesIn(join(source, "LICENSES"))) {
    copies.push([join(source, "LICENSES", name), `LICENSES/${name}`]);
  }
  if (copies.some(([, name]) => isHtml(name) || name.endsWith(".map"))) {
    throw new Error("Unexpected HTML or sourcemap in packaged resources");
  }

  let existing = [];
  try {
    existing = await filesIn(destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing.some(isHtml)) throw new Error("publicDir already contains HTML");

  // Existing unrelated files are preserved. No directory is recursively removed.
  for (const [from, name] of copies) {
    const target = join(destination, name);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(from, target);
  }
  await mkdir(dirname(html), { recursive: true });
  await writeFile(html, htmlBytes);
  return { htmlFile: html, publicDir: destination, files: copies.map(([, name]) => name).sort() };
}
