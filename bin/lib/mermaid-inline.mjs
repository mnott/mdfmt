#!/usr/bin/env bun
// mermaid-inline.mjs — Pre-render ```mermaid fenced blocks into inline <svg>.
//
//   bun  bin/lib/mermaid-inline.mjs <input.md> <output.md>
//   node bin/lib/mermaid-inline.mjs <input.md> <output.md>
//
// Downstream renderers (md-to-pdf → marked → Puppeteer) do NOT run Mermaid,
// so ```mermaid blocks otherwise print as raw code. This pass renders each
// block to a standalone <svg> using the same headless Chrome md-to-pdf uses,
// and rewrites the Markdown with the SVG inlined — deterministic, no async
// race at print time, identical result for PDF and HTML.
//
// Behaviour is fail-open: on any problem (no puppeteer, offline first run,
// bad diagram syntax) it leaves the affected block — or the whole file —
// untouched so the pipeline still produces output.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const MERMAID_VERSION = '11';
const MERMAID_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;

// Matches a whole fenced ```mermaid … ``` block, including any indentation.
const FENCE = /^[ \t]*```mermaid[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*$/gm;

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('usage: mermaid-inline.mjs <input.md> <output.md>');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url)); // …/bin/lib
const rootDir = join(scriptDir, '..', '..'); // repo root
const vendorDir = join(rootDir, 'vendor');
const mermaidPath = join(vendorDir, 'mermaid.min.js');

const passthrough = (reason) => {
  if (reason) console.error(`mermaid-inline: ${reason} — leaving diagrams as-is`);
  writeFileSync(outPath, readFileSync(inPath));
  process.exit(0);
};

// Locate a Chrome/Chromium already downloaded by Puppeteer (the same one
// md-to-pdf uses) so we don't pull a second browser. Returns null if none.
const findChrome = () => {
  const roots = [
    process.env.PUPPETEER_CACHE_DIR,
    join(homedir(), '.cache', 'puppeteer'),
    join(homedir(), 'Library', 'Caches', 'Puppeteer'),
  ].filter(Boolean);
  const newest = (dir) => {
    try {
      return readdirSync(dir).sort().reverse(); // version dirs, newest first
    } catch {
      return [];
    }
  };
  for (const root of roots) {
    for (const [flavour, tail] of [
      ['chrome-headless-shell', 'chrome-headless-shell'],
      ['chrome', 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'],
    ]) {
      for (const build of newest(join(root, flavour))) {
        const buildDir = join(root, flavour, build);
        for (const inner of newest(buildDir)) {
          const bin = join(buildDir, inner, tail);
          if (existsSync(bin)) return bin;
        }
      }
    }
  }
  return null;
};

const src = readFileSync(inPath, 'utf8');

// Collect blocks first; if there are none there is nothing to do.
const blocks = [];
for (let m; (m = FENCE.exec(src)) !== null; ) {
  blocks.push({ code: m[1], start: m.index, end: m.index + m[0].length });
}
if (blocks.length === 0) passthrough();

// Lazily vendor the Mermaid runtime so subsequent runs work offline.
if (!existsSync(mermaidPath)) {
  try {
    mkdirSync(vendorDir, { recursive: true });
    const res = await fetch(MERMAID_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(mermaidPath, Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    passthrough(`could not fetch mermaid runtime (${e.message})`);
  }
}

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  passthrough('puppeteer-core not installed (run: bun install)');
}

const executablePath = findChrome();
if (!executablePath) passthrough('no cached Chrome found (run md2pdf once to let md-to-pdf fetch it)');

let browser;
try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ path: mermaidPath });
  await page.evaluate(() => {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose', // honour click/href directives → clickable links
      theme: 'default',
    });
  });

  // Render every block; a failing block returns null and is left untouched.
  const svgs = [];
  for (let i = 0; i < blocks.length; i++) {
    const svg = await page.evaluate(async (code, id) => {
      try {
        const { svg } = await window.mermaid.render(id, code);
        return svg;
      } catch (e) {
        return null;
      }
    }, blocks[i].code, `mmd-${i}`);
    if (svg == null) console.error(`mermaid-inline: block #${i + 1} failed to render — left as code`);
    svgs.push(svg);
  }

  // Stitch the output, replacing rendered blocks with inline SVG figures.
  let out = '';
  let last = 0;
  for (let i = 0; i < blocks.length; i++) {
    out += src.slice(last, blocks[i].start);
    out += svgs[i] == null
      ? src.slice(blocks[i].start, blocks[i].end)
      : `<div class="mermaid-figure">\n${svgs[i]}\n</div>`;
    last = blocks[i].end;
  }
  out += src.slice(last);

  writeFileSync(outPath, out);
} catch (e) {
  passthrough(e.message);
} finally {
  if (browser) await browser.close();
}
