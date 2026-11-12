/** 여러 모듈이 함께 쓰는 API 타입. 모듈 전용 응답 타입은 modules/<대분류>/types.ts 에 둡니다. */

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// DB enum 과 같은 고정 코드 (화면 문구는 i18n codes.* 에서 매핑)
export type ItemType = 'RAW' | 'FINISHED';
export type PartnerType = 'SUPPLIER' | 'CUSTOMER' | 'BOTH';
export type WorkOrderStatus = 'PLANNED' | 'COMPLETED';
export type InventoryTxType = 'MATERIAL_RECEIPT' | 'PRODUCTION_ISSUE' | 'PRODUCTION_RECEIPT' | 'SHIPMENT';
export type SalesOrderStatus = 'OPEN' | 'IN_PRODUCTION' | 'PARTIALLY_SHIPPED' | 'SHIPPED';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ApprovalDocType = 'PRODUCTION_RESULT';
export type EquipmentProcess = 'CUTTING' | 'PRESSING' | 'INSPECTION';
export type EquipmentStatus = 'RUNNING' | 'IDLE' | 'MAINTENANCE' | 'BREAKDOWN';
export type EquipmentLogType = 'STATUS_CHANGE' | 'INSPECTION' | 'REPAIR';
export type UserRole = 'OPERATOR' | 'MANAGER' | 'ADMIN';
export type UnitCode = 'EA' | 'SHEET' | 'KG' | 'M' | 'SET';

/** 재고 부족 상세 (INSUFFICIENT_STOCK 오류의 details.shortages) */
export interface Shortage {
  lotId: number;
  lotNo: string;
  itemCode: string;
  requestedQty: number;
  availableQty: number;
  shortageQty: number;
}

export interface UserRef {
  id: number;
  name: string;
  department: string;
  role: UserRole;
}
