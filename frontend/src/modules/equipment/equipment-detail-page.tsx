import { Link } from '@tanstack/react-router';
import { ArrowLeft, History, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CodeBadge, CodeText, ItemCell } from '@/shared/components/code-badge';
import { DataGrid } from '@/shared/components/data-grid';
import { DescriptionList } from '@/shared/components/description-list';
import { FormField } from '@/shared/components/form-field';
import { Panel } from '@/shared/components/panel';
import { FormErrorAlert, QueryBoundary } from '@/shared/components/query-state';
import { Screen } from '@/shared/components/screen';
import { codeKey, codeValues } from '@/shared/codes';
import { useFormat } from '@/shared/lib/format';
import type { EquipmentLogType, EquipmentStatus } from '@/shared/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import { useAddEquipmentLog, useEquipment } from './api';
import type { EquipmentDetail } from './types';

export function EquipmentDetailPage({ equipmentId }: { equipmentId: number }) {
  const { t } = useTranslation();
  const query = useEquipment(equipmentId);
  return (
    <Screen
      title={t('equipment.detailTitle')}
      description={query.data ? `${query.data.code} · ${query.data.name}` : undefined}
      actions={
        <Button asChild variant="outline">
          <Link to="/equipment/equipments">
            <ArrowLeft /> {t('common.backToList')}
          </Link>
        </Button>
      }
    >
      <QueryBoundary query={query}>{(e) => <Detail eq={e} />}</QueryBoundary>
    </Screen>
  );
}

function Detail({ eq }: { eq: EquipmentDetail }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const mutation = useAddEquipmentLog(eq.id);
  const [type, setType] = useState<EquipmentLogType>('STATUS_CHANGE');
  const [toStatus, setToStatus] = useState<EquipmentStatus | ''>('');
  const [note, setNote] = useState('');

  const submit = () =>
    mutation.mutate(
      { type, toStatus: toStatus || undefined, note: note || undefined },
      {
        onSuccess: () => {
          toast.success(t('toast.equipmentLogged', { code: eq.code }));
          setToStatus('');
          setNote('');
        },
      },
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-4">
      <Panel title={t('equipment.infoTitle')} actions={<CodeBadge group="equipmentStatus" value={eq.status} />}>
        <DescriptionList
          items={[
            { label: t('fields.equipmentCode'), value: <CodeText className="font-semibold">{eq.code}</CodeText> },
            { label: t('fields.equipmentName'), value: eq.name },
            { label: t('fields.process'), value: <CodeBadge group="equipmentProcess" value={eq.process} /> },
            { label: t('fields.location'), value: eq.location ?? '-' },
            { label: t('fields.installedAt'), value: fmt.date(eq.installedAt) },
            { label: t('equipment.openWorkOrders'), value: fmt.number(eq.openWorkOrderCount) },
            { label: t('fields.note'), value: eq.note ?? '-' },
          ]}
        />
      </Panel>

      <Panel title={t('equipment.logFormTitle')} icon={<Wrench />}>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('fields.logType')} htmlFor="el-type" required>
            <NativeSelect id="el-type" value={type} onChange={(e) => setType(e.target.value as EquipmentLogType)}>
              {codeValues('equipmentLogType').map((v) => (
                <option key={v} value={v}>
                  {t(codeKey('equipmentLogType', v))}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('equipment.changeStatusTo')} htmlFor="el-status">
            <NativeSelect id="el-status" value={toStatus} onChange={(e) => setToStatus(e.target.value as EquipmentStatus | '')}>
              <option value="">{t('equipment.keepStatus')}</option>
              {codeValues('equipmentStatus')
                .filter((v) => v !== eq.status)
                .map((v) => (
                  <option key={v} value={v}>
                    {t(codeKey('equipmentStatus', v))}
                  </option>
                ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('fields.note')} htmlFor="el-note" className="col-span-2">
            <Input id="el-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('equipment.notePlaceholder')} />
          </FormField>
        </div>
        <div className="mt-3 space-y-2">
          <FormErrorAlert error={mutation.error} />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={mutation.isPending || (type === 'STATUS_CHANGE' && !toStatus)}>
              {mutation.isPending ? t('common.saving') : t('equipment.saveLog')}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title={t('equipment.logsTitle')} icon={<History />} bodyClassName="p-0">
        <DataGrid
          columns={[
            { key: 'at', header: t('fields.occurredAt'), cell: (l) => <span className="text-muted-foreground">{fmt.dateTime(l.occurredAt)}</span> },
            { key: 'type', header: t('fields.logType'), cell: (l) => <CodeBadge group="equipmentLogType" value={l.type} /> },
            {
              key: 'status',
              header: t('equipment.statusChange'),
              cell: (l) =>
                l.toStatus ? (
                  <span className="flex items-center gap-1">
                    {l.fromStatus && <CodeBadge group="equipmentStatus" value={l.fromStatus} />}
                    {l.fromStatus && '→'}
                    <CodeBadge group="equipmentStatus" value={l.toStatus} />
                  </span>
                ) : (
                  '-'
                ),
            },
            { key: 'note', header: t('fields.note'), wrap: true, cell: (l) => (l.note === 'REGISTERED' ? t('equipment.registered') : (l.note ?? '-')) },
            { key: 'user', header: t('fields.user'), cell: (l) => l.userName ?? '-' },
          ]}
          rows={eq.logs}
          rowKey={(l) => l.id}
          maxHeight={360}
        />
      </Panel>

      <Panel title={t('equipment.workOrdersTitle')} bodyClassName="p-0">
        <DataGrid
          columns={[
            {
              key: 'no',
              header: t('fields.workOrderNo'),
              cell: (w) => (
                <Link to="/production/work-orders/$workOrderId" params={{ workOrderId: String(w.id) }} className="code-link">
                  {w.workOrderNo}
                </Link>
              ),
            },
            { key: 'date', header: t('fields.workDate'), cell: (w) => fmt.date(w.workDate) },
            { key: 'item', header: t('fields.finishedGood'), cell: (w) => <ItemCell code={w.item.code} name={w.item.name} /> },
            { key: 'qty', header: t('fields.plannedQty'), align: 'right', cell: (w) => fmt.number(w.plannedQty) },
            { key: 'status', header: t('fields.status'), cell: (w) => <CodeBadge group="workOrderStatus" value={w.status} /> },
          ]}
          rows={eq.workOrders}
          rowKey={(w) => w.id}
          maxHeight={360}
          emptyMessage={t('equipment.noWorkOrders')}
        />
      </Panel>
    </div>
  );
}
