import type { Tx } from '../db.js'

// PREFIX-YYYYMMDD-001 형식. ON CONFLICT 로 올려서 동시에 요청해도 번호가 안 겹친다
export async function nextDocumentNo(
  tx: Tx,
  prefix: string,
  date: string,
): Promise<string> {
  const ymd = date.replaceAll('-', '')
  const key = `${prefix}-${ymd}`
  const rows = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO document_sequences ("key", last_value) VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET last_value = document_sequences.last_value + 1
    RETURNING last_value`
  const seq = rows[0]?.last_value ?? 1
  return `${key}-${String(seq).padStart(3, '0')}`
}

export const DocPrefix = {
  RAW_LOT: 'RM',
  FINISHED_LOT: 'FG',
  RECEIPT: 'RC',
  WORK_ORDER: 'WO',
  PRODUCTION_RESULT: 'PR',
  SALES_ORDER: 'SO',
  SHIPMENT: 'SH',
  APPROVAL: 'AP',
} as const
