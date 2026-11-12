#!/usr/bin/env node
/**
 * 번역 리소스 검사 (npm run i18n:check)
 *  1. 모든 언어 파일이 기준 언어(ko)와 같은 키를 갖는지 (누락/불필요 키)
 *  2. 같은 키의 {{변수}} 집합이 언어별로 같은지
 *  3. 소스 코드의 정적 t('...') / labelKey 키가 기준 언어에 있는지
 *  4. 백엔드 오류 코드, DB enum(상태·품목구분·수불구분), 단위 코드의 번역이 있는지
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(root, 'src/i18n/locales');
const BASE = 'ko';

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]],
  );
const placeholders = (s) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');

const locales = Object.fromEntries(
  readdirSync(localesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [path.basename(f, '.json'), new Map(flatten(JSON.parse(readFileSync(path.join(localesDir, f), 'utf8'))))]),
);
const base = locales[BASE];
const errors = [];

// 1, 2
for (const [lang, map] of Object.entries(locales)) {
  if (lang === BASE) continue;
  for (const key of base.keys()) {
    if (!map.has(key)) errors.push(`[${lang}] missing key: ${key}`);
    else if (placeholders(map.get(key)) !== placeholders(base.get(key)))
      errors.push(`[${lang}] placeholder mismatch: ${key} (${BASE}: ${placeholders(base.get(key))} / ${lang}: ${placeholders(map.get(key))})`);
  }
  for (const key of map.keys()) if (!base.has(key)) errors.push(`[${lang}] extra key not in ${BASE}: ${key}`);
}

// 3
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
const keyPattern = /(?:\bt\(\s*|labelKey:\s*)['"]([a-zA-Z][\w.-]*)['"]/g;
let staticKeys = 0;
for (const file of walk(path.join(root, 'src'))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(keyPattern)) {
    staticKeys++;
    if (!base.has(m[1])) errors.push(`[source] ${path.relative(root, file)}: unknown key "${m[1]}"`);
  }
}

// 4
const backend = path.resolve(root, '../backend');
const errorCodes = [...readFileSync(path.join(backend, 'src/lib/errors.ts'), 'utf8').matchAll(/^\s+([A-Z_]+): '([A-Z_]+)',$/gm)].map((m) => m[2]);
const schema = readFileSync(path.join(backend, 'prisma/schema.prisma'), 'utf8');
// Prisma enum 전체 → codes.<enum 이름 첫 글자 소문자>.<값>
const enums = [...schema.matchAll(/enum (\w+) \{([^}]*)\}/g)].map(([, name, body]) => ({
  group: name[0].toLowerCase() + name.slice(1),
  values: body.split('\n').map((l) => l.replace(/\/\/.*/, '').trim()).filter(Boolean),
}));
const units = [...(readFileSync(path.join(backend, 'src/modules/master/items/items.service.ts'), 'utf8').match(/UNIT_CODES = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]);
// 프론트 공통코드 레지스트리(shared/codes.ts)의 그룹 이름
const registryGroups = [...(readFileSync(path.join(root, 'src/shared/codes.ts'), 'utf8').match(/CODE_GROUPS = \{([\s\S]*?)\} as const/)?.[1] ?? '').matchAll(/^\s{2}(\w+): \{/gm)].map((m) => m[1]);
const required = [
  ...errorCodes.map((c) => `errors.${c}`),
  'errors.NETWORK_ERROR',
  ...enums.flatMap((e) => [`codes.${e.group}._name`, ...e.values.map((v) => `codes.${e.group}.${v}`)]),
  'codes.unit._name',
  ...units.map((u) => `codes.unit.${u}`),
  ...registryGroups.map((g) => `codes.${g}._name`),
];
for (const e of enums) {
  if (!registryGroups.includes(e.group)) errors.push(`[code] Prisma enum ${e.group} is not registered in shared/codes.ts`);
}
for (const key of required) if (!base.has(key)) errors.push(`[code] missing translation for code: ${key}`);

const langs = Object.keys(locales).join(', ');
if (errors.length) {
  console.error(`✖ i18n check failed (${errors.length})`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `✔ i18n OK — languages: ${langs} / ${base.size} keys each / ${staticKeys} static usages / ${required.length} code mappings (${errorCodes.length} API errors)`,
);
