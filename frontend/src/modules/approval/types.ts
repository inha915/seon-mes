import type { ApprovalDocType, ApprovalStatus, UserRef, WorkOrderStatus } from '@/shared/types';

export interface Approval {
  id: number;
  requestNo: string;
  docType: ApprovalDocType;
  status: ApprovalStatus;
  comment: string | null;
  requestedAt: string;
  decidedAt: string | null;
  requester: UserRef;
  approver: UserRef | null;
  workOrder: {
    id: number;
    workOrderNo: string;
    plannedQty: number;
    status: WorkOrderStatus;
    item: { code: string; name: string; unit: string };
  };
  content: {
    goodQty: number;
    defectQty: number;
    note: string | null;
    consumptions: { lotId: number; lotNo: string; itemCode: string; unit: string; qty: number; currentQty: number }[];
  };
  result: { id: number; resultNo: string; finishedLotNo: string | null } | null;
}
