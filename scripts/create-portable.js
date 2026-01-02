#!/usr/bin/env node

/**
 * Creates a portable distribution of dsftp
 * Copies only the necessary files for running the CLI
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const portableDir = path.join(rootDir, 'portable');

// Clean and create portable directory
if (fs.existsSync(portableDir)) {
  fs.rmSync(portableDir, { recursive: true });
}
fs.mkdirSync(portableDir, { recursive: true });

// Copy dist folder
const distSrc = path.join(rootDir, 'dist');
const distDest = path.join(portableDir, 'dist');
copyDir(distSrc, distDest);

// Copy GUI dist if exists
const guiDistSrc = path.join(rootDir, 'gui', 'dist');
if (fs.existsSync(guiDistSrc)) {
  const guiDistDest = path.join(portableDir, 'gui-dist');
  copyDir(guiDistSrc, guiDistDest);
}

// Create minimal package.json
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const minimalPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: pkg.main,
  type: pkg.type,
  bin: pkg.bin,
  dependencies: pkg.dependencies
};
fs.writeFileSync(
  path.join(portableDir, 'package.json'),
  JSON.stringify(minimalPkg, null, 2)
);

// Create empty config file
fs.writeFileSync(
  path.join(portableDir, 'sftp-config.json'),
  JSON.stringify({ servers: [] }, null, 2)
);

// Create start scripts
const winScript = `@echo off
cd /d "%~dp0"
node dist/cli/index.js %*
`;

const unixScript = `#!/bin/bash
cd "$(dirname "$0")"
node dist/cli/index.js "$@"
`;

fs.writeFileSync(path.join(portableDir, 'dsftp.cmd'), winScript);
fs.writeFileSync(path.join(portableDir, 'dsftp.sh'), unixScript);

// Create README
const readme = `# DSFTP - Portable Distribution

## Quick Start

### Windows
1. Install dependencies: \`npm install --omit=dev\`
2. Run: \`dsftp.cmd\` or \`node dist/cli/index.js\`

### macOS/Linux
1. Install dependencies: \`npm install --omit=dev\`
2. Make script executable: \`chmod +x dsftp.sh\`
3. Run: \`./dsftp.sh\` or \`node dist/cli/index.js\`

## Requirements
- Node.js 18+
- Docker

## Commands
- \`dsftp create -n <name> -p <path>\` - Create SFTP server
- \`dsftp list\` - List all servers
- \`dsftp start <name>\` - Start a server
- \`dsftp stop <name>\` - Stop a server
- \`dsftp --tui\` - Interactive TUI mode
`;

fs.writeFileSync(path.join(portableDir, 'README.md'), readme);

// Install production dependencies
console.log('Installing production dependencies...');
execSync('npm install --omit=dev', { cwd: portableDir, stdio: 'inherit' });

console.log(`\nPortable distribution created at: ${portableDir}`);
console.log('Files:');
listDir(portableDir, '');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function listDir(dir, prefix) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      console.log(`${prefix}${entry.name}/ (dependencies)`);
    } else if (entry.isDirectory()) {
      console.log(`${prefix}${entry.name}/`);
      listDir(path.join(dir, entry.name), prefix + '  ');
    } else {
      console.log(`${prefix}${entry.name}`);
    }
  }
}
