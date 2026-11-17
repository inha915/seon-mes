/*
 * 함수 번들 크기 줄이기용 플러그인.
 * 번들링 직전에 필요 없는 파일을 node_modules 밖으로 빼고, 끝나면 다시 넣는다.
 * 지워버리면 Netlify 가 그 상태로 node_modules 를 캐시해서 다음 배포의 prisma generate 가 깨진다.
 */
const fs = require('node:fs')
const path = require('node:path')

const KEEP_ENGINE = 'rhel-openssl-3.0.x' // AWS Lambda (Amazon Linux 2023)
const BACKUP_DIR = '.netlify/slim-function-deps-backup'

function targets(root) {
  const nm = path.join(root, 'node_modules')
  const list = []
  const addMatching = (dir, test) => {
    if (!fs.existsSync(dir)) return
    for (const f of fs.readdirSync(dir))
      if (test(f)) list.push(path.join(dir, f))
  }
  // .prisma/client: lambda 엔진만 남김
  addMatching(
    path.join(nm, '.prisma/client'),
    (f) =>
      (/^(lib)?query_engine/.test(f) &&
        !f.includes(KEEP_ENGINE) &&
        f !== 'query_engine_bg.js') ||
      f.includes('.tmp') ||
      f.endsWith('.wasm'),
  )
  // library.js 엔진만 쓰니까 db별 wasm 런타임은 필요 없음
  addMatching(
    path.join(nm, '@prisma/client/runtime'),
    (f) => /wasm/.test(f) || /^query_(engine|compiler)_bg\./.test(f),
  )
  // prisma peer 로 딸려 들어오는 typescript
  const ts = path.join(nm, 'typescript')
  if (fs.existsSync(ts)) list.push(ts)
  return list
}

function moveAway(root, log) {
  const backup = path.join(root, BACKUP_DIR)
  let moved = 0
  for (const src of targets(root)) {
    const dest = path.join(backup, path.relative(root, src))
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.renameSync(src, dest)
    moved++
  }
  log(`[slim-function-deps] moved ${moved} files out of node_modules`)
}

function restore(root, log) {
  const backup = path.join(root, BACKUP_DIR)
  if (!fs.existsSync(backup)) return
  let restored = 0
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, entry.name)
      const rel = path.relative(backup, from)
      const to = path.join(root, rel)
      const isMovedUnit =
        !entry.isDirectory() || rel === path.join('node_modules', 'typescript')
      if (isMovedUnit) {
        fs.mkdirSync(path.dirname(to), { recursive: true })
        if (!fs.existsSync(to)) fs.renameSync(from, to)
        restored++
      } else {
        walk(from)
      }
    }
  }
  walk(backup)
  fs.rmSync(backup, { recursive: true, force: true })
  log(`[slim-function-deps] restored ${restored} files`)
}

module.exports = {
  onBuild: () => moveAway(process.cwd(), console.log),
  onPostBuild: () => restore(process.cwd(), console.log),
  // 실패해도 원복
  onError: () => restore(process.cwd(), console.log),
  onEnd: () => restore(process.cwd(), console.log),
}
