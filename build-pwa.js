'use strict';
/**
 * Tralci di note PWA - Script di compilazione e pubblicazione
 * Progetto 100% autonomo: copia i sorgenti da /src a /docs (servita da GitHub Pages).
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs');

if (!fs.existsSync(SRC)) {
  console.error('Cartella src non trovata!');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC);
for (const f of files) {
  fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
}

// Assicura file .nojekyll per GitHub Pages
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log('✅ PWA generata con successo in /docs (' + files.length + ' file)');
fs.readdirSync(OUT).forEach(f => console.log(' -', f));
