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
      {(title || action) && (
        <div className="flex items-center justify-between">
          <div>
            {title && (
              <h2 className="text-xl font-semibold">
                {title}
              </h2>
            )}

            {description && (
              <p className="mt-1 text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          {action && (
            <div className="shrink-0">
              {action}
            </div>
          )}
        </div>
      )}

      {children}
    </section>
  );
}