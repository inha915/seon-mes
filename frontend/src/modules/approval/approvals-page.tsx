import { Link } from '@tanstack/react-router';
import { BadgeCheck, Ban, FileText, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CodeBadge, CodeText, ItemCell, LotLink, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid, type GridColumn } from '@/shared/components/data-grid';
import { DescriptionList, StatBox } from '@/shared/components/description-list';
import { FormField } from '@/shared/components/form-field';
import { Panel } from '@/shared/components/panel';
import { EmptyState, FormErrorAlert, QueryBoundary } from '@/shared/components/query-state';
import { Screen } from '@/shared/components/screen';
import { SearchField, SearchPanel } from '@/shared/components/search-panel';
import { ShortagePanel } from '@/shared/components/shortage-panel';
import { codeKey, codeValues } from '@/shared/codes';
import { useCurrentUser } from '@/shared/hooks/use-current-user';
import { ApiError } from '@/shared/lib/api';
import { useFormat } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { ApprovalStatus, Shortage } from '@/shared/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import { Textarea } from '@/shared/ui/textarea';
import { useApproval, useApprovals, useDecideApproval } from './api';
import type { Approval } from './types';

const PAGE_SIZE = 12;
type Filter = { q: string; status: ApprovalStatus | '' };
const DEFAULT: Filter = { q: '', status: 'PENDING' };

export function ApprovalsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [draft, setDraft] = useState(DEFAULT);
  const [filter, setFilter] = useState(DEFAULT);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const query = useApprovals({ q: filter.q || undefined, status: filter.status || undefined, page, pageSize: PAGE_SIZE });

  const columns: GridColumn<Approval>[] = [
    { key: 'no', header: t('fields.requestNo'), cell: (a) => <CodeText>{a.requestNo}</CodeText> },
    { key: 'wo', header: t('fields.workOrderNo'), cell: (a) => <CodeText>{a.workOrder.workOrderNo}</CodeText> },
    { key: 'req', header: t('fields.requester'), cell: (a) => a.requester.name },
    { key: 'at', header: t('fields.requestedAt'), cell: (a) => <span className="text-muted-foreground">{fmt.dateTime(a.requestedAt)}</span> },
    { key: 'status', header: t('fields.status'), cell: (a) => <CodeBadge group="approvalStatus" value={a.status} /> },
  ];

  return (
    <Screen title={t('approvals.title')} description={t('approvals.description')}>
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-4">
        <Panel title={t('approvals.listTitle')} bodyClassName="p-0">
          <SearchPanel
            onSearch={() => {
              setPage(1);
              setFilter({ ...draft, q: draft.q.trim() });
            }}
            onReset={() => {
              setDraft(DEFAULT);
              setFilter(DEFAULT);
              setPage(1);
            }}
          >
            <SearchField label={t('fields.status')}>
              <NativeSelect className="w-28" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Filter['status'] })}>
                <option value="">{t('common.all')}</option>
                {codeValues('approvalStatus').map((s) => (
                  <option key={s} value={s}>
                    {t(codeKey('approvalStatus', s))}
                  </option>
                ))}
              </NativeSelect>
            </SearchField>
            <SearchField label={t('common.keyword')}>
              <Input className="w-44" placeholder={t('approvals.searchPlaceholder')} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
            </SearchField>
          </SearchPanel>
          <DataGrid
            columns={columns}
            rows={query.data?.items}
            rowKey={(a) => a.id}
            query={query}
            selectedKey={selected}
            onRowClick={(a) => setSelected(a.id)}
            rowTestId={(a) => `approval-${a.requestNo}`}
            emptyMessage={t('approvals.empty')}
            pagination={query.data && { page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: setPage }}
          />
        </Panel>
        <Panel title={t('approvals.documentTitle')} icon={<FileText />}>
          {selected === null ? <EmptyState icon={<FileText />}>{t('approvals.selectHint')}</EmptyState> : <ApprovalDocument key={selected} id={selected} />}
        </Panel>
      </div>
    </Screen>
  );
}

function ApprovalDocument({ id }: { id: number }) {
  const query = useApproval(id);
  return <QueryBoundary query={query}>{(a) => <DocumentBody approval={a} />}</QueryBoundary>;
}

function DocumentBody({ approval: a }: { approval: Approval }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const { user, isApprover } = useCurrentUser();
  const decide = useDecideApproval();
  const [comment, setComment] = useState('');
  const pending = a.status === 'PENDING';
  const isRequester = user?.id === a.requester.id;
  const shortages =
    decide.error instanceof ApiError && decide.error.code === 'INSUFFICIENT_STOCK'
      ? ((decide.error.details?.shortages as Shortage[] | undefined) ?? [])
      : [];

  const act = (decision: 'approve' | 'reject' | 'cancel') =>
    decide.mutate(
      { id: a.id, decision, comment },
      {
        onSuccess: (r) => {
          setComment('');
          toast.success(t(`toast.approval_${decision}`, { requestNo: r.requestNo }));
        },
      },
    );

  return (
    <div className="space-y-4" data-testid="approval-document">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CodeText className="text-[15px] font-bold">{a.requestNo}</CodeText>
          <CodeBadge group="approvalDocType" value={a.docType} />
        </div>
        <CodeBadge group="approvalStatus" value={a.status} />
      </div>

      {/* 결재선 */}
      <div className="grid grid-cols-2 overflow-hidden rounded-md border text-center text-[12.5px]">
        <div className="border-r">
          <div className="bg-grid-header py-1 font-semibold text-muted-foreground">{t('approvals.requesterLine')}</div>
          <div className="py-2">
            <div className="font-semibold">{a.requester.name}</div>
            <div className="sub-text">{a.requester.department}</div>
            <div className="sub-text">{fmt.dateTime(a.requestedAt)}</div>
          </div>
        </div>
        <div>
          <div className="bg-grid-header py-1 font-semibold text-muted-foreground">{t('approvals.approverLine')}</div>
          <div className={cn('py-2', !a.approver && 'text-muted-foreground')}>
            {a.approver ? (
              <>
                <div className="font-semibold">{a.approver.name}</div>
                <div className="sub-text">{a.approver.department}</div>
                <div className="sub-text">{fmt.dateTime(a.decidedAt)}</div>
              </>
            ) : (
              <div className="py-3">{t('approvals.waiting')}</div>
            )}
          </div>
        </div>
      </div>

      <DescriptionList
        items={[
          {
            label: t('fields.workOrderNo'),
            value: (
              <Link to="/production/work-orders/$workOrderId" params={{ workOrderId: String(a.workOrder.id) }} className="code-link">
                {a.workOrder.workOrderNo}
              </Link>
            ),
          },
          { label: t('fields.finishedGood'), value: <ItemCell code={a.workOrder.item.code} name={a.workOrder.item.name} /> },
          { label: t('fields.note'), value: a.content.note ?? '-' },
          ...(a.comment ? [{ label: t('fields.comment'), value: a.comment }] : []),
        ]}
      />
      <div className="grid grid-cols-3 gap-2">
        <StatBox label={t('fields.plannedQty')} value={`${fmt.number(a.workOrder.plannedQty)} ${unitLabel(a.workOrder.item.unit)}`} />
        <StatBox label={t('fields.goodQty')} value={fmt.number(a.content.goodQty)} />
        <StatBox label={t('fields.defectQty')} value={<span className="text-destructive">{fmt.number(a.content.defectQty)}</span>} />
      </div>
      <div className="rounded-md border">
        <DataGrid
          columns={[
            { key: 'lot', header: t('fields.inputLotNo'), cell: (c) => <LotLink lotNo={c.lotNo} /> },
            { key: 'item', header: t('fields.itemCode'), cell: (c) => <CodeText>{c.itemCode}</CodeText> },
            { key: 'qty', header: t('fields.actualUsage'), align: 'right', cell: (c) => `${fmt.number(c.qty)} ${unitLabel(c.unit)}` },
            {
              key: 'cur',
              header: t('fields.lotStock'),
              align: 'right',
              cell: (c) => <span className={cn(pending && c.currentQty < c.qty && 'font-semibold text-destructive')}>{fmt.number(c.currentQty)}</span>,
            },
          ]}
          rows={a.content.consumptions}
          rowKey={(c) => c.lotId}
        />
      </div>

      {a.result && (
        <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-[13px]">
          {t('approvals.resultCreated')} <CodeText>{a.result.resultNo}</CodeText>
          {a.result.finishedLotNo && (
            <>
              {' · '}
              <LotLink lotNo={a.result.finishedLotNo} />
            </>
          )}
        </div>
      )}

      <ShortagePanel shortages={shortages} source="server" note={t('approvals.shortageNote')} />
      {decide.error && shortages.length === 0 && <FormErrorAlert error={decide.error} />}

      {pending && (isApprover || isRequester) && (
        <div className="space-y-2 border-t pt-3">
          {isApprover && (
            <FormField label={t('fields.comment')} htmlFor="ap-comment">
              <Textarea id="ap-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('approvals.commentPlaceholder')} />
            </FormField>
          )}
          <div className="flex justify-end gap-2">
            {isRequester && (
              <Button variant="outline" disabled={decide.isPending} onClick={() => act('cancel')}>
                <Undo2 /> {t('approvals.cancel')}
              </Button>
            )}
            {isApprover && (
              <>
                <Button variant="outline" className="text-destructive" disabled={decide.isPending} onClick={() => act('reject')} data-testid="reject-approval">
                  <Ban /> {t('approvals.reject')}
                </Button>
                <Button disabled={decide.isPending} onClick={() => act('approve')} data-testid="approve-approval">
                  <BadgeCheck /> {decide.isPending ? t('common.saving') : t('approvals.approve')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {pending && !isApprover && !isRequester && <p className="sub-text border-t pt-3">{t('approvals.noPermission')}</p>}
    </div>
  );
}
