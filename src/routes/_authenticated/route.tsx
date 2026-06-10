import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-14 flex items-center px-3 border-b border-border bg-card">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-md hover:bg-muted"
            aria-label="Åbn menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="ml-2 font-serif text-[var(--brand-900)]" style={{ letterSpacing: "0.2em" }}>
            ERIKSMINDE
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
