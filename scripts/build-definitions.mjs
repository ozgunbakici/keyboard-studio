#!/usr/bin/env node
// Builds the VIA keyboard definition bundle served with the app.
//
// Reads the-via/keyboards (GPL-3.0) and writes compiled definitions to
// public/definitions/{v2,v3}/<vendorProductId>.json plus an index.json.
// Usage: node scripts/build-definitions.mjs [path-to-the-via-keyboards]

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import reader from '@the-via/reader';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.resolve(process.argv[2] ?? process.env.VIA_KEYBOARDS_DIR ?? path.join(root, '.cache/via-keyboards'));
const outDir = path.join(root, 'public/definitions');

const ensureSource = () => {
  if (fs.existsSync(path.join(sourceDir, 'v3'))) return;
  console.log(`Cloning the-via/keyboards into ${sourceDir} ...`);
  fs.mkdirSync(path.dirname(sourceDir), {recursive: true});
  execFileSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', 'https://github.com/the-via/keyboards', sourceDir], {
    stdio: 'inherit',
  });
  execFileSync('git', ['-C', sourceDir, 'sparse-checkout', 'set', 'v3', 'src'], {stdio: 'inherit'});
};

const jsonFiles = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, {recursive: true})
        .filter((file) => String(file).endsWith('.json'))
        .map((file) => path.join(dir, String(file)))
        .sort()
    : [];

const nameOf = (definition) => (typeof definition.name === 'string' ? definition.name : definition.name.options[0]);

const build = (version, folder, convert) => {
  const target = path.join(outDir, version);
  fs.mkdirSync(target, {recursive: true});
  const built = new Map();
  let failed = 0;
  for (const file of jsonFiles(path.join(sourceDir, folder))) {
    try {
      const definition = convert(JSON.parse(fs.readFileSync(file, 'utf8')));
      const id = definition.vendorProductId;
      if (built.has(id)) {
        // VIA rejects duplicate ids too; keep the first one.
        continue;
      }
      fs.writeFileSync(path.join(target, `${id}.json`), JSON.stringify(definition));
      built.set(id, nameOf(definition));
    } catch {
      failed++;
    }
  }
  console.log(`${version}: ${built.size} tanım derlendi${failed ? `, ${failed} geçersiz dosya atlandı` : ''}`);
  return built;
};

ensureSource();
fs.rmSync(outDir, {recursive: true, force: true});
const v3 = build('v3', 'v3', reader.keyboardDefinitionV3ToVIADefinitionV3);
const v2 = build('v2', 'src', reader.keyboardDefinitionV2ToVIADefinitionV2);

const ids = [...new Set([...v3.keys(), ...v2.keys()])].sort((a, b) => a - b);
const keyboards = ids.map((id) => ({
  vendorProductId: id,
  name: v3.get(id) ?? v2.get(id),
  versions: [...(v3.has(id) ? ['v3'] : []), ...(v2.has(id) ? ['v2'] : [])],
}));

let commit = null;
try {
  commit = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
} catch {
  // Not a git checkout.
}

fs.writeFileSync(
  path.join(outDir, 'index.json'),
  JSON.stringify({generatedAt: new Date().toISOString(), source: 'https://github.com/the-via/keyboards', commit, keyboards}),
);
console.log(`index.json: ${keyboards.length} klavye`);
