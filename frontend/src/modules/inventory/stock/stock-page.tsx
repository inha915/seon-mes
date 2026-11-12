import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodeBadge, CodeText, ItemCell, LotLink, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid, type GridColumn } from '@/shared/components/data-grid';
import { Panel } from '@/shared/components/panel';
import { Screen } from '@/shared/components/screen';
import { DateRangeField, SearchField, SearchPanel } from '@/shared/components/search-panel';
import { codeKey, codeValues } from '@/shared/codes';
import { useFormat } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { InventoryTxType, ItemType } from '@/shared/types';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import type { InventoryTransaction, ItemStock, LotStock } from '../types';
import { useItemStock, useLotStock, useTransactions, type StockFilter } from './api';

export type StockTab = 'items' | 'lots' | 'transactions';
const PAGE_SIZE = 15;

type Draft = { q: string; lotNo: string; type: ItemType | ''; from: string; to: string; includeEmpty: boolean; txType: InventoryTxType | '' };
const EMPTY: Draft = { q: '', lotNo: '', type: '', from: '', to: '', includeEmpty: false, txType: '' };

export function StockPage({ tab }: { tab: StockTab }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);

  const filter: StockFilter = {
    q: applied.q || undefined,
    lotNo: applied.lotNo || undefined,
    type: applied.type || undefined,
    from: applied.from || undefined,
    to: applied.to || undefined,
    includeEmpty: applied.includeEmpty || undefined,
    txType: applied.txType || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const tabs: { key: StockTab; label: string }[] = [
    { key: 'items', label: t('inventory.tabs.items') },
    { key: 'lots', label: t('inventory.tabs.lots') },
    { key: 'transactions', label: t('inventory.tabs.transactions') },
  ];

  return (
    <Screen title={t('inventory.title')} description={t('inventory.description')}>
      <Panel bodyClassName="p-0">
        <div className="flex gap-1 border-b px-3 pt-2" role="tablist">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              role="tab"
              aria-selected={tab === tb.key}
              onClick={() => {
                setPage(1);
                void navigate({ to: '/inventory/stock', search: { tab: tb.key } });
              }}
              className={cn(
                '-mb-px border-b-2 px-3 py-1.5 text-[13px] font-medium transition-colors',
                tab === tb.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>

        <SearchPanel
          onSearch={() => {
            setPage(1);
            setApplied({ ...draft, q: draft.q.trim(), lotNo: draft.lotNo.trim() });
          }}
          onReset={() => {
            setDraft(EMPTY);
            setApplied(EMPTY);
            setPage(1);
          }}
        >
          {tab !== 'transactions' ? (
            <SearchField label={t('fields.type')}>
              <NativeSelect className="w-32" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft['type'] })}>
                <option value="">{t('common.all')}</option>
                <option value="RAW">{t('codes.itemType.RAW')}</option>
                <option value="FINISHED">{t('codes.itemType.FINISHED')}</option>
              </NativeSelect>
            </SearchField>
          ) : (
            <SearchField label={t('fields.txType')}>
              <NativeSelect className="w-36" value={draft.txType} onChange={(e) => setDraft({ ...draft, txType: e.target.value as Draft['txType'] })}>
                <option value="">{t('common.all')}</option>
                {codeValues('inventoryTxType').map((tt) => (
                  <option key={tt} value={tt}>
                    {t(codeKey('inventoryTxType', tt))}
                  </option>
                ))}
              </NativeSelect>
            </SearchField>
          )}
          <SearchField label={t('fields.item')}>
            <Input className="w-44" placeholder={t('inventory.itemSearchPlaceholder')} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          </SearchField>
          {tab !== 'items' && (
            <>
              <SearchField label={t('fields.lotNo')}>
                <Input className="w-40" placeholder={t('inventory.lotSearchPlaceholder')} value={draft.lotNo} onChange={(e) => setDraft({ ...draft, lotNo: e.target.value })} />
              </SearchField>
              <DateRangeField label={t('common.period')} from={draft.from} to={draft.to} onChange={(r) => setDraft({ ...draft, ...r })} />
            </>
          )}
          {tab === 'lots' && (
            <label className="flex h-8 items-center gap-1.5 self-end text-[13px]">
              <input type="checkbox" checked={draft.includeEmpty} onChange={(e) => setDraft({ ...draft, includeEmpty: e.target.checked })} />
              {t('inventory.includeEmpty')}
            </label>
          )}
        </SearchPanel>

        {tab === 'items' && <ItemStockGrid filter={filter} onPage={setPage} />}
        {tab === 'lots' && <LotStockGrid filter={filter} onPage={setPage} />}
        {tab === 'transactions' && <TransactionGrid filter={filter} onPage={setPage} />}
      </Panel>
    </Screen>
  );
}

function ItemStockGrid({ filter, onPage }: { filter: StockFilter; onPage: (p: number) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const query = useItemStock(filter);
  const columns: GridColumn<ItemStock>[] = [
    { key: 'type', header: t('fields.type'), cell: (r) => <CodeBadge group="itemType" value={r.type} /> },
    { key: 'code', header: t('fields.itemCode'), cell: (r) => <CodeText>{r.code}</CodeText> },
    { key: 'name', header: t('fields.itemName'), cell: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'stock',
      header: t('fields.stockQty'),
      align: 'right',
      cell: (r) => (
        <span className={cn('font-semibold', r.stockQty === 0 && 'text-muted-foreground')} data-testid={`stock-qty-${r.code}`}>
          {fmt.number(r.stockQty)}
        </span>
      ),
    },
    { key: 'unit', header: t('fields.unit'), cell: (r) => unitLabel(r.unit) },
    { key: 'lots', header: t('inventory.activeLots'), align: 'right', cell: (r) => fmt.number(r.activeLotCount) },
  ];
  return (
    <DataGrid
      columns={columns}
      rows={query.data?.items}
      rowKey={(r) => r.id}
      query={query}
      pagination={query.data && { page: filter.page!, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: onPage }}
    />
  );
}

function LotStockGrid({ filter, onPage }: { filter: StockFilter; onPage: (p: number) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const query = useLotStock(filter);
  const columns: GridColumn<LotStock>[] = [
    { key: 'lot', header: t('fields.lotNo'), cell: (l) => <LotLink lotNo={l.lotNo} className="font-medium" /> },
    { key: 'type', header: t('fields.type'), cell: (l) => <CodeBadge group="itemType" value={l.item.type} /> },
    { key: 'item', header: t('fields.item'), wrap: true, cell: (l) => <ItemCell code={l.item.code} name={l.item.name} /> },
    { key: 'initial', header: t('fields.initialQty'), align: 'right', cell: (l) => <span className="text-muted-foreground">{fmt.number(l.initialQty)}</span> },
    { key: 'qty', header: t('fields.lotStock'), align: 'right', cell: (l) => <b>{`${fmt.number(l.qty)} ${unitLabel(l.item.unit)}`}</b> },
    {
      key: 'source',
      header: t('inventory.source'),
      wrap: true,
      cell: (l) =>
        l.source?.kind === 'RECEIPT' ? (
          <span className="text-[12.5px]">
            {t('inventory.sourceReceipt')} · <CodeText>{l.source.receiptNo}</CodeText> · {l.source.partnerName}
          </span>
        ) : l.source?.kind === 'PRODUCTION' ? (
          <span className="text-[12.5px]">
            {t('inventory.sourceProduction')} ·{' '}
            <Link to="/production/work-orders/$workOrderId" params={{ workOrderId: String(l.source.workOrderId) }} className="code-link">
              {l.source.workOrderNo}
            </Link>
          </span>
        ) : (
          '-'
        ),
    },
    { key: 'created', header: t('common.createdAt'), cell: (l) => <span className="text-muted-foreground">{fmt.dateTime(l.createdAt)}</span> },
  ];
  return (
    <DataGrid
      columns={columns}
      rows={query.data?.items}
      rowKey={(l) => l.id}
      query={query}
      pagination={query.data && { page: filter.page!, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: onPage }}
    />
  );
}

function TransactionGrid({ filter, onPage }: { filter: StockFilter; onPage: (p: number) => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const query = useTransactions(filter);
  const columns: GridColumn<InventoryTransaction>[] = [
    { key: 'at', header: t('fields.occurredAt'), cell: (tx) => <span className="text-muted-foreground">{fmt.dateTime(tx.occurredAt)}</span> },
    { key: 'type', header: t('fields.txType'), cell: (tx) => <CodeBadge group="inventoryTxType" value={tx.type} /> },
    { key: 'lot', header: t('fields.lotNo'), cell: (tx) => <LotLink lotNo={tx.lot.lotNo} /> },
    { key: 'item', header: t('fields.item'), wrap: true, cell: (tx) => <ItemCell code={tx.item.code} name={tx.item.name} /> },
    {
      key: 'qty',
      header: t('fields.changeQty'),
      align: 'right',
      cell: (tx) => <b className={tx.qty < 0 ? 'text-destructive' : 'text-success'}>{`${fmt.signed(tx.qty)} ${unitLabel(tx.item.unit)}`}</b>,
    },
    { key: 'bal', header: t('fields.balanceAfter'), align: 'right', cell: (tx) => fmt.number(tx.balanceAfter) },
    {
      key: 'ref',
      header: t('inventory.reference'),
      wrap: true,
      cell: (tx) =>
        tx.reference?.kind === 'RECEIPT' ? (
          <CodeText>{tx.reference.no}</CodeText>
        ) : tx.reference?.kind === 'PRODUCTION' ? (
          <span className="text-[12.5px]">
            <CodeText>{tx.reference.no}</CodeText> ·{' '}
            <Link to="/production/work-orders/$workOrderId" params={{ workOrderId: String(tx.reference.workOrderId) }} className="code-link">
              {tx.reference.workOrderNo}
            </Link>
          </span>
        ) : tx.reference?.kind === 'SHIPMENT' ? (
          <span className="text-[12.5px]">
            <CodeText>{tx.reference.no}</CodeText> · {tx.reference.customerName}
          </span>
        ) : (
          '-'
        ),
    },
  ];
  return (
    <DataGrid
      columns={columns}
      rows={query.data?.items}
      rowKey={(tx) => tx.id}
      query={query}
      pagination={query.data && { page: filter.page!, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: onPage }}
    />
  );
}
