import { AlertOctagon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '@/shared/lib/format';
import type { Shortage } from '@/shared/types';

/** 재고 부족 LOT 와 부족 수량 표시 (화면 사전 확인 / 서버 확정 시 응답 모두 같은 형태) */
export function ShortagePanel({ shortages, source, note }: { shortages: Shortage[]; source: 'client' | 'server'; note?: string }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  if (shortages.length === 0) return null;
  return (
    <div role="alert" data-testid="shortage-panel" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-[13px]">
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-destructive">
        <AlertOctagon className="size-4" />
        {source === 'server' ? t('errors.INSUFFICIENT_STOCK') : t('shortage.title')}
      </div>
      <table className="w-full">
        <thead className="text-[12px] text-muted-foreground">
          <tr>
            <th className="py-0.5 text-left font-medium">{t('fields.lotNo')}</th>
            <th className="py-0.5 text-left font-medium">{t('fields.itemCode')}</th>
            <th className="py-0.5 text-right font-medium">{t('shortage.requested')}</th>
            <th className="py-0.5 text-right font-medium">{t('shortage.available')}</th>
            <th className="py-0.5 text-right font-medium">{t('shortage.shortage')}</th>
          </tr>
        </thead>
        <tbody>
          {shortages.map((s) => (
            <tr key={s.lotNo}>
              <td className="code py-0.5">{s.lotNo}</td>
              <td className="code py-0.5">{s.itemCode}</td>
              <td className="py-0.5 text-right tabular-nums">{fmt.number(s.requestedQty)}</td>
              <td className="py-0.5 text-right tabular-nums">{fmt.number(s.availableQty)}</td>
              <td className="py-0.5 text-right font-semibold text-destructive tabular-nums">{fmt.number(s.shortageQty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{note ?? t('shortage.note')}</p>
    </div>
  );
}
