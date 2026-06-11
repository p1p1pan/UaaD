import type { ReactNode } from 'react';

interface MerchantPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function MerchantPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: MerchantPageHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-rose-100 bg-[linear-gradient(135deg,#fff8f3_0%,#fff1eb_58%,#ffe3d8_100%)] px-6 py-6 shadow-[0_24px_80px_-52px_rgba(244,63,94,0.24)] sm:px-8 sm:py-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.12),transparent_24%)]" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <span className="inline-flex items-center rounded-full border border-rose-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-500">
            {eyebrow}
          </span>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-[2rem]">
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            {description}
          </p>
        </div>
        {actions ? <div className="relative flex shrink-0 items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
