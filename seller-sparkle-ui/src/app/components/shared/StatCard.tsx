import { LucideIcon } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/helpers/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive?: boolean };
  accent?: "primary" | "success" | "warning" | "info";
  onClick?: () => void;
  className?: string;
}

const accents = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
};

export const StatCard = ({ label, value, icon: Icon, trend, accent = "primary", onClick, className }: StatCardProps) => (
  <Card
    className={cn(
      "p-3 sm:p-5 border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-elegant",
      onClick && "cursor-pointer focus-within:ring-2 focus-within:ring-primary/30",
      className,
    )}
  >
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn("w-full text-left", !onClick && "cursor-default")}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight sm:mt-2 sm:text-3xl">{value}</p>
          {trend && (
            <p className={cn("mt-1 text-xs font-medium", trend.positive ? "text-success" : "text-destructive")}>
              {trend.positive ? "▲" : "▼"} {trend.value}
            </p>
          )}
        </div>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl sm:h-11 sm:w-11", accents[accent])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </button>
  </Card>
);


