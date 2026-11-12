import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCodeLabel } from '@/shared/components/code-badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import type { Item } from '../types';

export interface BomLinesForm {
  bomLines: { componentId: string; qtyPer: string }[];
}

/** 완제품 1개당 원자재 기준 소요량 입력 표 */
export function BomLinesEditor({
  control,
  register,
  errors,
  rawItems,
}: {
  control: Control<BomLinesForm>;
  register: UseFormRegister<BomLinesForm>;
  errors?: FieldErrors<BomLinesForm>['bomLines'];
  rawItems: Item[];
}) {
  const { t } = useTranslation();
  const unitLabel = useCodeLabel('unit');
  const { fields, append, remove } = useFieldArray({ control, name: 'bomLines' });

  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1.5">
        <span className="text-[12.5px] font-semibold">{t('items.bomTitle')}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ componentId: '', qtyPer: '' })}>
          <Plus /> {t('items.addComponent')}
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">{t('items.bomEmpty')}</p>
      ) : (
        <div className="divide-y">
          {fields.map((field, index) => {
            const err = errors?.[index];
            return (
              <div key={field.id} className="grid grid-cols-[1fr_9rem_2rem] items-start gap-2 px-3 py-2">
                <div>
                  <NativeSelect
                    aria-label={t('items.component')}
                    aria-invalid={!!err?.componentId}
                    {...register(`bomLines.${index}.componentId`)}
                  >
                    <option value="">{t('items.selectComponent')}</option>
                    {rawItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.code} · {it.name} ({unitLabel(it.unit)})
                      </option>
                    ))}
                  </NativeSelect>
                  {err?.componentId?.message && (
                    <p className="mt-0.5 text-[12px] text-destructive">{t(err.componentId.message)}</p>
                  )}
                </div>
                <div>
                  <Input
                    inputMode="decimal"
                    aria-label={t('fields.qtyPer')}
                    placeholder={t('fields.qtyPer')}
                    aria-invalid={!!err?.qtyPer}
                    className="text-right"
                    {...register(`bomLines.${index}.qtyPer`)}
                  />
                  {err?.qtyPer?.message && <p className="mt-0.5 text-[12px] text-destructive">{t(err.qtyPer.message)}</p>}
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label={t('common.delete')}>
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {errors?.root?.message && <p className="px-3 pb-2 text-[12px] text-destructive">{t(errors.root.message)}</p>}
    </div>
  );
}
