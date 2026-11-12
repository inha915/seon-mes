-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('RAW', 'FINISHED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PLANNED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InventoryTxType" AS ENUM ('MATERIAL_RECEIPT', 'PRODUCTION_ISSUE', 'PRODUCTION_RECEIPT');

-- CreateTable
CREATE TABLE "partners" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "business_no" TEXT,
    "contact_name" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "unit" TEXT NOT NULL,
    "spec" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_lines" (
    "id" SERIAL NOT NULL,
    "parent_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,
    "qty_per" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "bom_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" SERIAL NOT NULL,
    "lot_no" TEXT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "initial_qty" DECIMAL(14,3) NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" SERIAL NOT NULL,
    "receipt_no" TEXT NOT NULL,
    "partner_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "receipt_date" DATE NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "supplier_lot_no" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" SERIAL NOT NULL,
    "work_order_no" TEXT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "planned_qty" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PLANNED',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_results" (
    "id" SERIAL NOT NULL,
    "result_no" TEXT NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "good_qty" INTEGER NOT NULL,
    "defect_qty" INTEGER NOT NULL,
    "finished_lot_id" INTEGER,
    "note" TEXT,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_consumptions" (
    "id" SERIAL NOT NULL,
    "production_result_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "material_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" SERIAL NOT NULL,
    "type" "InventoryTxType" NOT NULL,
    "item_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "balance_after" DECIMAL(14,3) NOT NULL,
    "receipt_id" INTEGER,
    "production_result_id" INTEGER,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "key" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "partners_code_key" ON "partners"("code");

-- CreateIndex
CREATE UNIQUE INDEX "items_code_key" ON "items"("code");

-- CreateIndex
CREATE INDEX "items_type_idx" ON "items"("type");

-- CreateIndex
CREATE UNIQUE INDEX "bom_lines_parent_id_component_id_key" ON "bom_lines"("parent_id", "component_id");

-- CreateIndex
CREATE UNIQUE INDEX "lots_lot_no_key" ON "lots"("lot_no");

-- CreateIndex
CREATE INDEX "lots_item_id_idx" ON "lots"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receipt_no_key" ON "receipts"("receipt_no");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_lot_id_key" ON "receipts"("lot_id");

-- CreateIndex
CREATE INDEX "receipts_receipt_date_idx" ON "receipts"("receipt_date");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_work_order_no_key" ON "work_orders"("work_order_no");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "production_results_result_no_key" ON "production_results"("result_no");

-- CreateIndex
CREATE UNIQUE INDEX "production_results_work_order_id_key" ON "production_results"("work_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_results_finished_lot_id_key" ON "production_results"("finished_lot_id");

-- CreateIndex
CREATE INDEX "production_results_confirmed_at_idx" ON "production_results"("confirmed_at");

-- CreateIndex
CREATE INDEX "material_consumptions_lot_id_idx" ON "material_consumptions"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_consumptions_production_result_id_lot_id_key" ON "material_consumptions"("production_result_id", "lot_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_lot_id_occurred_at_idx" ON "inventory_transactions"("lot_id", "occurred_at");

-- CreateIndex
CREATE INDEX "inventory_transactions_occurred_at_idx" ON "inventory_transactions"("occurred_at");

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_results" ADD CONSTRAINT "production_results_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_results" ADD CONSTRAINT "production_results_finished_lot_id_fkey" FOREIGN KEY ("finished_lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_consumptions" ADD CONSTRAINT "material_consumptions_production_result_id_fkey" FOREIGN KEY ("production_result_id") REFERENCES "production_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_consumptions" ADD CONSTRAINT "material_consumptions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_production_result_id_fkey" FOREIGN KEY ("production_result_id") REFERENCES "production_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 업무 규칙 CHECK 제약 (Prisma 스키마로 표현할 수 없어 수동 추가)
-- ---------------------------------------------------------------------------
-- LOT 현재고는 절대 음수가 될 수 없습니다. 동시 차감 시 최종 안전장치입니다.
ALTER TABLE "lots" ADD CONSTRAINT "lots_qty_non_negative" CHECK ("qty" >= 0);
ALTER TABLE "lots" ADD CONSTRAINT "lots_initial_qty_non_negative" CHECK ("initial_qty" >= 0);
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_qty_per_positive" CHECK ("qty_per" > 0);
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_no_self_reference" CHECK ("parent_id" <> "component_id");
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_planned_qty_positive" CHECK ("planned_qty" > 0);
ALTER TABLE "production_results" ADD CONSTRAINT "production_results_qty_non_negative" CHECK ("good_qty" >= 0 AND "defect_qty" >= 0);
ALTER TABLE "production_results" ADD CONSTRAINT "production_results_qty_total_positive" CHECK ("good_qty" + "defect_qty" > 0);
ALTER TABLE "material_consumptions" ADD CONSTRAINT "material_consumptions_qty_positive" CHECK ("qty" > 0);
