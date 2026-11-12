import type { SalesOrderStatus, WorkOrderStatus } from '@/shared/types';

export interface SalesOrder {
  id: number;
  orderNo: string;
  orderDate: string;
  dueDate: string;
  qty: number;
  shippedQty: number;
  remainingQty: number;
  plannedQty: number;
  status: SalesOrderStatus;
  note: string | null;
  createdAt: string;
  customer: { id: number; code: string; name: string };
  item: { id: number; code: string; name: string; unit: string };
  workOrders: { id: number; workOrderNo: string; status: WorkOrderStatus; plannedQty: number }[];
}

export interface SalesOrderDetail extends SalesOrder {
  availableLots: { id: number; lotNo: string; qty: number; producedAt: string; workOrderNo: string | null }[];
  shipments: {
    id: number;
    shipmentNo: string;
    shipDate: string;
    qty: number;
    createdByName: string | null;
    lines: { lotId: number; lotNo: string; qty: number }[];
  }[];
}

export interface Shipment {
  id: number;
  shipmentNo: string;
  shipDate: string;
  qty: number;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
  salesOrder: { id: number; orderNo: string; customerName: string; item: { code: string; name: string; unit: string } };
  lines: { lotId: number; lotNo: string; qty: number }[];
}
