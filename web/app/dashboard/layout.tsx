import Sidebar from '@/app/components/sidebar';
import Header from '@/app/components/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <Sidebar />

      <main className="flex-1 bg-slate-100 min-h-screen">
        <Header />
        {children}
      </main>
    </div>
  );
}