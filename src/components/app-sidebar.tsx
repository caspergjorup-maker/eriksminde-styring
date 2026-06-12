import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Tractor,
  Building2,
  Map,
  Wheat,
  ShoppingCart,
  Coins,
  Trees,
  Axe,
  Target,
  PieChart,
  FileText,
  CalendarRange,
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
      { label: "Overblik", to: "/dashboard", icon: LayoutDashboard },
      { label: "Landbrugsjord", to: "/landbrugsjord", icon: Tractor },
      { label: "Marker", to: "/marker", icon: Map },
      { label: "Matrikelkort", to: "/matrikelkort", icon: Map },
      { label: "Bygninger", to: "/bygninger", icon: Building2 },
      { label: "Bygningsplan", to: "/bygningsplan", icon: Map },
    ],
  },
  {
    title: "Halm",
    items: [
      { label: "Lager", to: "/halm/lager", icon: Wheat },
      { label: "Salg & kunder", to: "/halm/salg", icon: ShoppingCart },
      { label: "Økonomi", to: "/halm/oekonomi", icon: Coins },
    ],
  },
  {
    title: "Skov",
    items: [
      { label: "Skovoverblik", to: "/skov/overblik", icon: Trees },
      { label: "Hugst & aktivitet", to: "/skov/hugst", icon: Axe },
      { label: "Jagtleje", to: "/skov/jagtleje", icon: Target },
    ],
  },
  {
    title: "Økonomi",
    items: [
      { label: "Overblik", to: "/oekonomi/overblik", icon: PieChart },
      { label: "Fakturakladder", to: "/oekonomi/fakturaer", icon: FileText },
      { label: "Budget", to: "/oekonomi/budget", icon: CalendarRange },
    ],
  },
  {
    title: "Kontakter",
    items: [
      { label: "Kunder", to: "/kontakter/kunder", icon: Users },
      { label: "Leverandører", to: "/kontakter/leverandoerer", icon: Truck },
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
