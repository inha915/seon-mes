/**
 * Netlify 로컬 빌드 플러그인: Express+Prisma 함수를 크기 제한(압축 50MB) 안으로 줄입니다.
 *
 * Netlify 번들러는 @prisma/client 패키지 전체(다른 DB 용 WASM 런타임, 선택적 peer 인 typescript 포함)와
 * 생성된 .prisma/client 폴더 전체를 함수에 넣습니다. 그래서 함수 번들링 직전에 실행에 필요 없는 파일을
 * node_modules 밖으로 "옮겨" 두었다가, 번들링이 끝나면 "되돌립니다".
 *
 * 파일을 지우지 않고 되돌리는 이유: Netlify 는 빌드 후 node_modules 를 캐시로 저장하므로,
 * 지운 상태로 캐시되면 다음 배포의 설치 단계(prisma generate 등)가 깨집니다.
 *
 * 이벤트 순서: 빌드 명령 → onBuild(옮기기) → 함수 번들링 → onPostBuild(되돌리기) → 배포 → 캐시 저장
 */
const fs = require('node:fs');
const path = require('node:path');

const KEEP_ENGINE = 'rhel-openssl-3.0.x'; // AWS Lambda (Amazon Linux 2023)
const BACKUP_DIR = '.netlify/slim-function-deps-backup';

function targets(root) {
  const nm = path.join(root, 'node_modules');
  const list = [];
  const addMatching = (dir, test) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) if (test(f)) list.push(path.join(dir, f));
  };
  // 1) 생성된 Prisma Client: Lambda 용 엔진만 남기고 다른 OS 엔진·임시 파일·WASM 엔진 제외
  addMatching(path.join(nm, '.prisma/client'), (f) =>
    (/^(lib)?query_engine/.test(f) && !f.includes(KEEP_ENGINE) && f !== 'query_engine_bg.js') ||
    f.includes('.tmp') ||
    f.endsWith('.wasm'),
  );
  // 2) @prisma/client 런타임: Node 라이브러리 엔진(library.js)만 쓰므로 DB별 WASM 런타임 제외
  addMatching(path.join(nm, '@prisma/client/runtime'), (f) => /wasm/.test(f) || /^query_(engine|compiler)_bg\./.test(f));
  // 3) 빌드가 끝난 뒤 함수 실행에는 필요 없는 TypeScript
  const ts = path.join(nm, 'typescript');
  if (fs.existsSync(ts)) list.push(ts);
  return list;
}

function moveAway(root, log) {
  const backup = path.join(root, BACKUP_DIR);
  let moved = 0;
  for (const src of targets(root)) {
    const dest = path.join(backup, path.relative(root, src));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    moved++;
  }
  log(`[slim-function-deps] 함수 번들링 전 ${moved}개 항목을 임시로 옮겼습니다.`);
}

function restore(root, log) {
  const backup = path.join(root, BACKUP_DIR);
  if (!fs.existsSync(backup)) return;
  let restored = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, entry.name);
      const rel = path.relative(backup, from);
      const to = path.join(root, rel);
      // 옮긴 단위(파일 또는 typescript 폴더)를 그대로 되돌립니다.
      const isMovedUnit = !entry.isDirectory() || rel === path.join('node_modules', 'typescript');
      if (isMovedUnit) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        if (!fs.existsSync(to)) fs.renameSync(from, to);
        restored++;
      } else {
        walk(from);
      }
    }
  };
  walk(backup);
  fs.rmSync(backup, { recursive: true, force: true });
  log(`[slim-function-deps] ${restored}개 항목을 node_modules 로 되돌렸습니다.`);
}

module.exports = {
  onBuild: () => moveAway(process.cwd(), console.log),
  onPostBuild: () => restore(process.cwd(), console.log),
  // 실패하더라도 캐시가 깨지지 않도록 되돌림
  onError: () => restore(process.cwd(), console.log),
  onEnd: () => restore(process.cwd(), console.log),
  // 로컬 점검용
  _internal: { targets, moveAway, restore },
};
