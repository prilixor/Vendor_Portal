import { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { cn } from "@/app/helpers/utils";

export type OrderMedicalReferenceProps = {
  doctorName?: string | null;
  doctorSpecialization?: string | null;
  doctorUniqueCode?: string | null;
  doctorContactNumber?: string | null;
  hospitalName?: string | null;
  hospitalCity?: string | null;
  /** Optional action (e.g. vendor “View doctor”). */
  action?: ReactNode;
};

function MedicalRow({
  label,
  children,
  className,
  stacked,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 py-2 sm:block sm:space-y-0.5 sm:py-0",
        stacked && "flex-col items-stretch gap-0.5",
        className,
      )}
    >
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div
        className={cn(
          "min-w-0 text-sm font-medium leading-snug",
          stacked ? "text-left" : "text-right sm:text-left",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Shared order medical reference block — clear labels, no internal/explanatory copy.
 */
export function OrderMedicalReferenceCard({
  doctorName,
  doctorSpecialization,
  doctorUniqueCode,
  doctorContactNumber,
  hospitalName,
  hospitalCity,
  action,
}: OrderMedicalReferenceProps) {
  const hasDoctor = !!(doctorName || doctorUniqueCode || doctorContactNumber);
  const hasHospital = !!hospitalName;
  if (!hasDoctor && !hasHospital) return null;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
        <p className="text-[13px] font-semibold sm:text-base">Medical reference</p>
      </CardHeader>
      <CardContent className="divide-y divide-border/60 px-3 pb-2 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-3 sm:divide-y-0 sm:px-4 sm:pb-4">
        {hasDoctor && (
          <>
            {doctorName && (
              <MedicalRow label="Doctor" stacked>
                {doctorName}
                {doctorSpecialization ? (
                  <span className="font-normal text-muted-foreground"> — {doctorSpecialization}</span>
                ) : null}
              </MedicalRow>
            )}

            {doctorUniqueCode && (
              <MedicalRow label="Unique ID">
                <span className="font-mono text-[13px] font-bold tracking-wider text-teal-700 dark:text-teal-300">
                  {doctorUniqueCode}
                </span>
              </MedicalRow>
            )}

            {doctorContactNumber && (
              <MedicalRow label="Contact">{doctorContactNumber}</MedicalRow>
            )}

            {action ? <div className="py-2 sm:col-span-3 sm:py-0">{action}</div> : null}
          </>
        )}

        {hasHospital && (
          <MedicalRow label="Hospital" className={cn(hasDoctor && "sm:col-span-3")}>
            {hospitalName}
            {hospitalCity ? (
              <span className="font-normal text-muted-foreground"> ({hospitalCity})</span>
            ) : null}
          </MedicalRow>
        )}
      </CardContent>
    </Card>
  );
}
