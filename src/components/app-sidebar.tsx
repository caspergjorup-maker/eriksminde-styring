import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Sprout,
  Building2,
  Crosshair,
  Layers,
  Trees,
  BarChart3,
  FileText,
  Calculator,
  Users,
  Truck,
  FolderOpen,
  Wrench,
  LogOut,
} from "lucide-react";

import { EriksmindeLogo } from "./eriksminde-logo";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };
type Section = { title: string; items: NavItem[] };

const sections: Section[] = [
  {
    title: "Drift",
    items: [
      { label: "Overblik", to: "/overblik", icon: LayoutDashboard },
      { label: "Landbrugsjord & Marker", to: "/landbrugsjord", icon: Sprout },
      { label: "Bygninger", to: "/bygninger", icon: Building2 },
      { label: "Jagtleje", to: "/jagtleje", icon: Crosshair },
    ],
  },
  {
    title: "Produktion & Salg",
    items: [
      { label: "Halm", to: "/halm", icon: Layers },
      { label: "Skov & hugst", to: "/skov", icon: Trees },
    ],
  },
  {
    title: "Økonomi",
    items: [
      { label: "Årsresultat", to: "/oekonomi", icon: BarChart3 },
      { label: "Fakturakladder", to: "/fakturakladder", icon: FileText },
      { label: "Budget", to: "/budget", icon: Calculator },
    ],
  },
  {
    title: "Kontakter",
    items: [
      { label: "Kunder", to: "/kunder", icon: Users },
      { label: "Leverandører", to: "/leverandoerer", icon: Truck },
    ],
  },
  {
    title: "Andet",
    items: [
      { label: "Dokumenter", to: "/dokumenter", icon: FolderOpen },
      { label: "Vedligehold", to: "/vedligehold", icon: Wrench },
    ],
  },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <aside className="h-full w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
      <div className="px-4 py-6 border-b border-sidebar-border">
        <EriksmindeLogo />
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {sections.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={[
                        "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors relative",
                        "border-l-2",
                        active
                          ? "border-l-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-900)] font-medium"
                          : "border-l-transparent text-sidebar-foreground hover:bg-[var(--brand-50)]/60",
                      ].join(" ")}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-[var(--brand-50)] hover:text-[var(--brand-900)] transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log ud
        </button>
      </div>
    </aside>
  );
}
