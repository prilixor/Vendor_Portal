import { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";

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
      <CardHeader className="pb-4">
        <p className="text-lg font-semibold">Medical reference</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasDoctor && (
          <div className="space-y-3">
            {doctorName && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Doctor</p>
                <p className="text-sm font-medium">
                  {doctorName}
                  {doctorSpecialization ? (
                    <span className="font-normal text-muted-foreground"> — {doctorSpecialization}</span>
                  ) : null}
                </p>
              </div>
            )}

            {doctorUniqueCode && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unique ID</p>
                <p className="font-mono text-sm font-bold tracking-wider text-teal-700">{doctorUniqueCode}</p>
              </div>
            )}

            {doctorContactNumber && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
                <p className="text-sm text-foreground">{doctorContactNumber}</p>
              </div>
            )}

            {action}
          </div>
        )}

        {hasHospital && (
          <div className="space-y-1 border-t border-border/50 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hospital</p>
            <p className="text-sm font-medium">
              {hospitalName}
              {hospitalCity ? (
                <span className="font-normal text-muted-foreground"> ({hospitalCity})</span>
              ) : null}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
