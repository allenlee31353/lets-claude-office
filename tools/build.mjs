// Build web/index.html from src/: one self-contained HTML file.
// Usage: node tools/build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const parts = readdirSync(src).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const js = parts.map(f => `// ---- ${f} ----\n` + readFileSync(join(src, f), 'utf8')).join('\n');
const html = readFileSync(join(src, 'template.html'), 'utf8').replace('/*__APP__*/', () => js);
writeFileSync(join(root, 'web', 'index.html'), html);
console.log(`web/index.html  ${(html.length / 1024).toFixed(1)} KB  (${parts.join(', ')})`);
