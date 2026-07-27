import { ReactNode } from 'react';

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export default function PageContainer({
  children,
  className = '',
}: PageContainerProps) {
  return (
    <main className={`space-y-8 p-8 ${className}`}>
      {children}
    </main>
  );
}