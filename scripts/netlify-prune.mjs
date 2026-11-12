#!/usr/bin/env node
/**
 * Netlify 빌드 전용: 프론트 빌드 후, 함수 번들 전에 실행 시 필요 없는 파일을 지워
 * Express+Prisma 함수가 크기 제한(압축 50MB) 안에 들도록 합니다.
 *
 * Netlify 번들러는 @prisma/client 패키지 전체(다른 DB 용 WASM 런타임, 선택적 peer 인 typescript 포함)와
 * 생성된 .prisma/client 폴더 전체를 함수에 넣기 때문에, 원본 파일을 미리 지우는 방식으로 줄입니다.
 *
 * 안전장치: NETLIFY=true (Netlify 빌드 환경)일 때만 실행됩니다. 로컬에서는 아무것도 지우지 않습니다.
 * 점검용: node scripts/netlify-prune.mjs --root <디렉터리> --force  (node_modules 구조를 가진 다른 폴더 대상)
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const force = args.includes('--force');
const rootArg = args.indexOf('--root');
const root = rootArg >= 0 ? path.resolve(args[rootArg + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.env.NETLIFY !== 'true' && !force) {
  console.log('[netlify-prune] NETLIFY 환경이 아니므로 건너뜁니다.');
  process.exit(0);
}

const KEEP_ENGINE = 'rhel-openssl-3.0.x'; // AWS Lambda (Amazon Linux 2023)
let removed = 0;
let bytes = 0;

const sizeOf = (p) => {
  const st = statSync(p);
  if (!st.isDirectory()) return st.size;
  return readdirSync(p).reduce((sum, f) => sum + sizeOf(path.join(p, f)), 0);
};
const remove = (p) => {
  if (!existsSync(p)) return;
  bytes += sizeOf(p);
  rmSync(p, { recursive: true, force: true });
  removed++;
};
const removeMatching = (dir, test) => {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) if (test(f)) remove(path.join(dir, f));
};

const nm = path.join(root, 'node_modules');

// 1) 생성된 Prisma Client: Lambda 용 엔진만 남기고 다른 OS 엔진·임시 파일·WASM 엔진 제거
removeMatching(path.join(nm, '.prisma/client'), (f) =>
  (/^(lib)?query_engine/.test(f) && !f.includes(KEEP_ENGINE) && f !== 'query_engine_bg.js') ||
  f.includes('.tmp') ||
  f.endsWith('.wasm'),
);

// 2) @prisma/client 런타임: Node 라이브러리 엔진(library.js)만 쓰므로 DB별 WASM 런타임 제거
removeMatching(path.join(nm, '@prisma/client/runtime'), (f) =>
  /wasm/.test(f) || /^query_(engine|compiler)_bg\./.test(f),
);

// 3) 빌드가 끝난 뒤에는 필요 없는 TypeScript (Prisma 의 선택적 peer 로 함수에 딸려 들어감)
remove(path.join(nm, 'typescript'));

console.log(`[netlify-prune] ${removed}개 항목, ${(bytes / 1e6).toFixed(1)}MB 제거 (root: ${root})`);
