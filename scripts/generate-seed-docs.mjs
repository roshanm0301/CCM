#!/usr/bin/env node
/**
 * generate-seed-docs.mjs
 *
 * Converts docs/seeded-data-reference.md into a standalone, interactive HTML
 * reference page and writes it to apps/web/public/seeded-data-reference.html.
 *
 * The HTML file is served as a static asset by both Vite (dev) and Nginx
 * (production) and is accessible from the CCM top bar.
 *
 * Usage:
 *   node scripts/generate-seed-docs.mjs          — one-shot generation
 *   node scripts/generate-seed-docs.mjs --watch  — watch mode (auto-regenerate)
 *
 * Watch triggers on changes to:
 *   - docs/seeded-data-reference.md              (primary source of truth)
 *   - ops/migrations/011_seed_reference_values.sql
 *   - ops/seeds/dev/seed_test_users_dev_only.sql
 *   - ops/seeds/dev/seed_activity_flow_users_dev_only.sql
 *   - apps/api/src/modules/integration/MockInstallBaseAdapter.ts
 *   - apps/api/src/modules/integration/MockCustomerMasterAdapter.ts
 *   - apps/api/src/modules/integration/MockContextAdapter.ts
 */

import { readFileSync, writeFileSync, watch, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dir     = dirname(__filename);
const ROOT      = resolve(__dir, '..');

const SOURCE = resolve(ROOT, 'docs/seeded-data-reference.md');
const OUTPUT = resolve(ROOT, 'apps/web/public/seeded-data-reference.html');

/** Files that, when changed, trigger regeneration in watch mode. */
const WATCHED_SOURCES = [
  'docs/seeded-data-reference.md',
  'ops/migrations/011_seed_reference_values.sql',
  'ops/seeds/dev/seed_test_users_dev_only.sql',
  'ops/seeds/dev/seed_activity_flow_users_dev_only.sql',
  'apps/api/src/modules/integration/MockInstallBaseAdapter.ts',
  'apps/api/src/modules/integration/MockCustomerMasterAdapter.ts',
  'apps/api/src/modules/integration/MockContextAdapter.ts',
].map(p => resolve(ROOT, p));


// ─── Utilities ───────────────────────────────────────────────────────────────

/** Escape HTML special characters to prevent XSS in rendered content. */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Produce a URL-safe anchor ID from a heading string. */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .trim();
}

/**
 * Render inline markdown: bold, italic, inline-code, links.
 * Input text is HTML-escaped FIRST so all replacements insert safe markup.
 */
function renderInline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}


// ─── Table Parser ─────────────────────────────────────────────────────────────

/** Parse an array of pipe-delimited markdown table lines into an HTML table. */
function renderTable(tableLines) {
  const rows = [];
  for (const line of tableLines) {
    if (!line.trim() || /^\|[-|: ]+\|$/.test(line.trim())) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    rows.push(cells);
  }
  if (rows.length === 0) return '';

  const [header, ...body] = rows;
  const tableId = `tbl-${Math.random().toString(36).slice(2, 9)}`;
  const rowCount = body.length;

  const headerHtml = header
    .map(h => `<th>${renderInline(h)}</th>`)
    .join('');

  const bodyHtml = body.map(row => {
    const cells = row.map((cell, colIdx) => {
      const col = (header[colIdx] ?? '').toLowerCase();
      const isCredential = col === 'password' || col === 'username';
      const isId = col.includes('user id') || col === 'customer ref' || col === 'vehicle ref' || col === 'dealer ref' || col.includes('ref');
      const labelAttr = `data-label="${esc(header[colIdx] ?? '')}"`;

      if ((isCredential || isId) && cell && cell !== '*(none)*') {
        return `<td ${labelAttr}><span class="copy-cell"><code>${esc(cell)}</code><button class="copy-btn" data-copy="${esc(cell)}" title="Copy" aria-label="Copy ${esc(cell)}">⎘</button></span></td>`;
      }
      return `<td ${labelAttr}>${renderInline(cell)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('\n          ');

  return `
  <div class="table-wrap">
    <div class="table-toolbar">
      <input type="search" class="table-filter" data-table="${tableId}"
             placeholder="Filter this table…" aria-label="Filter table rows" />
      <span class="row-count" data-table="${tableId}">${rowCount} row${rowCount !== 1 ? 's' : ''}</span>
    </div>
    <div class="table-scroll">
      <table id="${tableId}" class="data-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>
          ${bodyHtml}
        </tbody>
      </table>
      <p class="no-results" aria-live="polite" style="display:none">No matching entries.</p>
    </div>
  </div>`;
}


// ─── Block Renderer ───────────────────────────────────────────────────────────

/**
 * Convert an array of markdown lines to HTML.
 * Handles: h2, h3, code-blocks, blockquotes, tables, ordered/unordered lists,
 * horizontal rules, and paragraphs.
 */
function renderBlocks(lines) {
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Empty line ────────────────────────────────────────────────
    if (line.trim() === '') { i++; continue; }

    // ── Headings (H2 – H6) ───────────────────────────────────────
    if (line.startsWith('#')) {
      let depth = 0;
      while (depth < line.length && line[depth] === '#') depth++;
      if (depth >= 2 && line[depth] === ' ') {
        const text  = line.slice(depth + 1).trim();
        const id    = slugify(text);
        const level = Math.min(depth, 6);
        const tag   = `h${level}`;
        html += (level === 2 ? '\n' : '') + `<${tag} id="${id}">${renderInline(text)}</${tag}>\n`;
        i++; continue;
      }
    }

    // ── Horizontal rule ───────────────────────────────────────────
    if (/^---+$/.test(line.trim())) {
      html += '<hr />\n';
      i++; continue;
    }

    // ── Fenced code block ─────────────────────────────────────────
    if (line.startsWith('```')) {
      const lang = esc(line.slice(3).trim() || 'text');
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      html += `<pre class="code-block" data-lang="${lang}"><code>${esc(codeLines.join('\n'))}</code></pre>\n`;
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────
    if (line.startsWith('>')) {
      const bqLines = [];
      while (i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === '')) {
        if (lines[i].startsWith('>')) bqLines.push(lines[i].slice(1).trim());
        i++;
      }
      const inner = bqLines
        .filter(l => l !== '')
        .map(l => `<p>${renderInline(l)}</p>`)
        .join('');
      html += `<blockquote class="info-box">${inner}</blockquote>\n`;
      continue;
    }

    // ── Table ─────────────────────────────────────────────────────
    if (line.startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      html += renderTable(tableLines) + '\n';
      continue;
    }

    // ── Unordered list ────────────────────────────────────────────
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && (/^[-*] /.test(lines[i]) || /^ {2,}/.test(lines[i]))) {
        if (/^[-*] /.test(lines[i])) items.push(lines[i].replace(/^[-*] /, ''));
        i++;
      }
      html += `<ul class="doc-list">${items.map(it => `<li>${renderInline(it)}</li>`).join('')}</ul>\n`;
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      html += `<ol class="doc-list">${items.map(it => `<li>${renderInline(it)}</li>`).join('')}</ol>\n`;
      continue;
    }

    // ── Paragraph ────────────────────────────────────────────────
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('|') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('```') &&
      !/^[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      html += `<p>${renderInline(paraLines.join(' '))}</p>\n`;
    }
  }

  return html;
}


// ─── TOC Extractor ────────────────────────────────────────────────────────────

/** Extract all heading levels 2–4 for the sidebar TOC. */
function extractToc(lines) {
  const entries = [];
  for (const line of lines) {
    const m = line.match(/^(#{2,4}) (.+)/);
    if (m) {
      const level = m[1].length;
      const text  = m[2].trim();
      entries.push({ level, text, id: slugify(text) });
    }
  }
  return entries;
}


// ─── HTML Shell ───────────────────────────────────────────────────────────────

function buildHtml({ bodyHtml, tocEntries, generatedAt, relWatched }) {
  const tocHtml = tocEntries.map(({ level, text, id }) => {
    const levelCls = level === 2 ? 'toc-l2' : level === 3 ? 'toc-l3' : 'toc-l4';
    return `<a href="#${id}" class="toc-link ${levelCls}">${esc(text)}</a>`;
  }).join('\n      ');

  const watchedDisplay = relWatched.map(p => p.replace(/\\/g, '/')).join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seeded &amp; Mock Data Reference — CCM</title>
  <style>
    /* ── Reset ─────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      font-size: 14px;
      line-height: 1.65;
      color: #1a1a2e;
      background: #f0f2f5;
    }
    a { color: #1565c0; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      font-family: 'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace;
      font-size: 0.875em;
      background: #e8eaf6;
      color: #283593;
      border-radius: 3px;
      padding: 1px 5px;
    }

    /* ── App Header ─────────────────────────────────────────────── */
    .app-header {
      position: sticky;
      top: 0;
      z-index: 200;
      background: #1b1d21;
      color: #fff;
      height: 56px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    }
    .logo-mark {
      width: 28px; height: 28px;
      background: #eb6a2c;
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; color: #fff;
      flex-shrink: 0; user-select: none;
    }
    .header-app-name {
      font-size: 0.9rem; font-weight: 700; color: #fff; white-space: nowrap;
    }
    .header-sep { color: rgba(255,255,255,0.3); font-size: 1.1rem; user-select: none; }
    .header-doc-name {
      font-size: 0.82rem; color: rgba(255,255,255,0.6); white-space: nowrap;
    }
    .header-spacer { flex: 1; }
    .search-global {
      height: 32px;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 20px;
      background: rgba(255,255,255,0.07);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='rgba(255,255,255,0.45)'%3E%3Cpath d='M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: 9px center;
      color: #fff;
      font-size: 0.82rem;
      padding: 0 12px 0 32px;
      outline: none;
      width: 220px;
      transition: border-color 0.2s, background-color 0.2s;
    }
    .search-global::placeholder { color: rgba(255,255,255,0.35); }
    .search-global:focus { border-color: #eb6a2c; background-color: rgba(255,255,255,0.11); }
    .meta-pill {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.55);
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 4px;
      padding: 3px 9px;
      white-space: nowrap;
    }
    .meta-pill strong { color: rgba(255,255,255,0.8); font-weight: 600; }
    .print-btn {
      height: 30px;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 4px;
      background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.7);
      font-size: 0.77rem;
      padding: 0 10px;
      cursor: pointer;
      display: flex; align-items: center; gap: 5px;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .print-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }

    /* ── Layout ─────────────────────────────────────────────────── */
    .layout {
      display: flex;
      min-height: calc(100vh - 56px);
      max-width: 1400px;
      margin: 0 auto;
    }

    /* ── Sidebar ────────────────────────────────────────────────── */
    .sidebar {
      width: 256px;
      flex-shrink: 0;
      position: sticky;
      top: 56px;
      height: calc(100vh - 56px);
      overflow-y: auto;
      background: #fff;
      border-right: 1px solid #e2e5ea;
      padding: 14px 0 24px;
      scrollbar-width: thin;
      scrollbar-color: #ddd transparent;
    }
    .sidebar::-webkit-scrollbar { width: 4px; }
    .sidebar::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
    .sidebar-label {
      font-size: 0.66rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: #aaa;
      padding: 0 16px 6px;
    }
    .toc-link {
      display: block;
      padding: 5px 14px;
      font-size: 0.81rem;
      color: #555;
      border-left: 2px solid transparent;
      line-height: 1.4;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
    }
    .toc-link:hover { background: #f5f7ff; color: #1565c0; text-decoration: none; }
    .toc-link.active {
      color: #1565c0;
      border-left-color: #1565c0;
      background: #e8f0fe;
      font-weight: 600;
    }
    .toc-l3 {
      padding-left: 26px;
      font-size: 0.77rem;
      color: #777;
    }
    .toc-l3.active { color: #1565c0; }
    .toc-l4 {
      padding-left: 38px;
      font-size: 0.73rem;
      color: #999;
    }
    .toc-l4.active { color: #1565c0; }

    /* ── Main Content ───────────────────────────────────────────── */
    .content {
      flex: 1;
      min-width: 0;
      padding: 28px 40px 48px;
    }

    /* ── Section Title (h2) ─────────────────────────────────────── */
    h2 {
      font-size: 1.35rem;
      font-weight: 700;
      color: #1b1d21;
      margin: 36px 0 4px;
      padding: 14px 0 10px;
      border-bottom: 2px solid #e2e5ea;
      scroll-margin-top: 68px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h2:first-child { margin-top: 0; }
    .section-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px; height: 26px;
      background: #1b1d21;
      color: #fff;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    /* ── Subsection Title (h3, h4) ─────────────────────────────── */
    h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #37474f;
      margin: 20px 0 6px;
      scroll-margin-top: 68px;
    }
    h4 {
      font-size: 0.9rem;
      font-weight: 600;
      color: #546e7a;
      margin: 14px 0 4px;
      scroll-margin-top: 68px;
    }

    /* ── Body text ──────────────────────────────────────────────── */
    p { margin-bottom: 10px; color: #455a64; }
    strong { color: #263238; }
    em { color: #546e7a; }
    hr { border: none; border-top: 1px solid #e8ecef; margin: 22px 0; }

    /* ── Lists ──────────────────────────────────────────────────── */
    ul.doc-list, ol.doc-list {
      margin: 8px 0 14px 22px;
      color: #455a64;
    }
    ul.doc-list li, ol.doc-list li { margin-bottom: 5px; }

    /* ── Info Box (blockquote) ──────────────────────────────────── */
    blockquote.info-box {
      background: #e8f0fe;
      border-left: 4px solid #1565c0;
      border-radius: 0 6px 6px 0;
      padding: 10px 16px;
      margin: 10px 0 14px;
      font-size: 0.84rem;
    }
    blockquote.info-box p {
      margin-bottom: 4px;
      color: #1a237e;
    }
    blockquote.info-box p:last-child { margin-bottom: 0; }
    blockquote.info-box strong { color: #0d47a1; }
    blockquote.info-box code { background: #c5cae9; color: #1a237e; }

    /* ── Code Block ─────────────────────────────────────────────── */
    pre.code-block {
      position: relative;
      background: #1e2a35;
      color: #cdd9e5;
      border-radius: 8px;
      padding: 18px 20px;
      overflow-x: auto;
      margin: 12px 0 16px;
      font-size: 0.81rem;
      line-height: 1.55;
    }
    pre.code-block::before {
      content: attr(data-lang);
      position: absolute;
      top: 7px; right: 12px;
      font-size: 0.65rem;
      font-family: inherit;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    pre.code-block code {
      font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: inherit;
      background: none;
      color: inherit;
      padding: 0;
      border-radius: 0;
    }

    /* ── Table Wrapper ──────────────────────────────────────────── */
    .table-wrap { margin: 10px 0 20px; }
    .table-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 7px;
    }
    .table-filter {
      height: 30px;
      border: 1px solid #cdd3da;
      border-radius: 4px;
      font-size: 0.8rem;
      padding: 0 10px 0 28px;
      outline: none;
      width: 232px;
      color: #37474f;
      background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='%23aaa'%3E%3Cpath d='M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'/%3E%3C/svg%3E") no-repeat 8px center;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .table-filter:focus { border-color: #1565c0; box-shadow: 0 0 0 2px #bbdefb; }
    .row-count {
      font-size: 0.74rem;
      color: #aaa;
      white-space: nowrap;
    }
    .table-scroll {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid #e2e5ea;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }

    /* ── Data Table ─────────────────────────────────────────────── */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      font-size: 0.83rem;
    }
    table.data-table thead tr {
      background: #1b1d21;
      color: #fff;
    }
    table.data-table th {
      padding: 9px 14px;
      text-align: left;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
    table.data-table td {
      padding: 8px 14px;
      color: #455a64;
      border-bottom: 1px solid #f0f2f5;
      vertical-align: middle;
    }
    table.data-table tbody tr:hover { background: #f5f8ff; }
    table.data-table tbody tr:last-child td { border-bottom: none; }
    table.data-table tr.row-hidden { display: none; }
    table.data-table td em { color: #b0bec5; font-style: italic; font-size: 0.9em; }

    /* ── Copy Button ────────────────────────────────────────────── */
    .copy-cell {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .copy-btn {
      border: none;
      background: none;
      cursor: pointer;
      color: #b0bec5;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 0.85em;
      line-height: 1;
      transition: background 0.12s, color 0.12s;
    }
    .copy-btn:hover { background: #e3f2fd; color: #1565c0; }
    .copy-btn.copied { background: #e8f5e9; color: #2e7d32; }

    /* ── No-results message ─────────────────────────────────────── */
    .no-results {
      text-align: center;
      padding: 18px 20px;
      color: #aaa;
      font-size: 0.83rem;
      font-style: italic;
    }

    /* ── Footer ─────────────────────────────────────────────────── */
    .doc-footer {
      margin-top: 40px;
      padding: 20px 0 0;
      border-top: 1px solid #e2e5ea;
      font-size: 0.74rem;
      color: #aaa;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .doc-footer strong { color: #78909c; }
    .doc-footer code { font-size: 0.85em; background: #f0f2f5; color: #546e7a; }

    /* ── Responsive — tablet ────────────────────────────────────── */
    @media (max-width: 900px) {
      .sidebar { display: none; }
      .content { padding: 20px; }
      .search-global { width: 160px; }
      .meta-pill { display: none; }
    }

    /* ── Responsive — mobile ────────────────────────────────────── */
    @media (max-width: 600px) {
      .header-doc-name, .header-sep, .search-global, .print-btn { display: none; }
      .content { padding: 14px; }
      table.data-table thead { display: none; }
      table.data-table tbody tr {
        display: block;
        border-bottom: 1px solid #e2e5ea;
        padding: 8px 0;
      }
      table.data-table td {
        display: block;
        padding: 4px 14px;
        border: none;
      }
      table.data-table td::before {
        content: attr(data-label) ": ";
        font-weight: 700;
        font-size: 0.68rem;
        text-transform: uppercase;
        color: #90a4ae;
        letter-spacing: 0.04em;
      }
    }

    /* ── Print ──────────────────────────────────────────────────── */
    @media print {
      .app-header, .sidebar, .table-toolbar, .copy-btn, .print-btn { display: none !important; }
      .layout { display: block; }
      .content { padding: 0; }
      body { background: #fff; font-size: 11pt; }
      pre.code-block { background: #f5f5f5 !important; color: #333 !important; print-color-adjust: exact; }
      table.data-table thead tr { background: #333 !important; print-color-adjust: exact; }
      h2 { break-before: page; padding-top: 0; }
      h2:first-child { break-before: auto; }
      .table-scroll { border: 1px solid #ccc; overflow: visible; box-shadow: none; }
    }
  </style>
</head>
<body>

  <!-- ═══════════════════════════════════════════════════════════════
       APP HEADER
  ═══════════════════════════════════════════════════════════════ -->
  <header class="app-header" role="banner">
    <div class="logo-mark" aria-hidden="true">C</div>
    <span class="header-app-name">CCM</span>
    <span class="header-sep" aria-hidden="true">/</span>
    <span class="header-doc-name">Seeded &amp; Mock Data Reference</span>
    <div class="header-spacer"></div>
    <input
      id="globalSearch"
      type="search"
      class="search-global"
      placeholder="Search all data…"
      aria-label="Search all tables"
      autocomplete="off"
    />
    <div class="meta-pill">
      Generated <strong>${esc(generatedAt)}</strong>
    </div>
    <div class="meta-pill" title="Watched: ${esc(watchedDisplay)}">
      <strong>${WATCHED_SOURCES.length}</strong> files watched
    </div>
    <button class="print-btn" onclick="window.print()" aria-label="Print this page">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
      </svg>
      Print
    </button>
  </header>

  <!-- ═══════════════════════════════════════════════════════════════
       MAIN LAYOUT
  ═══════════════════════════════════════════════════════════════ -->
  <div class="layout">

    <!-- Sidebar / Table of Contents -->
    <nav class="sidebar" aria-label="Table of contents">
      <div class="sidebar-label">Contents</div>
      ${tocHtml}
    </nav>

    <!-- Main content -->
    <main class="content" id="main-content" tabindex="-1">
      ${bodyHtml}

      <footer class="doc-footer" role="contentinfo">
        <div>
          <strong>Primary source:</strong> <code>docs/seeded-data-reference.md</code>
          &nbsp;·&nbsp;
        <strong>Generated:</strong> ${esc(generatedAt)}
        </div>
        <div>
          <strong>Regenerate:</strong> <code>npm run docs:seeds</code>
          &nbsp;·&nbsp;
          <strong>Watch mode:</strong> <code>npm run docs:seeds:watch</code>
        </div>
        <div>
          <strong>Watched files:</strong>
          <code>${esc(watchedDisplay)}</code>
        </div>
      </footer>
    </main>

  </div><!-- /.layout -->


  <!-- ═══════════════════════════════════════════════════════════════
       INTERACTIVE BEHAVIOUR
  ═══════════════════════════════════════════════════════════════ -->
  <script>
    'use strict';

    // ── Copy-to-clipboard ──────────────────────────────────────────
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;
      const text = btn.dataset.copy;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.textContent = '✓';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.textContent = '⎘';
        }, 1600);
      }).catch(() => {
        // Fallback for non-HTTPS
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '⎘'; }, 1600);
      });
    });

    // ── Per-table filter ───────────────────────────────────────────
    function applyFilter(input) {
      const tableId = input.dataset.table;
      const table   = document.getElementById(tableId);
      if (!table) return;

      const q = input.value.trim().toLowerCase();
      const rows = table.querySelectorAll('tbody tr');
      let visible = 0;

      rows.forEach((row) => {
        const matches = !q || row.textContent.toLowerCase().includes(q);
        row.classList.toggle('row-hidden', !matches);
        if (matches) visible++;
      });

      // Update row count badge
      const badge = document.querySelector(\`.row-count[data-table="\${tableId}"]\`);
      if (badge) {
        badge.textContent = q
          ? \`\${visible} of \${rows.length} row\${rows.length !== 1 ? 's' : ''}\`
          : \`\${rows.length} row\${rows.length !== 1 ? 's' : ''}\`;
      }

      // Show/hide no-results message
      const noResults = table.closest('.table-scroll')
                             ?.querySelector('.no-results');
      if (noResults) {
        noResults.style.display = (visible === 0 && q) ? 'block' : 'none';
      }
    }

    // Attach per-table filter listeners
    document.querySelectorAll('.table-filter').forEach((input) => {
      input.addEventListener('input', () => applyFilter(input));
    });

    // ── Global search ──────────────────────────────────────────────
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
      globalSearch.addEventListener('input', () => {
        const q = globalSearch.value;
        // Push the query into every per-table filter and trigger them
        document.querySelectorAll('.table-filter').forEach((input) => {
          input.value = q;
          applyFilter(input);
        });
      });
    }

    // ── Keyboard shortcut: / focuses search ───────────────────────
    document.addEventListener('keydown', (e) => {
      if (
        e.key === '/' &&
        document.activeElement !== globalSearch &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        globalSearch?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === globalSearch) {
        globalSearch.value = '';
        globalSearch.dispatchEvent(new Event('input'));
        globalSearch.blur();
      }
    });

    // ── TOC scroll-spy ─────────────────────────────────────────────
    const tocLinks  = document.querySelectorAll('.toc-link');
    const headings  = [...document.querySelectorAll('h2[id], h3[id]')];

    if ('IntersectionObserver' in window) {
      const spy = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id   = entry.target.id;
          const href = '#' + id;
          tocLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === href);
          });
        });
      }, { rootMargin: '-56px 0px -72% 0px', threshold: 0 });

      headings.forEach((h) => spy.observe(h));
    }
  </script>
</body>
</html>`;
}


// ─── Main Generate Function ───────────────────────────────────────────────────

function generate() {
  const md    = readFileSync(SOURCE, 'utf8');
  const lines = md.split('\n');

  // ── Filter out H1 title and the "## Table of Contents" section ──
  let skipToc = false;
  const contentLines = lines.filter((line) => {
    if (line.startsWith('# '))                              return false;
    if (line.trim() === '## Table of Contents')            { skipToc = true; return false; }
    if (skipToc && line.startsWith('## '))                 { skipToc = false; }
    if (skipToc)                                           return false;
    return true;
  });

  const tocEntries = extractToc(contentLines);
  const bodyHtml   = renderBlocks(contentLines);

  const generatedAt = new Date().toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const relWatched = WATCHED_SOURCES.map(p => relative(ROOT, p));

  const html = buildHtml({ bodyHtml, tocEntries, generatedAt, relWatched });

  writeFileSync(OUTPUT, html, 'utf8');

  const relOut = relative(ROOT, OUTPUT).replace(/\\/g, '/');
  const ts     = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  process.stdout.write(`[seed-docs] OK ${relOut} - generated at ${ts}\n`);
}


// ─── Watch Mode ───────────────────────────────────────────────────────────────

function startWatch() {
    console.log('[seed-docs] Watch mode active. Watching:');
  WATCHED_SOURCES.forEach(p => console.log('  + ' + relative(ROOT, p).replace(/\\/g, '/')));
  console.log('[seed-docs] Press Ctrl+C to stop.\n');

  let debounce = null;

  WATCHED_SOURCES.forEach((filePath) => {
    if (!existsSync(filePath)) {
      console.warn(`[seed-docs] ⚠  File not found (skipping watch): ${relative(ROOT, filePath)}`);
      return;
    }
    watch(filePath, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const changed = relative(ROOT, filePath).replace(/\\/g, '/');
        console.log(`[seed-docs] Change detected in ${changed} — regenerating…`);
        try {
          generate();
        } catch (err) {
          console.error('[seed-docs] ✗ Generation failed:', err.message);
        }
      }, 350);
    });
  });
}


// ─── Entry Point ─────────────────────────────────────────────────────────────

try {
  generate();
  if (process.argv.includes('--watch')) {
    startWatch();
  }
} catch (err) {
  const msg = '[seed-docs] ERROR: ' + (err && err.message ? err.message : String(err)) + '\n';
  process.stderr.write(msg);
  process.exit(1);
}
