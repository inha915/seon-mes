import { Router } from 'express'
import approvalRouter from './module/approval/approval.router.js'
import dashboardRouter from './module/dashboard/dashboard.router.js'
import equipmentRouter from './module/equipment/equipment.router.js'
import lotsRouter from './module/inventory/lots/lots.router.js'
import receiptsRouter from './module/inventory/receipts/receipts.router.js'
import inventoryRouter from './module/inventory/stock/inventory.router.js'
import itemsRouter from './module/master/items/items.router.js'
import partnersRouter from './module/master/partners/partners.router.js'
import productionRouter from './module/production/results/production.router.js'
import workOrdersRouter from './module/production/work-orders/work-orders.router.js'
import salesOrdersRouter from './module/sales/orders/sales-orders.router.js'
import shipmentsRouter from './module/sales/shipments/shipments.router.js'
import settingsRouter from './module/system/settings/settings.router.js'
import usersRouter from './module/system/users/users.router.js'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/dashboard', dashboardRouter)

// 기준정보
router.use('/partners', partnersRouter)
router.use('/items', itemsRouter)

// 영업
router.use('/sales-orders', salesOrdersRouter)
router.use('/shipments', shipmentsRouter)

// 생산
router.use('/work-orders', workOrdersRouter)
router.use('/production-results', productionRouter)

// 재고
router.use('/receipts', receiptsRouter)
router.use('/inventory', inventoryRouter)
router.use('/lots', lotsRouter)

// 결재 / 설비 / 시스템
router.use('/approvals', approvalRouter)
router.use('/equipments', equipmentRouter)
router.use('/users', usersRouter)
router.use('/settings', settingsRouter)

export default router
