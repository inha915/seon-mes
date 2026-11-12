#!/usr/bin/env node
/**
 * 브라우저 E2E 시연 검증 (Playwright)
 *
 *   npm run e2e           # 검증만
 *   npm run screenshots   # 검증 + docs/images/*.png 캡처
 *
 * 전제: 시드 직후의 DB 로 백엔드(4000)와 프론트(5173)가 실행 중이어야 합니다.
 * 브라우저: 기본은 설치된 Microsoft Edge(channel=msedge). PW_CHANNEL=chrome 또는
 *           PW_CHANNEL=chromium(npx playwright install chromium 필요)으로 바꿀 수 있습니다.
 *
 * 시나리오 (기본 데모)
 *  수주 SO-SEED-0002(대양오토, 브라켓 18개) → 강판 100장 입고 → 수주에서 작업지시(20개, 설비 PR-01)
 *  → 생산실적 입력(재고 부족 표시 확인, 언어 전환 시 입력 유지) → 결재 요청(작업자)
 *  → 팀장으로 사용자 전환 후 승인 → 강판 80장·브라켓 18개 → 18개 출하 → 완제품 LOT 역추적·출하처 확인
 * 추가 검증 (API): 중복 확정, 같은 LOT 동시 차감, 서버 재고 부족 응답
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
const CHANNEL = process.env.PW_CHANNEL ?? 'msedge';
const SHOOT = process.argv.includes('--screenshots');
const imagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/images');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) throw new Error(`Check failed: ${name} ${detail}`);
};

async function api(method, p, body, userId) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (userId) headers['X-User-Id'] = String(userId);
  const res = await fetch(`${API}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function main() {
  const health = await fetch(`${API}/health`).catch(() => null);
  if (!health?.ok) throw new Error(`API not reachable at ${API}`);
  const startStock = (await api('GET', '/inventory/items?q=MAT-SPCC12')).body.items[0]?.stockQty;
  if (startStock !== 0) throw new Error(`MAT-SPCC12 stock must be 0 (fresh seed) but is ${startStock}. Run: npm run db:reset`);
  const users = (await api('GET', '/users?pageSize=50')).body.items;
  const userBy = (no) => users.find((u) => u.employeeNo === no);
  const salesOrder = (await api('GET', '/sales-orders?q=SO-SEED-0002')).body.items[0];
  if (!salesOrder) throw new Error('Seed sales order SO-SEED-0002 not found. Run: npm run db:seed');

  if (SHOOT) mkdirSync(imagesDir, { recursive: true });
  const browser = await chromium.launch({ channel: CHANNEL === 'chromium' ? undefined : CHANNEL, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const shot = async (name, opts = {}) => {
    if (!SHOOT) return;
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(imagesDir, `${name}.png`), fullPage: opts.fullPage ?? false });
    console.log(`  📸 docs/images/${name}.png`);
  };
  const dismissToasts = () => page.evaluate(() => document.querySelectorAll('[data-sonner-toast]').forEach((el) => el.remove()));
  const switchUser = async (employeeNo) => {
    await page.getByTestId('user-switcher').click();
    await page.getByTestId(`user-${employeeNo}`).click();
    await page.getByTestId('user-switcher').filter({ hasText: userBy(employeeNo).name }).waitFor();
  };

  // ── 0. 기본 언어·사용자·메뉴 ────────────────────────────────────────────
  await page.goto(WEB);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('heading', { name: '대시보드' }).waitFor();
  check('기본 언어는 한국어', (await page.locator('html').getAttribute('lang')) === 'ko');
  await page.getByTestId('user-switcher').filter({ hasText: '김민준' }).waitFor();
  check('기본 사용자는 작업자(김민준)', true);
  for (const id of ['master', 'sales', 'production', 'inventory', 'approval', 'equipment', 'system']) {
    await page.getByTestId(`menu-domain-${id}`).waitFor();
  }
  check('좌측 트리 메뉴: 기준정보·영업·생산·재고·결재·설비·시스템', true);
  await shot('00-dashboard-before');

  // ── 1. 자재 입고: 강판 100장 ────────────────────────────────────────────
  await page.goto(`${WEB}/inventory/receipts`);
  await page.locator('#r-partner option', { hasText: 'SUP-001' }).waitFor({ state: 'attached' });
  const supplierOptions = await page.locator('#r-partner option').allTextContents();
  check('입고 거래처 목록에는 공급사만 표시', !supplierOptions.some((o) => o.includes('CUS-')));
  await page.selectOption('#r-partner', { label: 'SUP-001 · 대성철강(가상)' });
  await page.fill('#r-date', today());
  await page.selectOption('#r-item', { label: 'MAT-SPCC12 · 냉연강판 SPCC 1.2t' });
  await page.fill('#r-qty', '100');
  await page.fill('#r-slot', 'DS-2611-0042');
  await page.getByRole('button', { name: '입고 등록' }).click();
  const receiptBox = page.getByTestId('receipt-result');
  await receiptBox.waitFor();
  const rawLotNo = (await receiptBox.locator('a.code-link').innerText()).trim();
  check('입고 등록 → 내부 LOT 발급', /^RM-\d{8}-\d{3}$/.test(rawLotNo), rawLotNo);
  await page.locator('tbody tr', { hasText: rawLotNo }).first().waitFor();
  await dismissToasts();
  await shot('01-receipts');

  // ── 2. 수주에서 작업지시: 브라켓 20개, 설비 PR-01 ───────────────────────
  await page.goto(`${WEB}/sales/orders`);
  await page.locator('tbody tr', { hasText: 'SO-SEED-0002' }).waitFor();
  await shot('02-sales-orders');
  await page.goto(`${WEB}/sales/orders/${salesOrder.id}`);
  await page.getByRole('link', { name: '작업지시 생성' }).click();
  await page.waitForURL(/production\/work-orders\?salesOrderId=/);
  await page.locator('#w-so option', { hasText: 'SO-SEED-0002' }).waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('#w-item')?.value !== '');
  check('수주 선택 시 품목·수량 자동 입력', (await page.inputValue('#w-qty')) === '18', `qty=${await page.inputValue('#w-qty')}`);
  const pr02Disabled = await page.locator('#w-eq option', { hasText: 'PR-02' }).isDisabled();
  check('정비 중 설비(PR-02)는 선택 불가', pr02Disabled);
  await page.fill('#w-qty', '20');
  await page.selectOption('#w-eq', { label: await page.locator('#w-eq option', { hasText: 'PR-01' }).innerText() });
  await page.getByRole('button', { name: '작업지시 등록' }).click();
  await page.locator('[data-sonner-toast]', { hasText: '작업지시를 등록했습니다' }).waitFor();
  const wo = (await api('GET', '/work-orders?q=PRD-BRK100&status=PLANNED')).body.items[0];
  check('작업지시 등록: BOM 예상 소요량 20장, 수주·설비 연결', wo?.plannedQty === 20 && wo.requirements[0]?.requiredQty === 20 && wo.salesOrder?.orderNo === 'SO-SEED-0002' && wo.equipment?.code === 'PR-01', wo?.workOrderNo);
  check('수주 상태 접수 → 생산중', (await api('GET', `/sales-orders/${salesOrder.id}`)).body.status === 'IN_PRODUCTION');
  await dismissToasts();
  await shot('03-work-orders');

  // ── 3. 생산실적 입력 → 결재 요청 ───────────────────────────────────────
  await page.goto(`${WEB}/production/results`);
  await page.getByTestId(`open-wo-${wo.workOrderNo}`).click();
  await page.getByTestId(`lot-stock-${rawLotNo}`).waitFor();
  check('생산실적 화면에 LOT 현재고 표시', (await page.getByTestId(`lot-stock-${rawLotNo}`).innerText()).trim() === '100');
  check('결재 사용 모드로 표시', (await page.getByTestId('approval-mode').innerText()).includes('결재'));
  await page.fill('#p-good', '18');
  await page.fill('#p-defect', '2');
  await page.getByTestId(`usage-${rawLotNo}`).fill('150');
  const shortage = page.getByTestId('shortage-panel');
  await shortage.waitFor();
  const shortageText = await shortage.innerText();
  check('재고 부족 시 부족 LOT·수량 표시', shortageText.includes(rawLotNo) && shortageText.includes('50'));
  check('재고 부족 시 진행 버튼 비활성', await page.getByRole('button', { name: '확정 전 확인' }).isDisabled());
  await shot('04-production-shortage', { fullPage: true });
  await page.getByTestId(`usage-${rawLotNo}`).fill('20');
  await shortage.waitFor({ state: 'detached' });

  await page.getByTestId('language-switcher').click();
  await page.getByTestId('language-en').click();
  await page.getByRole('heading', { name: 'Production Results' }).waitFor();
  const keptGood = await page.inputValue('#p-good');
  const keptUsage = await page.getByTestId(`usage-${rawLotNo}`).inputValue();
  check('언어 전환 후 화면·입력값 유지', page.url().includes(`workOrderId=${wo.id}`) && keptGood === '18' && keptUsage === '20', `good=${keptGood}, usage=${keptUsage}`);
  await shot('04-production-en', { fullPage: true });
  await page.getByTestId('language-switcher').click();
  await page.getByTestId('language-ko').click();
  await page.getByRole('heading', { name: '생산실적' }).waitFor();
  await shot('04-production', { fullPage: true });

  await page.getByRole('button', { name: '확정 전 확인' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByTestId('confirm-production').click();
  await page.getByTestId('approval-requested').waitFor();
  const requestNo = (await page.getByTestId('approval-requested').locator('.code-text').first().innerText()).trim();
  check('결재 요청 → 결재번호 발급, 재고는 아직 그대로', /^AP-\d{8}-\d{3}$/.test(requestNo) && (await api('GET', `/lots/${rawLotNo}`)).body.lot.qty === 100, requestNo);
  await dismissToasts();

  // ── 4. 결재: 작업자는 승인 불가 → 팀장으로 전환 후 승인 ─────────────────
  await page.goto(`${WEB}/approval/inbox`);
  await page.getByTestId(`approval-${requestNo}`).click();
  await page.getByTestId('approval-document').waitFor();
  check('작업자(요청자)에게는 승인 버튼 없음', (await page.getByTestId('approve-approval').count()) === 0);
  await switchUser('S2001');
  await page.getByTestId(`approval-${requestNo}`).click();
  await page.getByTestId('approve-approval').waitFor();
  await page.fill('#ap-comment', '불량 2개 사유 확인');
  await shot('05-approval-inbox');
  await page.getByTestId('approve-approval').click();
  await page.locator('[data-sonner-toast]', { hasText: '승인했습니다' }).waitFor();
  const approval = (await api('GET', `/approvals?q=${requestNo}`)).body.items[0];
  const fgLotNo = approval.result?.finishedLotNo;
  check('팀장 승인 → 생산실적 확정·완제품 LOT 발급', approval.status === 'APPROVED' && /^FG-\d{8}-\d{3}$/.test(fgLotNo ?? ''), fgLotNo);
  await dismissToasts();
  await shot('05-approval-approved');

  // ── 5. 재고 확인: 강판 80장, 완제품 18개 ─────────────────────────────────
  await page.goto(`${WEB}/inventory/stock`);
  await page.getByTestId('stock-qty-MAT-SPCC12').waitFor();
  const steel = (await page.getByTestId('stock-qty-MAT-SPCC12').innerText()).trim();
  const bracket = (await page.getByTestId('stock-qty-PRD-BRK100').innerText()).trim();
  check('강판 잔량 80장', steel === '80', steel);
  check('완제품 18개 입고', bracket === '18', bracket);
  await shot('06-inventory');

  // ── 6. 출하: 18개 ──────────────────────────────────────────────────────
  await page.goto(`${WEB}/sales/shipments?salesOrderId=${salesOrder.id}`);
  await page.getByTestId('shipment-form').waitFor();
  await page.getByRole('button', { name: '잔량 선입선출 배분' }).click();
  check('출하 잔량 선입선출 배분 18개', (await page.getByTestId(`ship-qty-${fgLotNo}`).inputValue()) === '18');
  await shot('07-shipments-form');
  await page.getByTestId('submit-shipment').click();
  await page.locator('[data-sonner-toast]', { hasText: '출하를 등록했습니다' }).waitFor();
  const so = (await api('GET', `/sales-orders/${salesOrder.id}`)).body;
  check('출하 → 수주 출하완료, 완제품 LOT 재고 0', so.status === 'SHIPPED' && so.shippedQty === 18 && (await api('GET', `/lots/${fgLotNo}`)).body.lot.qty === 0);
  await dismissToasts();
  await page.goto(`${WEB}/inventory/stock?tab=transactions`);
  await page.locator('tbody tr', { hasText: fgLotNo }).first().waitFor();
  await shot('06-inventory-ledger');

  // ── 7. LOT 추적 ────────────────────────────────────────────────────────
  await page.goto(`${WEB}/inventory/lot-trace?lotNo=${fgLotNo}`);
  const flow = page.getByTestId('trace-flow');
  await flow.waitFor();
  const flowText = await flow.innerText();
  check('완제품 LOT → 작업지시 → 투입 LOT → 최초 입고 역추적', flowText.includes(wo.workOrderNo) && flowText.includes(rawLotNo) && flowText.includes('대성철강(가상)'));
  const shipText = await page.getByTestId('trace-shipments').innerText();
  check('완제품 LOT → 고객 출하 정추적', shipText.includes('대양오토(가상)') && shipText.includes('SO-SEED-0002'));
  await shot('08-lot-trace', { fullPage: true });
  await flow.getByRole('link', { name: wo.workOrderNo }).click();
  await page.getByRole('heading', { name: '작업지시 상세' }).waitFor();
  check('추적 화면에서 작업지시 상세 열기', page.url().includes(`/production/work-orders/${wo.id}`));

  // ── 8. 기타 화면 캡처 ──────────────────────────────────────────────────
  await page.goto(`${WEB}/equipment/equipments`);
  await page.locator('tbody tr', { hasText: 'PR-01' }).waitFor();
  await shot('09-equipment');
  await page.goto(`${WEB}/system/codes`);
  await page.getByRole('heading', { name: '공통코드' }).waitFor();
  await shot('10-codes');
  await page.goto(WEB);
  await page.getByRole('heading', { name: '대시보드' }).waitFor();
  await page.getByText(rawLotNo).first().waitFor();
  await shot('00-dashboard');

  // ── 9. 언어 유지 (새로고침) ─────────────────────────────────────────────
  await page.getByTestId('language-switcher').click();
  await page.getByTestId('language-en').click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  const stored = await page.evaluate(() => localStorage.getItem('seon-mes.language'));
  check('새로고침 후 English 유지 (localStorage)', stored === 'en' && (await page.locator('html').getAttribute('lang')) === 'en');
  await page.goto(`${WEB}/inventory/lot-trace?lotNo=${fgLotNo}`);
  await page.getByTestId('trace-flow').waitFor();
  await shot('08-lot-trace-en', { fullPage: true });
  await page.getByTestId('language-switcher').click();
  await page.getByTestId('language-ko').click();
  await browser.close();

  // ── 10. API: 중복 확정·동시 차감 ───────────────────────────────────────
  const admin = userBy('S9001').id;
  const manager = userBy('S2001').id;
  const operator = userBy('S1001').id;
  const dupApprove = await api('POST', `/approvals/${approval.id}/approve`, {}, manager);
  check('같은 결재 재승인 → 409 APPROVAL_ALREADY_DECIDED', dupApprove.status === 409 && dupApprove.body.error.code === 'APPROVAL_ALREADY_DECIDED');
  const blocked = await api('POST', '/production-results', { workOrderId: wo.id, goodQty: 1, defectQty: 0, consumptions: [{ lotId: approval.content.consumptions[0].lotId, qty: 1 }] });
  check('결재 사용 중 직접 확정 → 409 APPROVAL_REQUIRED', blocked.status === 409 && blocked.body.error.code === 'APPROVAL_REQUIRED');

  await api('PUT', '/settings', { productionApprovalRequired: false }, admin);
  try {
    const dup = await api('POST', '/production-results', { workOrderId: wo.id, goodQty: 18, defectQty: 2, consumptions: [{ lotId: approval.content.consumptions[0].lotId, qty: 20 }] });
    check('확정된 작업지시 재확정 → 409 WORK_ORDER_ALREADY_CONFIRMED', dup.status === 409 && dup.body.error.code === 'WORK_ORDER_ALREADY_CONFIRMED');

    const items = (await api('GET', '/items?pageSize=100')).body.items;
    const steelItem = items.find((i) => i.code === 'MAT-SPCC12');
    const brkItem = items.find((i) => i.code === 'PRD-BRK100');
    const r50 = await api('POST', '/receipts', { partnerId: 1, itemId: steelItem.id, receiptDate: today(), qty: 50 });
    const orders = await Promise.all([1, 2, 3].map(() => api('POST', '/work-orders', { itemId: brkItem.id, plannedQty: 30, workDate: today() })));
    const concurrent = await Promise.all(
      orders.map((o) =>
        api('POST', '/production-results', { workOrderId: o.body.id, goodQty: 30, defectQty: 0, consumptions: [{ lotId: r50.body.lot.id, qty: 30 }] }, operator),
      ),
    );
    const ok = concurrent.filter((r) => r.status === 201).length;
    const short = concurrent.filter((r) => r.body?.error?.code === 'INSUFFICIENT_STOCK');
    const after = (await api('GET', `/lots/${r50.body.lot.lotNo}`)).body.lot.qty;
    check('같은 LOT 동시 차감: 1건만 성공, 잔량 20 (음수 없음)', ok === 1 && short.length === 2 && after === 20, `success=${ok}, insufficient=${short.length}, remaining=${after}`);
    const s = short[0]?.body.error.details.shortages[0];
    check('서버 재고 부족 응답에 LOT 번호·부족 수량 포함', s?.lotNo === r50.body.lot.lotNo && s.shortageQty === 10, JSON.stringify(s));
  } finally {
    await api('PUT', '/settings', { productionApprovalRequired: true }, admin);
  }

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
