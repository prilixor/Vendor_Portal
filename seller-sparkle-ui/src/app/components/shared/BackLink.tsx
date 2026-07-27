import { Link } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/helpers/utils";

type BackLinkProps = {
  to: string;
  label: string;
  className?: string;
};

/** Ghost back nav matching Customer/Vendor/Admin order-detail pattern. Prefer Link targets over history(-1). */
export function BackLink({ to, label, className }: BackLinkProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "-ml-2 h-auto px-2 text-sm text-muted-foreground hover:text-foreground",
        className,
      )}
      asChild
    >
      <Link to={to}>← {label}</Link>
    </Button>
  );
}
