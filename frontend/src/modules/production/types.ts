import type { EquipmentStatus, WorkOrderStatus } from '@/shared/types';

export interface Requirement {
  componentId: number;
  componentCode: string;
  componentName: string;
  unit: string;
  qtyPer: number;
  requiredQty: number;
}

export interface WorkOrder {
  id: number;
  workOrderNo: string;
  workDate: string;
  plannedQty: number;
  status: WorkOrderStatus;
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  item: { id: number; code: string; name: string; unit: string };
  salesOrder: { id: number; orderNo: string; customerName: string } | null;
  equipment: { id: number; code: string; name: string; status: EquipmentStatus } | null;
  pendingApproval: { id: number; requestNo: string; requesterName: string; requestedAt: string } | null;
  requirements: Requirement[];
  result: {
    id: number;
    resultNo: string;
    goodQty: number;
    defectQty: number;
    confirmedAt: string;
    finishedLotNo: string | null;
  } | null;
}

export interface AvailableLot {
  id: number;
  lotNo: string;
  qty: number;
  receiptDate: string | null;
  partnerName: string | null;
}

export interface WorkOrderDetail extends Omit<WorkOrder, 'requirements'> {
  requirements: (Requirement & { stockQty: number; availableLots: AvailableLot[] })[];
  consumptions: { lotId: number; lotNo: string; itemCode: string; itemName: string; unit: string; qty: number }[];
}

export interface ProductionResult {
  id: number;
  resultNo: string;
  goodQty: number;
  defectQty: number;
  note: string | null;
  confirmedAt: string;
  workOrder: {
    id: number;
    workOrderNo: string;
    plannedQty: number;
    item: { id: number; code: string; name: string; unit: string };
  };
  finishedLot: { id: number; lotNo: string; qty: number } | null;
  consumptions: { lotId: number; lotNo: string; itemCode: string; itemName: string; unit: string; qty: number }[];
}

/** 생산실적 입력값 (직접 확정과 결재 요청이 같은 형식) */
export interface ProductionInput {
  workOrderId: number;
  goodQty: number;
  defectQty: number;
  note?: string;
  consumptions: { lotId: number; qty: number }[];
}
