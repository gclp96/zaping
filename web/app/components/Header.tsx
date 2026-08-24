'use client';

type HeaderProps = {
  title: string;
  onMenuClick: () => void;
};

export default function Header({
  title,
  onMenuClick,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 bg-white px-4 py-4 shadow md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Abrir navegación"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100 md:hidden"
          onClick={onMenuClick}
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ≡
          </span>
        </button>

        <h1 className="truncate text-2xl font-bold text-slate-900">
          {title}
        </h1>
      </div>

      <div
        aria-label="Cuenta"
        className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600"
      >
        Cuenta
      </div>
    </header>
  );
}
