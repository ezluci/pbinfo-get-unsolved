const fs = require('node:fs');
const path = require('node:path');

const { minify } = require('terser');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const srcPath = path.join(rootDir, 'pbinfo-get-unsolved-enhanced.js');
  const distDir = path.join(rootDir, 'dist');

  const source = fs.readFileSync(srcPath, 'utf8');

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

  const bookmarklet = `javascript:${encodeURIComponent(result.code)}`;
  const bookmarkletPath = path.join(distDir, 'pbinfo-get-unsolved.bookmarklet.txt');
  fs.writeFileSync(bookmarkletPath, bookmarklet, 'utf8');

  console.log(`Wrote ${path.relative(rootDir, minPath)}`);
  console.log(`Wrote ${path.relative(rootDir, bookmarkletPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
