import { Router } from 'express';
import { approvalRouter } from './modules/approval/approval.routes.js';
import { getDashboard } from './modules/dashboard/dashboard.service.js';
import { equipmentRouter } from './modules/equipment/equipment.routes.js';
import { lotsRouter } from './modules/inventory/lots/lots.routes.js';
import { receiptsRouter } from './modules/inventory/receipts/receipts.routes.js';
import { inventoryRouter } from './modules/inventory/stock/inventory.routes.js';
import { itemsRouter } from './modules/master/items/items.routes.js';
import { partnersRouter } from './modules/master/partners/partners.routes.js';
import { productionRouter } from './modules/production/results/production.routes.js';
import { workOrdersRouter } from './modules/production/work-orders/work-orders.routes.js';
import { salesOrdersRouter } from './modules/sales/orders/sales-orders.routes.js';
import { shipmentsRouter } from './modules/sales/shipments/shipments.routes.js';
import { settingsRouter } from './modules/system/settings/settings.routes.js';
import { usersRouter } from './modules/system/users/users.routes.js';

/**
 * API 라우트 등록 — 화면 메뉴와 같은 업무 대분류 순서로 정리합니다.
 */
export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
apiRouter.get('/dashboard', async (_req, res) => {
  res.json(await getDashboard());
});

// 기준정보
apiRouter.use('/partners', partnersRouter);
apiRouter.use('/items', itemsRouter);
// 영업
apiRouter.use('/sales-orders', salesOrdersRouter);
apiRouter.use('/shipments', shipmentsRouter);
// 생산
apiRouter.use('/work-orders', workOrdersRouter);
apiRouter.use('/production-results', productionRouter);
// 재고
apiRouter.use('/receipts', receiptsRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/lots', lotsRouter);
// 결재
apiRouter.use('/approvals', approvalRouter);
// 설비
apiRouter.use('/equipments', equipmentRouter);
// 시스템
apiRouter.use('/users', usersRouter);
apiRouter.use('/settings', settingsRouter);
