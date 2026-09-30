const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const flags = new Set(process.argv.slice(2));
const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const outDir = path.join(root, "build");
const vsixName = `${pkg.name}-${pkg.version}.vsix`;
const vsixPath = path.join(outDir, vsixName);

fs.mkdirSync(outDir, { recursive: true });

// Remove stale packages so build/ only keeps the latest vsix.
for (const file of fs.readdirSync(outDir)) {
  if (file.endsWith(".vsix")) {
    fs.unlinkSync(path.join(outDir, file));
    console.log(`Removed old package: ${file}`);
  }
}

console.log("Compiling TypeScript ...");
execSync("npm run compile", { cwd: root, stdio: "inherit" });

console.log(`Packaging ${vsixName} ...`);
execSync(`npx @vscode/vsce package -o "${vsixPath}"`, { cwd: root, stdio: "inherit" });

if (flags.has("--publish")) {
  console.log("Publishing ...");
  // --packagePath uploads the freshly built vsix as-is:
  // no second packaging pass, vscode:prepublish does not re-run.
  execSync(`npx @vscode/vsce publish --packagePath "${vsixPath}"`, { cwd: root, stdio: "inherit" });
}

if (flags.has("--install")) {
  console.log(`Installing ${vsixName} ...`);
  execSync(`code --install-extension "${vsixPath}" --force`, { cwd: root, stdio: "inherit" });
}
