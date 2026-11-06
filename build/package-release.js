import { appendFileSync, readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
if (!/^\d+\.\d+\.\d+-fork\.(0|[1-9]\d*)$/.test(version)) {
  throw new Error("Package releases require a version such as 3.1.0-fork.1");
}
if (process.env.GITHUB_REF_TYPE !== "tag" || process.env.GITHUB_REF_NAME !== `npm-v${version}`) {
  throw new Error(`Package release tag must be npm-v${version}`);
}
const metadata = { version, filename: `maputnik-${version}.tgz` };
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(metadata).map(([key, value]) => `${key}=${value}\n`).join(""));
}
console.log(JSON.stringify(metadata));
