import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { SidebarNav } from "@/components/sidebar-nav";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="relative z-10 flex min-h-dvh w-full">
      <SidebarNav />
      <div className="flex w-full flex-1 flex-col md:pl-64">
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:max-w-5xl md:px-10 md:pb-16 md:pt-10 lg:max-w-6xl xl:max-w-7xl">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
