/**
 * 공통코드 레지스트리 — DB/API 의 고정 코드와 화면 표시 방식을 한곳에서 정의합니다.
 *  · 표시 문구: i18n 키 `codes.<group>.<CODE>` (그룹 이름은 `codes.<group>._name`)
 *  · 배지 색: tone
 * CodeBadge 컴포넌트와 [시스템 > 공통코드] 화면이 이 정의를 그대로 사용합니다.
 * 그룹 이름은 Prisma enum 이름의 첫 글자를 소문자로 바꾼 것이며, npm run i18n:check 가 번역 누락을 검사합니다.
 */
export type Tone = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';

export const CODE_GROUPS = {
  itemType: { RAW: 'secondary', FINISHED: 'default' },
  partnerType: { SUPPLIER: 'secondary', CUSTOMER: 'info', BOTH: 'default' },
  unit: { EA: 'outline', SHEET: 'outline', KG: 'outline', M: 'outline', SET: 'outline' },
  salesOrderStatus: { OPEN: 'secondary', IN_PRODUCTION: 'warning', PARTIALLY_SHIPPED: 'info', SHIPPED: 'success' },
  workOrderStatus: { PLANNED: 'warning', COMPLETED: 'success' },
  inventoryTxType: {
    MATERIAL_RECEIPT: 'default',
    PRODUCTION_ISSUE: 'destructive',
    PRODUCTION_RECEIPT: 'success',
    SHIPMENT: 'warning',
  },
  approvalDocType: { PRODUCTION_RESULT: 'default' },
  approvalStatus: { PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', CANCELLED: 'secondary' },
  equipmentProcess: { CUTTING: 'outline', PRESSING: 'outline', INSPECTION: 'outline' },
  equipmentStatus: { RUNNING: 'success', IDLE: 'secondary', MAINTENANCE: 'warning', BREAKDOWN: 'destructive' },
  equipmentLogType: { STATUS_CHANGE: 'secondary', INSPECTION: 'info', REPAIR: 'warning' },
  userRole: { OPERATOR: 'secondary', MANAGER: 'info', ADMIN: 'default' },
} as const satisfies Record<string, Record<string, Tone>>;

export type CodeGroup = keyof typeof CODE_GROUPS;
export type CodeOf<G extends CodeGroup> = keyof (typeof CODE_GROUPS)[G] & string;

export const codeKey = (group: CodeGroup, code: string) => `codes.${group}.${code}`;
export const codeValues = <G extends CodeGroup>(group: G) => Object.keys(CODE_GROUPS[group]) as CodeOf<G>[];
export const codeTone = (group: CodeGroup, code: string): Tone =>
  ((CODE_GROUPS[group] as Record<string, Tone>)[code] ?? 'secondary');
