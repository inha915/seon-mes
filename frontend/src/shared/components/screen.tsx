import type { ReactNode } from 'react';

/**
 * 화면 머리글 — 모든 업무 화면의 최상단. 제목·설명과 화면 단위 버튼(신규 등)을 둡니다.
 * 대분류 › 모듈 경로는 상단 헤더의 브레드크럼이 표시합니다.
 */
export function Screen({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** 좌측 입력 패널 + 우측 목록 같은 2단 업무 화면 레이아웃 */
export function SplitLayout({ side, children, sideWidth = 340 }: { side: ReactNode; children: ReactNode; sideWidth?: number }) {
  return (
    <div className="grid items-start gap-4" style={{ gridTemplateColumns: `${sideWidth}px minmax(0, 1fr)` }}>
      <div className="min-w-0 space-y-4">{side}</div>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}
