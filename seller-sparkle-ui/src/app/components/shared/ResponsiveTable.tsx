import { ReactNode } from "react";
import { cn } from "@/app/helpers/utils";

interface ResponsiveTableProps {
  children: ReactNode;
  className?: string;
}

export const ResponsiveTable = ({ children, className }: ResponsiveTableProps) => (
  <div className="overflow-x-auto rounded-lg border border-border">
    <table className={cn("w-full text-sm", className)}>
      {children}
    </table>
  </div>
);
