import { LucideIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}

export const EmptyState = ({ icon: Icon, title, description, action, children }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center animate-fade-in">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
      <Icon className="h-7 w-7" />
    </div>
    <h3 className="text-base font-semibold">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && (
      <Button onClick={action.onClick} className="mt-5">
        {action.label}
      </Button>
    )}
    {children}
  </div>
);


