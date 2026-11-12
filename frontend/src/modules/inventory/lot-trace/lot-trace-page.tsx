import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Building2, ClipboardList, Factory, GitBranch, History, Package, PackageCheck, Search, Truck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CodeBadge, CodeText, LotLink, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid } from '@/shared/components/data-grid';
import { Panel } from '@/shared/components/panel';
import { EmptyState, ErrorState, LoadingBlock } from '@/shared/components/query-state';
import { Screen } from '@/shared/components/screen';
import { ApiError } from '@/shared/lib/api';
import { useFormat } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useLotStock, useLotTrace } from '../stock/api';
import type { LotTrace } from '../types';

export function LotTracePage({ lotNo }: { lotNo?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [input, setInput] = useState(lotNo ?? '');
  useEffect(() => setInput(lotNo ?? ''), [lotNo]);
  const query = useLotTrace(lotNo);
  const recentFinished = useLotStock({ type: 'FINISHED', includeEmpty: true, page: 1, pageSize: 6 });
  const go = (value: string) => void navigate({ to: '/inventory/lot-trace', search: { lotNo: value.trim().toUpperCase() || undefined } });

  return (
    <Screen title={t('lotTrace.title')} description={t('lotTrace.description')}>
      <Panel bodyClassName="p-0">
        <div className="search-panel border-b-0">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go(input);
            }}
          >
            <label className="search-field">
              <span className="field-label">{t('fields.lotNo')}</span>
              <Input className="w-72 font-mono" placeholder={t('lotTrace.placeholder')} value={input} onChange={(e) => setInput(e.target.value)} data-testid="trace-input" />
            </label>
            <Button type="submit">
              <Search /> {t('lotTrace.trace')}
            </Button>
          </form>
          {recentFinished.data && recentFinished.data.items.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 self-end pb-1 text-[12.5px]">
              <span className="text-muted-foreground">{t('lotTrace.recentFinished')}</span>
              {recentFinished.data.items.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => go(l.lotNo)}
                  className={cn('code-text rounded border bg-card px-1.5 py-0.5 hover:border-primary hover:text-primary', l.lotNo === lotNo && 'border-primary text-primary')}
                >
                  {l.lotNo}
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {!lotNo ? (
        <Panel>
          <EmptyState icon={<GitBranch />}>{t('lotTrace.empty')}</EmptyState>
        </Panel>
      ) : query.isPending ? (
        <Panel>
          <LoadingBlock lines={6} />
        </Panel>
      ) : query.isError ? (
        <Panel>
          {query.error instanceof ApiError && query.error.code === 'NOT_FOUND' ? (
            <EmptyState>{t('lotTrace.notFound', { lotNo })}</EmptyState>
          ) : (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          )}
        </Panel>
      ) : (
        <TraceView trace={query.data} />
      )}
    </Screen>
  );
}

function TraceView({ trace }: { trace: LotTrace }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const { lot } = trace;
  const unit = unitLabel(lot.item.unit);
  const finished = lot.item.type === 'FINISHED';

  return (
    <>
      <Panel title={finished ? t('lotTrace.backwardTitle') : t('lotTrace.rawTitle')} icon={<GitBranch />} actions={<CodeBadge group="itemType" value={lot.item.type} />}>
        {finished ? (
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1" data-testid="trace-flow">
            <Node icon={<PackageCheck />} tone="primary" title={t('lotTrace.finishedLot')}>
              <div className="code-text text-[14px] font-bold">{lot.lotNo}</div>
              <div>
                <CodeText>{lot.item.code}</CodeText> {lot.item.name}
              </div>
              <div className="tabular-nums">
                {t('fields.producedQty')} {fmt.number(lot.initialQty)} {unit} · {t('fields.lotStock')} {fmt.number(lot.qty)} {unit}
              </div>
            </Node>
            <Arrow />
            {trace.production && (
              <>
                <Node icon={<ClipboardList />} title={t('lotTrace.workOrderResult')}>
                  <Link
                    to="/production/work-orders/$workOrderId"
                    params={{ workOrderId: String(trace.production.workOrder.id) }}
                    className="code-link text-[14px] font-bold"
                  >
                    {trace.production.workOrder.workOrderNo}
                  </Link>
                  <div>
                    {t('fields.resultNo')} <CodeText>{trace.production.resultNo}</CodeText>
                  </div>
                  <div className="tabular-nums">
                    {t('fields.plannedQty')} {fmt.number(trace.production.workOrder.plannedQty)} · {t('fields.goodQty')} {fmt.number(trace.production.goodQty)} ·{' '}
                    {t('fields.defectQty')} <span className="text-destructive">{fmt.number(trace.production.defectQty)}</span>
                  </div>
                  <div className="text-muted-foreground">{fmt.dateTime(trace.production.confirmedAt)}</div>
                </Node>
                <Arrow />
              </>
            )}
            <div className="flex flex-col gap-2">
              {trace.materials.map((m) => (
                <div key={m.lot.id} className="flex items-stretch gap-2">
                  <Node icon={<Package />} title={t('lotTrace.inputLot')}>
                    <LotLink lotNo={m.lot.lotNo} className="text-[14px] font-bold" />
                    <div>
                      <CodeText>{m.item.code}</CodeText> {m.item.name}
                    </div>
                    <div className="tabular-nums">
                      {t('fields.actualUsage')} <b>{fmt.number(m.consumedQty)}</b> {unitLabel(m.item.unit)} · {t('fields.lotStock')} {fmt.number(m.lot.qty)}
                    </div>
                  </Node>
                  <Arrow />
                  <Node icon={<Building2 />} title={t('lotTrace.firstReceipt')}>
                    {m.receipt ? (
                      <>
                        <div className="code-text text-[14px] font-bold">{m.receipt.receiptNo}</div>
                        <div>{m.receipt.partner.name}</div>
                        <div className="tabular-nums">
                          {fmt.date(m.receipt.receiptDate)} · {fmt.number(m.receipt.qty)} {unitLabel(m.item.unit)}
                        </div>
                        {m.receipt.supplierLotNo && (
                          <div className="text-muted-foreground">
                            {t('fields.supplierLotNo')} <CodeText>{m.receipt.supplierLotNo}</CodeText>
                          </div>
                        )}
                      </>
                    ) : (
                      '-'
                    )}
                  </Node>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-stretch gap-2" data-testid="trace-flow">
            <Node icon={<Building2 />} title={t('lotTrace.firstReceipt')}>
              {trace.receipt ? (
                <>
                  <div className="code-text text-[14px] font-bold">{trace.receipt.receiptNo}</div>
                  <div>{trace.receipt.partner.name}</div>
                  <div className="tabular-nums">
                    {fmt.date(trace.receipt.receiptDate)} · {fmt.number(trace.receipt.qty)} {unit}
                  </div>
                </>
              ) : (
                '-'
              )}
            </Node>
            <Arrow forward />
            <Node icon={<Package />} tone="primary" title={t('lotTrace.rawLot')}>
              <div className="code-text text-[14px] font-bold">{lot.lotNo}</div>
              <div>
                <CodeText>{lot.item.code}</CodeText> {lot.item.name}
              </div>
              <div className="tabular-nums">
                {t('fields.initialQty')} {fmt.number(lot.initialQty)} {unit} · {t('fields.lotStock')} <b>{fmt.number(lot.qty)}</b> {unit}
              </div>
            </Node>
          </div>
        )}
      </Panel>

      {finished ? (
        <Panel title={t('lotTrace.shippedTo')} icon={<Truck />} bodyClassName="p-0" data-testid="trace-shipments">
          <DataGrid
            columns={[
              { key: 'no', header: t('fields.shipmentNo'), cell: (s) => <CodeText>{s.shipmentNo}</CodeText> },
              { key: 'date', header: t('fields.shipDate'), cell: (s) => fmt.date(s.shipDate) },
              {
                key: 'order',
                header: t('fields.orderNo'),
                cell: (s) => (
                  <Link to="/sales/orders/$salesOrderId" params={{ salesOrderId: String(s.salesOrder.id) }} className="code-link">
                    {s.salesOrder.orderNo}
                  </Link>
                ),
              },
              { key: 'customer', header: t('fields.customer'), cell: (s) => `${s.customer.code} · ${s.customer.name}` },
              { key: 'qty', header: t('fields.shipQty'), align: 'right', cell: (s) => `${fmt.number(s.qty)} ${unit}` },
            ]}
            rows={trace.shipments}
            rowKey={(s) => s.shipmentId}
            emptyMessage={t('lotTrace.notShipped')}
          />
        </Panel>
      ) : (
        <Panel title={t('lotTrace.usedIn')} icon={<Factory />} bodyClassName="p-0">
          <DataGrid
            columns={[
              {
                key: 'wo',
                header: t('fields.workOrderNo'),
                cell: (u) => (
                  <Link to="/production/work-orders/$workOrderId" params={{ workOrderId: String(u.workOrder.id) }} className="code-link">
                    {u.workOrder.workOrderNo}
                  </Link>
                ),
              },
              { key: 'result', header: t('fields.resultNo'), cell: (u) => <CodeText>{u.resultNo}</CodeText> },
              { key: 'item', header: t('fields.finishedGood'), cell: (u) => `${u.item.code} ${u.item.name}` },
              { key: 'qty', header: t('fields.actualUsage'), align: 'right', cell: (u) => `${fmt.number(u.consumedQty)} ${unit}` },
              {
                key: 'fg',
                header: t('fields.finishedLotNo'),
                cell: (u) => (u.finishedLotNo ? <LotLink lotNo={u.finishedLotNo} /> : <span className="text-muted-foreground">{t('production.noFinishedLot')}</span>),
              },
              { key: 'at', header: t('fields.confirmedAt'), cell: (u) => <span className="text-muted-foreground">{fmt.dateTime(u.confirmedAt)}</span> },
            ]}
            rows={trace.usedIn}
            rowKey={(u) => u.resultId}
            emptyMessage={t('lotTrace.notUsedYet')}
          />
        </Panel>
      )}

      <Panel title={t('lotTrace.ledger')} icon={<History />} bodyClassName="p-0">
        <DataGrid
          columns={[
            { key: 'at', header: t('fields.occurredAt'), cell: (tx) => <span className="text-muted-foreground">{fmt.dateTime(tx.occurredAt)}</span> },
            { key: 'type', header: t('fields.txType'), cell: (tx) => <CodeBadge group="inventoryTxType" value={tx.type} /> },
            {
              key: 'qty',
              header: t('fields.changeQty'),
              align: 'right',
              cell: (tx) => <b className={tx.qty < 0 ? 'text-destructive' : 'text-success'}>{`${fmt.signed(tx.qty)} ${unit}`}</b>,
            },
            { key: 'bal', header: t('fields.balanceAfter'), align: 'right', cell: (tx) => fmt.number(tx.balanceAfter) },
          ]}
          rows={trace.transactions}
          rowKey={(tx) => tx.id}
        />
      </Panel>
    </>
  );
}

function Node({ icon, title, tone, children }: { icon: ReactNode; title: string; tone?: 'primary'; children: ReactNode }) {
  return (
    <div className={cn('min-w-56 rounded-md border bg-card px-3 py-2 text-[12.5px] shadow-xs [&_svg]:size-3.5', tone === 'primary' && 'border-primary/40 bg-primary/5')}>
      <div className="mb-1 flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/** 역추적 방향(←). 원자재 이력은 정방향(→) */
function Arrow({ forward }: { forward?: boolean }) {
  return (
    <div className="flex items-center text-muted-foreground/60">
      <ArrowLeft className={cn('size-5', forward && 'rotate-180')} />
    </div>
  );
}
