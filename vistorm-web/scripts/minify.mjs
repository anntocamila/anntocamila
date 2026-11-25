// Minifica src/ en assets/. Correr con: npm run minify
import { readFile, writeFile } from 'node:fs/promises';
import { minify } from 'terser';
import { minify as minifyCss } from 'csso';

for (const f of ['hero', 'site', 'consent', 'motion']) {
  const src = await readFile(`src/${f}.js`, 'utf8');
  const out = await minify(src, { compress: true, mangle: true });
  await writeFile(`assets/js/${f}.js`, out.code);
  console.log(`assets/js/${f}.js`, src.length, '→', out.code.length);
}
const css = await readFile('src/site.css', 'utf8');
const min = minifyCss(css, { restructure: false }).css;
await writeFile('assets/css/site.css', min);
console.log('assets/css/site.css', css.length, '→', min.length);
