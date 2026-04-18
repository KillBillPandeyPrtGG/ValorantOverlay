const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const disallowedApiKeyPattern = /HDEV-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

const ignoredDirs = new Set([
  ".git",
  ".vs",
  "node_modules",
  "coverage",
  "overlay/cache",
  "tests"
]);

const textExtensions = new Set([
  ".js",
  ".json",
  ".md",
  ".html",
  ".css",
  ".yml",
  ".yaml",
  ".txt"
]);

function shouldSkipDir(relativePath) {
  if (!relativePath) return false;
  const normalized = relativePath.replace(/\\/g, "/");
  return [...ignoredDirs].some((dir) => normalized === dir || normalized.startsWith(`${dir}/`));
}

function collectTextFiles(dir, relativePath = "") {
  if (shouldSkipDir(relativePath)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const childRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const childPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTextFiles(childPath, childRelative));
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (textExtensions.has(ext)) {
      files.push({ relative: childRelative, absolute: childPath });
    }
  }

  return files;
}

test("config.json does not contain a committed API key", () => {
  const configPath = path.join(repoRoot, "config.json");
  if (!fs.existsSync(configPath)) {
    return;
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
  assert.equal(apiKey, "", "config.json apiKey must be empty before push");
});

test("repository does not include real HenrikDev API keys", () => {
  const files = collectTextFiles(repoRoot);
  const leaks = [];

  for (const file of files) {
    const content = fs.readFileSync(file.absolute, "utf8");
    if (disallowedApiKeyPattern.test(content)) {
      leaks.push(file.relative);
    }
  }

  assert.deepEqual(leaks, [], `Remove API keys before push. Found in: ${leaks.join(", ")}`);
});
