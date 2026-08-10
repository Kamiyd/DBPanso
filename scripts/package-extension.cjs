const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8")
);
const version = manifest.version;
const packageName = `DBPanso-v${version}`;
const distDir = path.join(root, "dist");
const packageDir = path.join(distDir, packageName);
const archiveName = `${packageName}-chrome.zip`;
const archivePath = path.join(distDir, archiveName);

const rootFiles = [
  "LICENSE",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "background.js",
  "manifest.json",
];

const runtimeDirs = [
  "content",
  "lib",
  "options",
  "popup",
  "sidepanel",
  "styles",
  "vendor/cuelume",
];

const iconFiles = [
  "icons/icon-laser-v5-16.png",
  "icons/icon-laser-v5-32.png",
  "icons/icon-laser-v5-48.png",
  "icons/icon-laser-v5-128.png",
];

function copy(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(packageDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

fs.mkdirSync(distDir, { recursive: true });
fs.rmSync(packageDir, { recursive: true, force: true });
fs.rmSync(archivePath, { force: true });
fs.mkdirSync(packageDir, { recursive: true });

rootFiles.forEach(copy);
runtimeDirs.forEach(copy);
iconFiles.forEach(copy);
copy("icons/pan");

const forbiddenPatterns = [
  /127\.0\.0\.1:8787/,
  /dev-reload\.js/,
  /preview-chrome\.js/,
  /\.codex-audit/,
  /\/Users\//,
];

function inspectTextFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      inspectTextFiles(filePath);
      continue;
    }
    if (!/\.(?:css|html|js|json|md|txt)$/i.test(entry.name)) continue;
    const contents = fs.readFileSync(filePath, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(contents)) {
        throw new Error(
          `Production package contains forbidden content ${pattern} in ${path.relative(packageDir, filePath)}`
        );
      }
    }
  }
}

inspectTextFiles(packageDir);

const packagedManifest = JSON.parse(
  fs.readFileSync(path.join(packageDir, "manifest.json"), "utf8")
);
if (packagedManifest.version !== version) {
  throw new Error("Packaged manifest version does not match source manifest");
}

const requiredPaths = [
  packagedManifest.background?.service_worker,
  packagedManifest.action?.default_popup,
  packagedManifest.side_panel?.default_path,
  packagedManifest.options_ui?.page,
  ...Object.values(packagedManifest.icons || {}),
].filter(Boolean);

for (const requiredPath of requiredPaths) {
  if (!fs.existsSync(path.join(packageDir, requiredPath))) {
    throw new Error(`Missing packaged runtime file: ${requiredPath}`);
  }
}

const zip = spawnSync("zip", ["-qr", archiveName, packageName], {
  cwd: distDir,
  encoding: "utf8",
});
if (zip.status !== 0) {
  throw new Error(zip.stderr || zip.stdout || "zip command failed");
}

const size = fs.statSync(archivePath).size;
console.log(`Created ${path.relative(root, archivePath)} (${size} bytes)`);
console.log(`Unpacked extension: ${path.relative(root, packageDir)}`);
