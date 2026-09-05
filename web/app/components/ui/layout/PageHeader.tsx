import { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function PageHeader({
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="break-words text-3xl font-bold text-text">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-3xl text-text-muted">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0 md:justify-end">
          {action}
        </div>
      )}
    </div>
  );
}
