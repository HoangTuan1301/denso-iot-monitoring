// Liệt kê các câu tr('...') trong src/ còn thiếu bản dịch EN/JA.
// Dùng: node scripts/i18n-check.mjs            → in số câu thiếu
//       node scripts/i18n-check.mjs --list     → in danh sách câu thiếu
//       node scripts/i18n-check.mjs --keys out.json → ghi toàn bộ câu gốc ra file
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcDir = path.join(root, 'src');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : /\.tsx?$/.test(e.name) ? [p] : [];
});
const keys = new Set();
for (const f of walk(srcDir)) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText() === 'tr' && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) keys.add(n.arguments[0].text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const args = process.argv.slice(2);
if (args[0] === '--keys') { fs.writeFileSync(args[1], JSON.stringify([...keys], null, 1)); console.log(keys.size, 'keys'); process.exit(0); }
let missing = 0;
for (const lang of ['en', 'ja']) {
  const dict = JSON.parse(fs.readFileSync(path.join(srcDir, 'i18n/dict', `${lang}.json`), 'utf8'));
  const miss = [...keys].filter((k) => !dict[k]);
  const unused = Object.keys(dict).filter((k) => !keys.has(k));
  console.log(`${lang}: ${keys.size - miss.length}/${keys.size} đã dịch, thiếu ${miss.length}, ${unused.length} câu dùng cho dữ liệu CSDL`);
  if (args[0] === '--list') miss.forEach((k) => console.log('  -', JSON.stringify(k)));
  missing += miss.length;
}
process.exitCode = missing ? 1 : 0;
