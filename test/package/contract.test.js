import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cp, mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const isHtml = name => /\.html?(?:\.(?:gz|br))?$/i.test(name);
const compressedHtmlNames = [
  "index.html.gz", "index.html.br", "index.htm.gz", "index.htm.br",
  "nested/INDEX.HtMl.GZ", "nested/INDEX.HTML.Br", "nested/INDEX.HtM.gZ", "nested/INDEX.HTM.BR",
];
let temporary;
let consumer;
let installed;
let metadata;
let manifest;
let exportResources;
let installLog;

function npm(args, cwd, env = {}) {
  assert.ok(process.env.npm_execpath, "Run these checks with npm run test:package");
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  assert.equal(result.status, 0, `${args.join(" ")}\n${result.error ?? ""}\n${result.stdout}\n${result.stderr}`);
  return { ...result, log: result.stdout + result.stderr };
}

async function filesIn(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(join(directory, entry.name), `${name}/`));
    else {
      assert.ok(entry.isFile(), `Unexpected link or special file: ${name}`);
      files.push(name);
    }
  }
  return files.sort();
}

function assertPrivateHtml(files) {
  assert.deepEqual(files.filter(isHtml), ["dist/index.html"]);
}

function compressedHtml(name) {
  const html = Buffer.from("<!doctype html><title>Existing HTML</title>");
  return name.toLowerCase().endsWith(".gz") ? gzipSync(html) : brotliCompressSync(html);
}

async function contentsIn(directory) {
  return Promise.all((await filesIn(directory)).map(async name => [name, await readFile(join(directory, name))]));
}

before(async () => {
  temporary = await mkdtemp(join(tmpdir(), "maputnik-package-"));
  const output = process.env.MAPUTNIK_PACKAGE_DIR ? resolve(process.env.MAPUTNIK_PACKAGE_DIR) : join(temporary, "archive");
  await mkdir(output, { recursive: true });
  const packed = npm(["pack", "--json", "--foreground-scripts", "--ignore-scripts=false", "--pack-destination", output], repository);
  const packLog = packed.stdout;
  await writeFile(join(output, "pack-build.log"), packed.log);
  // Lifecycle output precedes npm's final JSON manifest.
  const jsonStart = packLog.search(/^\[\s*\n\s*\{/m);
  assert.notEqual(jsonStart, -1, packLog);
  const jsonEnd = packLog.lastIndexOf("]");
  [metadata] = JSON.parse(packLog.slice(jsonStart, jsonEnd + 1));
  await writeFile(join(output, "pack.json"), JSON.stringify(metadata, null, 2));
  consumer = join(temporary, "consumer");
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), JSON.stringify({ name: "package-contract-check", version: "1.0.0", private: true }));
  const cache = join(temporary, "empty-cache");
  await mkdir(cache);
  installLog = npm(["install", join(output, metadata.filename), "--offline", "--ignore-scripts=false", "--foreground-scripts", "--no-audit", "--no-fund"], consumer, { npm_config_cache: cache }).log;
  await writeFile(join(output, "consumer-install.log"), installLog);
  installed = join(consumer, "node_modules/maputnik");
  manifest = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
  const require = createRequire(join(consumer, "package.json"));
  ({ exportResources } = await import(pathToFileURL(require.resolve("maputnik/resources"))));
}, { timeout: 180000 });

after(async () => {
  if (temporary) {
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
    assert.ok(basename(temporary).startsWith("maputnik-package-"));
    await rm(temporary, { recursive: true, force: true });
  }
});

test("the real archive contains only the browser build, resource API and legal files", async () => {
  const actual = await filesIn(installed);
  assert.deepEqual(actual, metadata.files.map(file => file.path).sort());
  const allowed = new Set(["package.json", "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "package/resources.js", "package/resources.d.ts"]);
  for (const file of metadata.files) {
    assert.ok(allowed.has(file.path) || file.path.startsWith("dist/") || file.path.startsWith("LICENSES/"), file.path);
    assert.equal((await stat(join(installed, file.path))).size, file.size, file.path);
    if (file.path.startsWith("dist/")) assert.doesNotMatch(file.path, /\.(?:map|tsx?|jsx|scss)$/i);
  }
  assertPrivateHtml(actual);
  assert.equal(manifest.private, true);
  assert.match(manifest.version, /^\d+\.\d+\.\d+-fork\.\d+$/);
});

test("ordinary archive installation has no editor build or runtime dependency tree", async () => {
  for (const hook of ["preinstall", "install", "postinstall", "prepare"]) {
    assert.equal(manifest.scripts?.[hook], undefined, hook);
  }
  for (const key of ["dependencies", "peerDependencies", "optionalDependencies", "bundledDependencies"]) {
    assert.equal(Object.keys(manifest[key] ?? {}).length, 0, key);
  }
  assert.doesNotMatch(installLog, /\b(?:vite|tsc)\b|third-party-notices\.js|> maputnik@/);
  const lock = JSON.parse(await readFile(join(consumer, "package-lock.json"), "utf8"));
  assert.deepEqual(Object.keys(lock.packages).sort(), ["", "node_modules/maputnik"]);
  assert.deepEqual((await readdir(join(consumer, "node_modules"))).filter(name => !name.startsWith(".")), ["maputnik"]);
});

test("exported HTML is separate and every public resource and license retains its bytes", async () => {
  const publicDir = join(temporary, "export/public/maputnik");
  const htmlFile = join(temporary, "export/private/editor.html");
  const result = await exportResources({ htmlFile, publicDir });
  assert.deepEqual(await readFile(result.htmlFile), await readFile(join(installed, "dist/index.html")));
  assert.ok(result.files.includes("THIRD_PARTY_LICENSES.md"));
  assert.ok(result.files.includes("THIRD_PARTY_NOTICES.txt"));
  assert.ok(result.files.includes("THIRD_PARTY_NOTICES.md"));
  assert.ok(result.files.includes("LICENSE"));
  assert.equal(result.files.filter(name => name.startsWith("LICENSES/")).length, 7);
  assert.equal(result.files.filter(name => /maplibre-gl-worker-.*\.js$/.test(name)).length, 1);
  for (const font of ["Roboto-Regular-", "Roboto-Medium-"]) {
    assert.equal(result.files.filter(name => name.includes(font) && name.endsWith(".ttf")).length, 1);
  }
  assert.deepEqual(await filesIn(result.publicDir), result.files);
  assert.ok(!result.files.some(isHtml));
  for (const name of result.files) {
    const origin = name === "LICENSE" || name === "THIRD_PARTY_NOTICES.md" || name.startsWith("LICENSES/") ? installed : join(installed, "dist");
    assert.deepEqual(await readFile(join(result.publicDir, name)), await readFile(join(origin, name)), name);
  }
});

test("HTML, CSS and JS reference supplied resources under the unchanged base", async () => {
  const files = await filesIn(join(installed, "dist"));
  const references = [];
  const html = await readFile(join(installed, "dist/index.html"), "utf8");
  for (const match of html.matchAll(/(?:src|href)="(\/maputnik\/[^"]+)"/g)) references.push(["index.html", match[1]]);
  assert.ok(references.some(([, ref]) => ref.endsWith(".css")));
  assert.ok(references.some(([, ref]) => ref.endsWith(".js")));
  for (const name of files.filter(name => /\.(?:css|js)$/.test(name))) {
    const text = await readFile(join(installed, "dist", name), "utf8");
    assert.doesNotMatch(text, /[#@]\s*sourceMappingURL\s*=|__coverage__|\bcov_[\w]+\s*\(/, name);
    if (name.endsWith(".css")) {
      for (const match of text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) {
        if (!/^(?:data:|https?:|\/\/)/.test(match[2])) references.push([name, match[2]]);
      }
    }
    for (const match of text.matchAll(/['"`](\/maputnik\/assets\/[^'"`]+)['"`]/g)) references.push([name, match[1]]);
    for (const match of text.matchAll(/\bimport\s*\(\s*(['"`])(\.\/[^'"`]+)\1/g)) references.push([name, match[2]]);
  }
  for (const name of files.filter(name => name.endsWith(".json"))) {
    const data = JSON.parse(await readFile(join(installed, "dist", name), "utf8"));
    for (const icon of data.icons ?? []) {
      if (!/^(?:data:|https?:|\/\/)/.test(icon.src)) references.push([name, icon.src]);
    }
  }
  for (const font of ["Roboto-Regular-", "Roboto-Medium-"]) {
    assert.ok(references.some(([, ref]) => ref.includes(font)));
  }
  assert.ok(references.some(([, ref]) => ref.includes("maplibre-gl-worker-")));
  for (const [from, ref] of references) {
    const target = new URL(ref, `https://package.invalid/maputnik/${from}`).pathname;
    assert.ok(target.startsWith("/maputnik/"), target);
    assert.ok(files.includes(target.slice("/maputnik/".length)), `${from}: ${ref}`);
  }
});

test("repeat export preserves unrelated files and still never creates public HTML", async () => {
  const options = { htmlFile: join(temporary, "repeat/private.html"), publicDir: join(temporary, "repeat/public") };
  await exportResources(options);
  await writeFile(join(options.publicDir, "keep.txt"), "unrelated");
  await exportResources(options);
  assert.equal(await readFile(join(options.publicDir, "keep.txt"), "utf8"), "unrelated");
  assert.ok(!(await filesIn(options.publicDir)).some(isHtml));
});

test("HTML destinations inside publicDir are rejected before writing", async () => {
  const publicDir = join(temporary, "invalid/public");
  await assert.rejects(exportResources({ htmlFile: join(publicDir, "index.html"), publicDir }), /outside publicDir/);
  await assert.rejects(stat(publicDir), { code: "ENOENT" });
});

test("physical overlap through a junction or symlink is also rejected", async () => {
  const publicDir = join(temporary, "alias/public");
  await mkdir(publicDir, { recursive: true });
  const alias = join(temporary, "alias/link");
  await symlink(publicDir, alias, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(exportResources({ htmlFile: join(alias, "index.html"), publicDir }), /outside publicDir/);
  assert.deepEqual(await readdir(publicDir), []);
});

test("pre-existing public HTML is rejected without deleting or replacing it", async () => {
  const publicDir = join(temporary, "existing/public");
  await mkdir(publicDir, { recursive: true });
  await writeFile(join(publicDir, "index.html"), "existing content");
  await assert.rejects(exportResources({ htmlFile: join(temporary, "existing/private.html"), publicDir }), /already contains HTML/);
  assert.equal(await readFile(join(publicDir, "index.html"), "utf8"), "existing content");
});

for (const [index, name] of compressedHtmlNames.entries()) {
  test(`pre-existing compressed HTML ${name} is rejected before output writes`, async () => {
    const directory = join(temporary, `compressed-existing-${index}`);
    const publicDir = join(directory, "public");
    const htmlFile = join(directory, "private/index.html");
    const compressedFile = join(publicDir, name);
    await mkdir(dirname(compressedFile), { recursive: true });
    await writeFile(compressedFile, compressedHtml(name));
    await writeFile(join(publicDir, "LICENSE"), "Preserve existing files");
    const before = await contentsIn(publicDir);
    await assert.rejects(exportResources({ htmlFile, publicDir }), /already contains HTML/);
    assert.deepEqual(await contentsIn(publicDir), before);
    await assert.rejects(stat(dirname(htmlFile)), { code: "ENOENT" });
  });

  test(`packaged compressed HTML ${name} is rejected before publication`, async () => {
    const directory = join(temporary, `compressed-package-${index}`);
    const copiedPackage = join(directory, "package");
    await cp(installed, copiedPackage, { recursive: true });
    const compressedFile = join(copiedPackage, "dist", name);
    await mkdir(dirname(compressedFile), { recursive: true });
    await writeFile(compressedFile, compressedHtml(name));
    const { exportResources: exportCopiedResources } = await import(pathToFileURL(join(copiedPackage, "package/resources.js")));
    const publicDir = join(directory, "public");
    const htmlFile = join(directory, "private/index.html");
    await mkdir(publicDir);
    await writeFile(join(publicDir, "LICENSE"), "Preserve existing files");
    const before = await contentsIn(publicDir);
    await assert.rejects(exportCopiedResources({ htmlFile, publicDir }), /Unexpected HTML/);
    assert.deepEqual(await contentsIn(publicDir), before);
    await assert.rejects(stat(dirname(htmlFile)), { code: "ENOENT" });
  });

  test(`archive contents check rejects compressed HTML ${name}`, () => {
    const files = metadata.files.map(file => file.path);
    assert.throws(() => assertPrivateHtml([...files, `dist/${name}`]), { code: "ERR_ASSERTION" });
  });
}

test("the installed package cannot be used as an output directory", async () => {
  await assert.rejects(exportResources({ htmlFile: join(temporary, "source/private.html"), publicDir: join(installed, "dist") }), /installed package/);
});

test("release metadata requires the exact fork packaging tag", async () => {
  const script = join(repository, "build/package-release.js");
  for (const tag of [`npm-v${manifest.version}`, "v3.1.0", "npm-v3.1.0-fork.999"]) {
    const output = join(temporary, `release-${tag}.txt`);
    const result = spawnSync(process.execPath, [script], { cwd: repository, encoding: "utf8", env: { ...process.env, GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: tag, GITHUB_OUTPUT: output } });
    assert.equal(result.status, tag === `npm-v${manifest.version}` ? 0 : 1, result.stderr);
    if (result.status === 0) assert.match(await readFile(output, "utf8"), new RegExp(`filename=${metadata.filename.replaceAll(".", "\\.")}`));
  }
});
