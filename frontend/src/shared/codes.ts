export type Tone =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'outline'

export const CODE_GROUPS = {
  itemType: { RAW: 'secondary', FINISHED: 'default' },
  partnerType: { SUPPLIER: 'secondary', CUSTOMER: 'info', BOTH: 'default' },
  unit: {
    EA: 'outline',
    SHEET: 'outline',
    KG: 'outline',
    M: 'outline',
    SET: 'outline',
  },
  salesOrderStatus: {
    OPEN: 'secondary',
    IN_PRODUCTION: 'warning',
    PARTIALLY_SHIPPED: 'info',
    SHIPPED: 'success',
  },
  workOrderStatus: { PLANNED: 'warning', COMPLETED: 'success' },
  inventoryTxType: {
    MATERIAL_RECEIPT: 'default',
    PRODUCTION_ISSUE: 'destructive',
    PRODUCTION_RECEIPT: 'success',
    SHIPMENT: 'warning',
  },
  approvalDocType: { PRODUCTION_RESULT: 'default' },
  approvalStatus: {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'destructive',
    CANCELLED: 'secondary',
  },
  equipmentProcess: {
    CUTTING: 'outline',
    PRESSING: 'outline',
    INSPECTION: 'outline',
  },
  equipmentStatus: {
    RUNNING: 'success',
    IDLE: 'secondary',
    MAINTENANCE: 'warning',
    BREAKDOWN: 'destructive',
  },
  equipmentLogType: {
    STATUS_CHANGE: 'secondary',
    INSPECTION: 'info',
    REPAIR: 'warning',
  },
  userRole: { OPERATOR: 'secondary', MANAGER: 'info', ADMIN: 'default' },
} as const satisfies Record<string, Record<string, Tone>>

export type CodeGroup = keyof typeof CODE_GROUPS
export type CodeOf<G extends CodeGroup> = keyof (typeof CODE_GROUPS)[G] & string

export const codeKey = (group: CodeGroup, code: string) =>
  `codes.${group}.${code}`
export const codeValues = <G extends CodeGroup>(group: G) =>
  Object.keys(CODE_GROUPS[group]) as CodeOf<G>[]
export const codeTone = (group: CodeGroup, code: string): Tone =>
  (CODE_GROUPS[group] as Record<string, Tone>)[code] ?? 'secondary'
