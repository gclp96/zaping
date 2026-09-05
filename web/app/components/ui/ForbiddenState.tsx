import Link from 'next/link';

export default function ForbiddenState() {
  return (
    <section
      aria-labelledby="forbidden-state-title"
      className="rounded-ui-md border border-border bg-surface p-6 shadow-subtle sm:p-8"
    >
      <h2 id="forbidden-state-title" className="text-xl font-semibold text-text">
        Sin permisos
      </h2>
      <p className="mt-2 text-text-secondary">
        No tienes permisos para acceder a esta sección.
      </p>
      <Link
        href="/home"
        className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
