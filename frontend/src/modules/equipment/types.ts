import type { EquipmentLogType, EquipmentProcess, EquipmentStatus, WorkOrderStatus } from '@/shared/types';

export interface Equipment {
  id: number;
  code: string;
  name: string;
  process: EquipmentProcess;
  status: EquipmentStatus;
  location: string | null;
  installedAt: string | null;
  note: string | null;
  createdAt: string;
  openWorkOrderCount: number;
}

export interface EquipmentDetail extends Equipment {
  logs: {
    id: number;
    type: EquipmentLogType;
    fromStatus: EquipmentStatus | null;
    toStatus: EquipmentStatus | null;
    note: string | null;
    userName: string | null;
    occurredAt: string;
  }[];
  workOrders: {
    id: number;
    workOrderNo: string;
    workDate: string;
    status: WorkOrderStatus;
    plannedQty: number;
    item: { code: string; name: string };
  }[];
}
