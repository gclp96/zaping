import { ReactNode } from 'react';

type SectionProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export default function Section({
  title,
  description,
  action,
  children,
}: SectionProps) {
  return (
    <section className="space-y-4">
      {(title || description || action) && (
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {(title || description) && (
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="break-words text-xl font-semibold text-text">
                  {title}
                </h2>
              )}

              {description && (
                <p className={`${title ? 'mt-1 ' : ''}text-text-muted`}>
                  {description}
                </p>
              )}
            </div>
          )}

          {action && (
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:justify-end">
              {action}
            </div>
          )}
        </div>
      )}

      {children}
    </section>
  );
}
