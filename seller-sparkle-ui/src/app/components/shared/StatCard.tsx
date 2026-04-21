import { LucideIcon } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/helpers/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive?: boolean };
  accent?: "primary" | "success" | "warning" | "info";
}

const accents = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
};

export const StatCard = ({ label, value, icon: Icon, trend, accent = "primary" }: StatCardProps) => (
  <Card className="p-5 border-border/60 shadow-sm hover:shadow-elegant transition-all hover:-translate-y-0.5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
        {trend && (
          <p className={cn("mt-1 text-xs font-medium", trend.positive ? "text-success" : "text-destructive")}>
            {trend.positive ? "▲" : "▼"} {trend.value}
          </p>
        )}
      </div>
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", accents[accent])}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </Card>
);


