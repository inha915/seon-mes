-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('SUPPLIER', 'CUSTOMER', 'BOTH');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('OPEN', 'IN_PRODUCTION', 'PARTIALLY_SHIPPED', 'SHIPPED');

-- CreateEnum
CREATE TYPE "ApprovalDocType" AS ENUM ('PRODUCTION_RESULT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EquipmentProcess" AS ENUM ('CUTTING', 'PRESSING', 'INSPECTION');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('RUNNING', 'IDLE', 'MAINTENANCE', 'BREAKDOWN');

-- CreateEnum
CREATE TYPE "EquipmentLogType" AS ENUM ('STATUS_CHANGE', 'INSPECTION', 'REPAIR');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OPERATOR', 'MANAGER', 'ADMIN');

-- AlterEnum
ALTER TYPE "InventoryTxType" ADD VALUE 'SHIPMENT';

-- AlterTable
ALTER TABLE "inventory_transactions" ADD COLUMN     "shipment_id" INTEGER;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "type" "PartnerType" NOT NULL DEFAULT 'SUPPLIER';

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "equipment_id" INTEGER,
ADD COLUMN     "sales_order_id" INTEGER;

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" SERIAL NOT NULL,
    "order_no" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "order_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" SERIAL NOT NULL,
    "shipment_no" TEXT NOT NULL,
    "sales_order_id" INTEGER NOT NULL,
    "ship_date" DATE NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_lines" (
    "id" SERIAL NOT NULL,
    "shipment_id" INTEGER NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "shipment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" SERIAL NOT NULL,
    "request_no" TEXT NOT NULL,
    "doc_type" "ApprovalDocType" NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requester_id" INTEGER NOT NULL,
    "approver_id" INTEGER,
    "comment" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "production_result_id" INTEGER,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipments" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "process" "EquipmentProcess" NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'IDLE',
    "location" TEXT,
    "installed_at" DATE,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_logs" (
    "id" SERIAL NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "type" "EquipmentLogType" NOT NULL,
    "from_status" "EquipmentStatus",
    "to_status" "EquipmentStatus",
    "note" TEXT,
    "user_id" INTEGER,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "employee_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_order_no_key" ON "sales_orders"("order_no");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipment_no_key" ON "shipments"("shipment_no");

-- CreateIndex
CREATE INDEX "shipments_ship_date_idx" ON "shipments"("ship_date");

-- CreateIndex
CREATE INDEX "shipment_lines_lot_id_idx" ON "shipment_lines"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_lines_shipment_id_lot_id_key" ON "shipment_lines"("shipment_id", "lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_request_no_key" ON "approval_requests"("request_no");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_production_result_id_key" ON "approval_requests"("production_result_id");

-- CreateIndex
CREATE INDEX "approval_requests_status_requested_at_idx" ON "approval_requests"("status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "equipments_code_key" ON "equipments"("code");

-- CreateIndex
CREATE INDEX "equipment_logs_equipment_id_occurred_at_idx" ON "equipment_logs"("equipment_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_no_key" ON "users"("employee_no");

-- CreateIndex
CREATE INDEX "work_orders_sales_order_id_idx" ON "work_orders"("sales_order_id");

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_production_result_id_fkey" FOREIGN KEY ("production_result_id") REFERENCES "production_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_logs" ADD CONSTRAINT "equipment_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_logs" ADD CONSTRAINT "equipment_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 업무 규칙 제약 (수동 추가)
-- ---------------------------------------------------------------------------
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_due_after_order" CHECK ("due_date" >= "order_date");
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_qty_positive" CHECK ("qty" > 0);

-- 작업지시당 결재 대기(PENDING) 요청은 하나만 허용 — 동시에 결재를 두 번 올려도 DB 가 막습니다.
CREATE UNIQUE INDEX "approval_requests_one_pending_per_work_order"
  ON "approval_requests" ("work_order_id") WHERE "status" = 'PENDING';
