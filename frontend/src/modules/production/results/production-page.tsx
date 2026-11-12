import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { BadgeCheck, CheckCircle2, ClipboardCheck, Factory, GitBranch, Send, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { CodeBadge, CodeText, ItemCell, LotLink, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid } from '@/shared/components/data-grid';
import { DescriptionList } from '@/shared/components/description-list';
import { FormField } from '@/shared/components/form-field';
import { Panel } from '@/shared/components/panel';
import { EmptyState, FormErrorAlert, QueryBoundary } from '@/shared/components/query-state';
import { Screen, SplitLayout } from '@/shared/components/screen';
import { ShortagePanel } from '@/shared/components/shortage-panel';
import { ApiError } from '@/shared/lib/api';
import { nonNegativeInt, optionalText } from '@/shared/lib/form-schema';
import { useFormat } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { Shortage } from '@/shared/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import type { Approval } from '../../approval/types';
import { useSettings } from '../../system/settings/api';
import type { ProductionInput, ProductionResult, WorkOrderDetail } from '../types';
import { useWorkOrder, useWorkOrders } from '../work-orders/api';
import { useConfirmProduction, useRequestApproval } from './api';

/** RHF 는 숫자 키를 배열 인덱스로 해석하므로 LOT 사용량 필드는 'l<id>' 키를 씁니다. */
const lotKey = (lotId: number) => `l${lotId}`;
const parseUsage = (v: string | undefined) => {
  const n = Number((v ?? '').trim());
  return (v ?? '').trim() === '' || !Number.isFinite(n) ? 0 : n;
};
const round3 = (v: number) => Math.round(v * 1000) / 1000;

const schema = z
  .object({
    goodQty: nonNegativeInt(),
    defectQty: nonNegativeInt(),
    note: optionalText(500),
    usage: z.record(
      z.string(),
      z
        .string()
        .trim()
        .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), { error: 'validation.nonNegative' })
        .refine((v) => v === '' || Math.abs(Math.round(Number(v) * 1000) - Number(v) * 1000) < 1e-6, { error: 'validation.decimal3' }),
    ),
  })
  .refine((v) => v.goodQty + v.defectQty > 0, { path: ['goodQty'], error: 'validation.totalPositive' })
  .refine((v) => Object.values(v.usage).some((u) => parseUsage(u) > 0), { path: ['usage'], error: 'validation.atLeastOneLot' });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;
type Outcome = { kind: 'confirmed'; result: ProductionResult } | { kind: 'requested'; approval: Approval };

export function ProductionPage({ workOrderId }: { workOrderId?: number }) {
  const { t } = useTranslation();
  return (
    <Screen title={t('production.title')} description={t('production.description')}>
      <SplitLayout side={<OpenWorkOrderPicker selectedId={workOrderId} />}>
        {workOrderId ? (
          <ProductionEntry key={workOrderId} workOrderId={workOrderId} />
        ) : (
          <Panel>
            <EmptyState icon={<Factory />}>{t('production.selectWorkOrder')}</EmptyState>
          </Panel>
        )}
      </SplitLayout>
    </Screen>
  );
}

function OpenWorkOrderPicker({ selectedId }: { selectedId?: number }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const navigate = useNavigate();
  const query = useWorkOrders({ status: 'PLANNED', page: 1, pageSize: 100 });

  return (
    <Panel title={t('production.openWorkOrders')} actions={<Badge variant="warning">{fmt.number(query.data?.total ?? 0)}</Badge>} bodyClassName="p-0">
      <DataGrid
        columns={[
          {
            key: 'no',
            header: t('fields.workOrderNo'),
            cell: (wo) => (
              <div className="leading-tight">
                <CodeText className="font-medium">{wo.workOrderNo}</CodeText>
                <div className="sub-text">{fmt.date(wo.workDate)}</div>
              </div>
            ),
          },
          {
            key: 'item',
            header: t('fields.finishedGood'),
            wrap: true,
            cell: (wo) => (
              <>
                <ItemCell code={wo.item.code} name={wo.item.name} />
                {wo.pendingApproval && <Badge variant="info" className="mt-0.5">{t('workOrders.pendingApproval')}</Badge>}
              </>
            ),
          },
          { key: 'qty', header: t('fields.plannedQty'), align: 'right', cell: (wo) => fmt.number(wo.plannedQty) },
        ]}
        rows={query.data?.items}
        rowKey={(wo) => wo.id}
        query={query}
        selectedKey={selectedId}
        onRowClick={(wo) => void navigate({ to: '/production/results', search: { workOrderId: wo.id } })}
        emptyMessage={t('production.noOpenWorkOrders')}
        rowTestId={(wo) => `open-wo-${wo.workOrderNo}`}
      />
    </Panel>
  );
}

function ProductionEntry({ workOrderId }: { workOrderId: number }) {
  const { t } = useTranslation();
  const query = useWorkOrder(workOrderId);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  if (outcome?.kind === 'confirmed') return <ConfirmedResult result={outcome.result} />;
  if (outcome?.kind === 'requested') return <RequestedResult approval={outcome.approval} />;
  return (
    <Panel>
      <QueryBoundary query={query} lines={6}>
        {(wo) =>
          wo.status !== 'PLANNED' ? (
            <div className="space-y-3 py-8 text-center text-[13px]">
              <p>{t('errors.WORK_ORDER_ALREADY_CONFIRMED', { workOrderNo: wo.workOrderNo })}</p>
              <Button asChild variant="outline">
                <Link to="/production/work-orders/$workOrderId" params={{ workOrderId: String(wo.id) }}>
                  {t('production.viewWorkOrder')}
                </Link>
              </Button>
            </div>
          ) : wo.pendingApproval ? (
            <div className="space-y-3 py-8 text-center text-[13px]" data-testid="pending-approval">
              <p>{t('errors.APPROVAL_ALREADY_PENDING', { workOrderNo: wo.workOrderNo, requestNo: wo.pendingApproval.requestNo })}</p>
              <Button asChild variant="outline">
                <Link to="/approval/inbox">
                  <BadgeCheck /> {t('production.goToApprovals')}
                </Link>
              </Button>
            </div>
          ) : (
            <ProductionForm wo={wo} onDone={setOutcome} />
          )
        }
      </QueryBoundary>
    </Panel>
  );
}

function ProductionForm({ wo, onDone }: { wo: WorkOrderDetail; onDone: (o: Outcome) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const settings = useSettings();
  const approvalRequired = settings.data?.productionApprovalRequired ?? true;
  const confirm = useConfirmProduction();
  const request = useRequestApproval();
  const mutation = approvalRequired ? request : confirm;
  const [pending, setPending] = useState<FormValues | null>(null);

  const allLots = useMemo(() => wo.requirements.flatMap((r) => r.availableLots.map((l) => ({ ...l, req: r }))), [wo]);
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { goodQty: '', defectQty: '0', note: '', usage: Object.fromEntries(allLots.map((l) => [lotKey(l.id), ''])) },
  });
  const { errors } = form.formState;
  const usage = form.watch('usage');
  const good = Number(form.watch('goodQty')) || 0;
  const defect = Number(form.watch('defectQty')) || 0;
  const total = good + defect;

  // 화면 사전 재고 확인 (최종 판단은 서버 트랜잭션)
  const clientShortages: Shortage[] = allLots
    .map((l) => ({ l, qty: parseUsage(usage[lotKey(l.id)]) }))
    .filter(({ l, qty }) => qty > l.qty)
    .map(({ l, qty }) => ({ lotId: l.id, lotNo: l.lotNo, itemCode: l.req.componentCode, requestedQty: qty, availableQty: l.qty, shortageQty: round3(qty - l.qty) }));
  const serverShortages =
    mutation.error instanceof ApiError && mutation.error.code === 'INSUFFICIENT_STOCK'
      ? ((mutation.error.details?.shortages as Shortage[] | undefined) ?? [])
      : [];

  /** 예상 소요량을 선입선출(입고 순)로 LOT 에 자동 배분 */
  const autoAllocate = () => {
    for (const r of wo.requirements) {
      let remaining = r.requiredQty;
      for (const lot of r.availableLots) {
        const take = round3(Math.min(lot.qty, Math.max(remaining, 0)));
        form.setValue(`usage.${lotKey(lot.id)}`, take > 0 ? String(take) : '', { shouldValidate: true });
        remaining = round3(remaining - take);
      }
    }
  };

  const toInput = (v: FormValues): ProductionInput => ({
    workOrderId: wo.id,
    goodQty: v.goodQty,
    defectQty: v.defectQty,
    note: v.note || undefined,
    consumptions: allLots.map((l) => ({ lotId: l.id, qty: parseUsage(v.usage[lotKey(l.id)]) })).filter((c) => c.qty > 0),
  });

  const submit = (values: FormValues) => {
    const input = toInput(values);
    const done = () => setPending(null);
    if (approvalRequired) {
      request.mutate(input, {
        onSuccess: (approval) => {
          done();
          toast.success(t('toast.approvalRequested', { requestNo: approval.requestNo }));
          onDone({ kind: 'requested', approval });
        },
        onError: done,
      });
    } else {
      confirm.mutate(input, {
        onSuccess: (result) => {
          done();
          toast.success(t('toast.productionConfirmed', { resultNo: result.resultNo }));
          onDone({ kind: 'confirmed', result });
        },
        onError: done,
      });
    }
  };

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit((v) => setPending(v))}>
      {/* 작업지시 요약 + 양품/불량 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[14px] font-semibold">
          <CodeText>{wo.workOrderNo}</CodeText>
          <span className="font-normal text-muted-foreground">
            {wo.item.code} · {wo.item.name}
          </span>
          {wo.equipment && <Badge variant="outline">{wo.equipment.code}</Badge>}
        </div>
        <span className="flex items-center gap-2">
          <Badge variant={approvalRequired ? 'info' : 'secondary'} data-testid="approval-mode">
            {approvalRequired ? t('production.approvalMode') : t('production.directMode')}
          </Badge>
          <CodeBadge group="workOrderStatus" value={wo.status} />
        </span>
      </div>
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_1.2fr] gap-4">
        <div className="rounded-md border bg-muted/40 px-3 py-2">
          <div className="sub-text">{t('fields.plannedQty')}</div>
          <div className="text-xl font-bold tabular-nums" data-testid="planned-qty">
            {fmt.number(wo.plannedQty)} <span className="text-sm font-normal">{unitLabel(wo.item.unit)}</span>
          </div>
          <div className="sub-text">{fmt.date(wo.workDate)}</div>
        </div>
        <FormField label={t('fields.goodQty')} htmlFor="p-good" required error={errors.goodQty?.message}>
          <Input id="p-good" inputMode="numeric" className="h-10 text-right text-lg font-semibold" aria-invalid={!!errors.goodQty} {...form.register('goodQty')} />
        </FormField>
        <FormField label={t('fields.defectQty')} htmlFor="p-defect" required error={errors.defectQty?.message}>
          <Input id="p-defect" inputMode="numeric" className="h-10 text-right text-lg font-semibold text-destructive" aria-invalid={!!errors.defectQty} {...form.register('defectQty')} />
        </FormField>
        <div className="rounded-md border px-3 py-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('production.totalOutput')}</span>
            <b className="tabular-nums">{fmt.number(total)}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('production.vsPlan')}</span>
            <b className={cn('tabular-nums', total !== wo.plannedQty && total > 0 && 'text-warning-foreground')}>{fmt.signed(total - wo.plannedQty)}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('production.defectRate')}</span>
            <b className="tabular-nums">{total > 0 ? fmt.percent((defect / total) * 100) : '-'}</b>
          </div>
          <div className="sub-text mt-1">{good > 0 ? t('production.willIssueLot', { qty: fmt.number(good) }) : t('production.noFinishedLotHint')}</div>
        </div>
      </div>

      {/* 원자재 LOT 별 실제 사용량 */}
      <div className="rounded-md border">
        <div className="panel-header">
          <h3 className="panel-title">{t('production.materialsTitle')}</h3>
          <Button type="button" variant="outline" size="sm" onClick={autoAllocate}>
            <Wand2 /> {t('production.autoAllocate')}
          </Button>
        </div>
        <div className="divide-y">
          {wo.requirements.map((r) => {
            const entered = round3(r.availableLots.reduce((s, l) => s + parseUsage(usage[lotKey(l.id)]), 0));
            return (
              <div key={r.componentId}>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-muted/40 px-4 py-2 text-[13px]">
                  <span>
                    <CodeText className="font-semibold">{r.componentCode}</CodeText> {r.componentName}
                  </span>
                  <span className="text-muted-foreground">
                    {t('fields.qtyPer')} <b className="text-foreground tabular-nums">{fmt.number(r.qtyPer)}</b>
                  </span>
                  <span className="text-muted-foreground">
                    {t('fields.requiredQty')}{' '}
                    <b className="text-foreground tabular-nums">
                      {fmt.number(r.requiredQty)} {unitLabel(r.unit)}
                    </b>
                  </span>
                  <span className="text-muted-foreground">
                    {t('fields.stockQty')} <b className="text-foreground tabular-nums">{fmt.number(r.stockQty)}</b>
                  </span>
                  <span className="text-muted-foreground">
                    {t('production.enteredTotal')}{' '}
                    <b className={cn('tabular-nums', entered === r.requiredQty ? 'text-success' : 'text-foreground')} data-testid={`entered-${r.componentCode}`}>
                      {fmt.number(entered)} {unitLabel(r.unit)}
                    </b>
                  </span>
                </div>
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>{t('fields.lotNo')}</th>
                      <th>{t('fields.receiptDate')}</th>
                      <th>{t('fields.partner')}</th>
                      <th className="text-right">{t('fields.lotStock')}</th>
                      <th className="w-40 text-right">{t('fields.actualUsage')}</th>
                      <th className="text-right">{t('production.afterUsage')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.availableLots.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-5 text-center text-muted-foreground">
                          {t('production.noLots')}{' '}
                          <Link to="/inventory/receipts" className="text-link hover:underline">
                            {t('production.goToReceipts')}
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      r.availableLots.map((lot) => {
                        const used = parseUsage(usage[lotKey(lot.id)]);
                        const after = round3(lot.qty - used);
                        const fieldError = errors.usage?.[lotKey(lot.id)]?.message;
                        return (
                          <tr key={lot.id}>
                            <td className="code-text font-medium">{lot.lotNo}</td>
                            <td>{fmt.date(lot.receiptDate)}</td>
                            <td>{lot.partnerName ?? '-'}</td>
                            <td className="num" data-testid={`lot-stock-${lot.lotNo}`}>
                              {fmt.number(lot.qty)}
                            </td>
                            <td className="text-right">
                              <Input
                                inputMode="decimal"
                                aria-label={`${t('fields.actualUsage')} ${lot.lotNo}`}
                                data-testid={`usage-${lot.lotNo}`}
                                className="ml-auto h-7 w-32 text-right"
                                aria-invalid={!!fieldError || after < 0}
                                {...form.register(`usage.${lotKey(lot.id)}`)}
                              />
                              {fieldError && <div className="text-[12px] text-destructive">{t(fieldError)}</div>}
                            </td>
                            <td className={cn('num', after < 0 && 'font-semibold text-destructive')}>{fmt.number(after)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
        {errors.usage?.message || errors.usage?.root?.message ? (
          <p role="alert" className="border-t px-4 py-2 text-[12.5px] text-destructive">
            {t((errors.usage?.message ?? errors.usage?.root?.message) as string)}
          </p>
        ) : null}
      </div>

      <FormField label={t('fields.note')} htmlFor="p-note" error={errors.note?.message}>
        <Input id="p-note" placeholder={t('production.notePlaceholder')} {...form.register('note')} />
      </FormField>
      <ShortagePanel shortages={clientShortages} source="client" />
      {clientShortages.length === 0 && <ShortagePanel shortages={serverShortages} source="server" />}
      {mutation.error && serverShortages.length === 0 && <FormErrorAlert error={mutation.error} />}
      <div className="flex items-center justify-end gap-3">
        <span className="sub-text">{approvalRequired ? t('production.approvalHint') : t('production.directHint')}</span>
        <Button type="submit" size="lg" disabled={clientShortages.length > 0 || mutation.isPending}>
          <ClipboardCheck /> {t('production.reviewAndConfirm')}
        </Button>
      </div>

      {/* 확정(또는 결재 요청) 전 확인 */}
      <Dialog open={pending !== null} onOpenChange={(v) => !v && !mutation.isPending && setPending(null)}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{approvalRequired ? t('production.requestTitle') : t('production.confirmTitle')}</DialogTitle>
            <DialogDescription>{approvalRequired ? t('production.requestDescription') : t('production.confirmDescription')}</DialogDescription>
          </DialogHeader>
          {pending && (
            <div className="space-y-3 text-[13px]">
              <DescriptionList
                items={[
                  { label: t('fields.workOrderNo'), value: <CodeText>{wo.workOrderNo}</CodeText> },
                  { label: t('fields.finishedGood'), value: `${wo.item.code} ${wo.item.name}` },
                  {
                    label: t('fields.goodDefect'),
                    value: (
                      <span className="tabular-nums">
                        <b>{fmt.number(pending.goodQty)}</b> / <b className="text-destructive">{fmt.number(pending.defectQty)}</b>{' '}
                        <span className="text-muted-foreground">
                          ({t('fields.plannedQty')} {fmt.number(wo.plannedQty)})
                        </span>
                      </span>
                    ),
                  },
                ]}
              />
              <table className="grid-table rounded border">
                <thead>
                  <tr>
                    <th>{t('fields.inputLotNo')}</th>
                    <th className="text-right">{t('fields.actualUsage')}</th>
                    <th className="text-right">{t('production.afterUsage')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allLots
                    .filter((l) => parseUsage(pending.usage[lotKey(l.id)]) > 0)
                    .map((l) => {
                      const q = parseUsage(pending.usage[lotKey(l.id)]);
                      return (
                        <tr key={l.id}>
                          <td className="code-text">{l.lotNo}</td>
                          <td className="num">
                            {fmt.number(q)} {unitLabel(l.req.unit)}
                          </td>
                          <td className="num">{fmt.number(round3(l.qty - q))}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              <p className="rounded bg-muted/60 px-2 py-1.5 text-muted-foreground">
                {pending.goodQty > 0 ? t('production.willIssueLot', { qty: fmt.number(pending.goodQty) }) : t('production.noFinishedLotHint')}{' '}
                {approvalRequired ? t('production.approvalNote') : t('production.irreversible')}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setPending(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={mutation.isPending} onClick={() => pending && submit(pending)} data-testid="confirm-production">
              {approvalRequired ? <Send /> : <ClipboardCheck />}
              {mutation.isPending ? t('common.saving') : approvalRequired ? t('production.request') : t('production.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function RequestedResult({ approval }: { approval: Approval }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  return (
    <Panel title={t('production.requestedTitle')} icon={<Send />} data-testid="approval-requested">
      <div className="space-y-4 text-[13px]">
        <DescriptionList
          items={[
            { label: t('fields.requestNo'), value: <CodeText className="font-semibold">{approval.requestNo}</CodeText> },
            { label: t('fields.status'), value: <CodeBadge group="approvalStatus" value={approval.status} /> },
            { label: t('fields.workOrderNo'), value: <CodeText>{approval.workOrder.workOrderNo}</CodeText> },
            { label: t('fields.goodDefect'), value: `${fmt.number(approval.content.goodQty)} / ${fmt.number(approval.content.defectQty)}` },
            { label: t('fields.requester'), value: `${approval.requester.name} · ${approval.requester.department}` },
            { label: t('fields.requestedAt'), value: fmt.dateTime(approval.requestedAt) },
          ]}
        />
        <p className="rounded bg-muted/60 px-3 py-2 text-muted-foreground">{t('production.requestedNote')}</p>
        <Button asChild>
          <Link to="/approval/inbox">
            <BadgeCheck /> {t('production.goToApprovals')}
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

function ConfirmedResult({ result }: { result: ProductionResult }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  return (
    <Panel title={<span className="text-success">{t('production.confirmedTitle')}</span>} icon={<CheckCircle2 />} data-testid="production-result">
      <div className="space-y-4 text-[13px]">
        <DescriptionList
          items={[
            { label: t('fields.resultNo'), value: <CodeText>{result.resultNo}</CodeText> },
            {
              label: t('fields.workOrderNo'),
              value: (
                <Link to="/production/work-orders/$workOrderId" params={{ workOrderId: String(result.workOrder.id) }} className="code-link">
                  {result.workOrder.workOrderNo}
                </Link>
              ),
            },
            {
              label: t('fields.goodDefect'),
              value: (
                <span className="tabular-nums">
                  {fmt.number(result.goodQty)} / <span className="text-destructive">{fmt.number(result.defectQty)}</span>
                </span>
              ),
            },
            {
              label: t('fields.finishedLotNo'),
              value: result.finishedLot ? (
                <span>
                  <CodeText className="font-semibold">
                    <span data-testid="finished-lot-no">{result.finishedLot.lotNo}</span>
                  </CodeText>{' '}
                  <span className="tabular-nums text-muted-foreground">
                    ({fmt.number(result.finishedLot.qty)} {unitLabel(result.workOrder.item.unit)})
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">{t('production.noFinishedLot')}</span>
              ),
            },
            { label: t('fields.confirmedAt'), value: fmt.dateTime(result.confirmedAt) },
            {
              label: t('production.consumedLots'),
              value: result.consumptions.map((c) => (
                <div key={c.lotId}>
                  <LotLink lotNo={c.lotNo} /> — {fmt.number(c.qty)} {unitLabel(c.unit)}
                </div>
              )),
            },
          ]}
        />
        <div className="flex gap-2">
          {result.finishedLot && (
            <Button asChild>
              <Link to="/inventory/lot-trace" search={{ lotNo: result.finishedLot.lotNo }}>
                <GitBranch /> {t('production.traceLot')}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/inventory/stock">{t('production.viewInventory')}</Link>
          </Button>
        </div>
      </div>
    </Panel>
  );
}
