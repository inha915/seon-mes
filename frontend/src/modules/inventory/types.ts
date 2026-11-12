import type { InventoryTxType, ItemType } from '@/shared/types';

export interface Receipt {
  id: number;
  receiptNo: string;
  receiptDate: string;
  qty: number;
  supplierLotNo: string | null;
  note: string | null;
  createdAt: string;
  partner: { id: number; code: string; name: string };
  item: { id: number; code: string; name: string; unit: string };
  lot: { id: number; lotNo: string; qty: number };
}

export interface ItemStock {
  id: number;
  code: string;
  name: string;
  type: ItemType;
  unit: string;
  stockQty: number;
  activeLotCount: number;
}

export interface LotStock {
  id: number;
  lotNo: string;
  qty: number;
  initialQty: number;
  createdAt: string;
  item: { id: number; code: string; name: string; type: ItemType; unit: string };
  source:
    | { kind: 'RECEIPT'; receiptNo: string; receiptDate: string; partnerName: string }
    | { kind: 'PRODUCTION'; workOrderNo: string; workOrderId: number }
    | null;
}

export interface InventoryTransaction {
  id: number;
  type: InventoryTxType;
  qty: number;
  balanceAfter: number;
  occurredAt: string;
  item: { id: number; code: string; name: string; unit: string };
  lot: { id: number; lotNo: string };
  reference:
    | { kind: 'RECEIPT'; no: string }
    | { kind: 'PRODUCTION'; no: string; workOrderNo: string; workOrderId: number }
    | { kind: 'SHIPMENT'; no: string; orderNo: string; customerName: string }
    | null;
}

export interface ReceiptRef {
  id: number;
  receiptNo: string;
  receiptDate: string;
  qty: number;
  supplierLotNo: string | null;
  partner: { id: number; code: string; name: string };
}

export interface LotTrace {
  lot: {
    id: number;
    lotNo: string;
    qty: number;
    initialQty: number;
    createdAt: string;
    item: { id: number; code: string; name: string; type: ItemType; unit: string };
  };
  production: {
    resultId: number;
    resultNo: string;
    goodQty: number;
    defectQty: number;
    confirmedAt: string;
    workOrder: { id: number; workOrderNo: string; plannedQty: number; workDate: string };
  } | null;
  materials: {
    lot: { id: number; lotNo: string; qty: number; initialQty: number };
    item: { id: number; code: string; name: string; unit: string };
    consumedQty: number;
    receipt: ReceiptRef | null;
  }[];
  receipt: ReceiptRef | null;
  usedIn: {
    resultId: number;
    resultNo: string;
    confirmedAt: string;
    consumedQty: number;
    workOrder: { id: number; workOrderNo: string };
    item: { code: string; name: string };
    finishedLotNo: string | null;
  }[];
  shipments: {
    shipmentId: number;
    shipmentNo: string;
    shipDate: string;
    qty: number;
    salesOrder: { id: number; orderNo: string };
    customer: { code: string; name: string };
  }[];
  transactions: { id: number; type: InventoryTxType; qty: number; balanceAfter: number; occurredAt: string }[];
}
