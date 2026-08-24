import type { ReactNode } from 'react';

import Header from '@/app/components/Header';
import Sidebar from '@/app/components/sidebar';

export default function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex">
      <Sidebar />

      <div className="flex-1 bg-slate-100 min-h-screen">
        <Header />
        <main>{children}</main>
      </div>
    </div>
  );
}
