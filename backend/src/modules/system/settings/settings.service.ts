import { z } from 'zod';
import type { Tx } from '../../../db.js';
import { prisma } from '../../../db.js';

/**
 * 시스템 설정. 키별 기본값을 코드에 두고, DB 에는 변경된 값만 저장합니다.
 */
export const SETTING_DEFAULTS = {
  /** 생산실적 확정 전 결재(팀장 승인) 필요 여부 */
  productionApprovalRequired: true,
} as const;

export type Settings = { productionApprovalRequired: boolean };

export const settingsUpdateSchema = z
  .object({
    productionApprovalRequired: z.boolean(),
  })
  .partial();

export async function getSettings(client: Pick<Tx, 'systemSetting'> = prisma): Promise<Settings> {
  const rows = await client.systemSetting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    productionApprovalRequired:
      typeof stored.productionApprovalRequired === 'boolean'
        ? stored.productionApprovalRequired
        : SETTING_DEFAULTS.productionApprovalRequired,
  };
}

export async function updateSettings(input: z.output<typeof settingsUpdateSchema>): Promise<Settings> {
  await prisma.$transaction(
    Object.entries(input)
      .filter(([, v]) => v !== undefined)
      .map(([key, value]) =>
        prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
      ),
  );
  return getSettings();
}
