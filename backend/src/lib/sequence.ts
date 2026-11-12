import type { Tx } from '../db.js';

/**
 * 문서 번호 채번: PREFIX-YYYYMMDD-NNN
 * INSERT ... ON CONFLICT DO UPDATE ... RETURNING 은 행 잠금을 잡고 원자적으로 증가하므로
 * 동시 요청에서도 번호가 중복되지 않습니다. 호출한 트랜잭션이 롤백되면 번호도 함께 롤백됩니다.
 */
export async function nextDocumentNo(tx: Tx, prefix: string, date: string): Promise<string> {
  const ymd = date.replaceAll('-', '');
  const key = `${prefix}-${ymd}`;
  const rows = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO document_sequences ("key", last_value) VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET last_value = document_sequences.last_value + 1
    RETURNING last_value`;
  const seq = rows[0]?.last_value ?? 1;
  return `${key}-${String(seq).padStart(3, '0')}`;
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
} as const;
