import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { auth } from "@/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userRole = (session?.user?.role || "editor") as "admin" | "editor";

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0e1a] bg-grid-pattern">
      <Sidebar userRole={userRole} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-[1800px]">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
