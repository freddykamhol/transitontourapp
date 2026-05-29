import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Car,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Ticket,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "fahrzeug", label: "Fahrzeug", icon: Car },
  { to: "anfragen", label: "Anfragen", icon: Ticket },
  { to: "vermietungen", label: "Vermietungen", icon: ClipboardList },
  { to: "kalender", label: "Kalender", icon: CalendarDays },
  { to: "einstellungen", label: "Einstellungen", icon: Settings },
];
