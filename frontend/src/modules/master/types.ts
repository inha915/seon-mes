import type { ItemType, PartnerType } from '@/shared/types';

export interface Partner {
  id: number;
  code: string;
  name: string;
  type: PartnerType;
  businessNo: string | null;
  contactName: string | null;
  phone: string | null;
  createdAt: string;
  receiptCount: number;
  salesOrderCount: number;
}

export interface BomLine {
  id: number;
  componentId: number;
  componentCode: string;
  componentName: string;
  unit: string;
  qtyPer: number;
}

export interface Item {
  id: number;
  code: string;
  name: string;
  type: ItemType;
  unit: string;
  spec: string | null;
  createdAt: string;
  stockQty: number;
  bomLines: BomLine[];
}
