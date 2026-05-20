import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export { adminNav } from "@/app/helpers/adminNav";
export { vendorNav } from "@/app/helpers/vendorNav";
export { customerNav } from "@/app/helpers/customerNav";

