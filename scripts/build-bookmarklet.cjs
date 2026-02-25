const fs = require('node:fs');
const path = require('node:path');

const { minify } = require('terser');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const srcPath = path.join(rootDir, 'pbinfo-get-unsolved-enhanced.js');
  const pkgPath = path.join(rootDir, 'package.json');
  const distDir = path.join(rootDir, 'dist');

  const source = fs.readFileSync(srcPath, 'utf8');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const wrapped = `(()=>{\n${source}\n})();`;
  const result = await minify(wrapped, {
    compress: true,
    mangle: true,
  });

  if (!result || typeof result.code !== 'string' || result.code.length === 0) {
    throw new Error('Terser did not return minified code.');
  }

  fs.mkdirSync(distDir, { recursive: true });

  const minPath = path.join(distDir, 'pbinfo-get-unsolved.min.js');
  fs.writeFileSync(minPath, result.code, 'utf8');

  const userscriptPath = path.join(distDir, 'pbinfo-get-unsolved.userscript.js');
  const versionTag =
    typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version.trim() : '0.0.0';
  const userscript = `// ==UserScript==
// @name         pbinfo-get-unsolved
// @namespace    https://github.com/ezluci/pbinfo-get-unsolved
// @version      ${versionTag}
// @description  Userscript scanner for unsolved pbinfo problems.
// @match        https://www.pbinfo.ro/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.__PBINFO_GET_UNSOLVED_USERSCRIPT_READY__) return;
  window.__PBINFO_GET_UNSOLVED_USERSCRIPT_READY__ = true;
  window.PBINFO_GET_UNSOLVED_NO_AUTORUN = true;
  if (typeof window.PBINFO_GET_UNSOLVED_OVERLAY === 'undefined') {
    window.PBINFO_GET_UNSOLVED_OVERLAY = true;
  }

  ${result.code}

  function ensureStartButton() {
    if (document.getElementById('pbinfo-get-unsolved-userscript-start')) return;
    const btn = document.createElement('button');
    btn.id = 'pbinfo-get-unsolved-userscript-start';
    btn.type = 'button';
    btn.textContent = 'Start scan';
    btn.title = 'Rulează pbinfo-get-unsolved';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '2147483647',
      border: '1px solid rgba(0,0,0,0.25)',
      borderRadius: '999px',
      padding: '9px 14px',
      fontSize: '13px',
      lineHeight: '1',
      fontFamily: 'system-ui,Segoe UI,Roboto,sans-serif',
      background: '#0f172a',
      color: '#f8fafc',
      boxShadow: '0 4px 18px rgba(2,6,23,0.32)',
      cursor: 'pointer',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '0.9';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '1';
    });
    btn.addEventListener('click', () => {
      if (typeof window.pbinfoGetUnsolvedStart === 'function') {
        window.pbinfoGetUnsolvedStart();
      } else {
        console.error('pbinfoGetUnsolvedStart is not available.');
      }
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureStartButton, { once: true });
  } else {
    ensureStartButton();
  }
})();
`;
  fs.writeFileSync(userscriptPath, userscript, 'utf8');

  const bookmarklet = `javascript:${encodeURIComponent(result.code)}`;
  const bookmarkletPath = path.join(distDir, 'pbinfo-get-unsolved.bookmarklet.txt');
  fs.writeFileSync(bookmarkletPath, bookmarklet, 'utf8');

  console.log(`Wrote ${path.relative(rootDir, minPath)}`);
  console.log(`Wrote ${path.relative(rootDir, userscriptPath)}`);
  console.log(`Wrote ${path.relative(rootDir, bookmarkletPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
