import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { mockVendors } from "@/app/services/mockData";
import { Building2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Vendors = () => (
  <div>
    <PageHeader title="All vendors" description="Browse every onboarded vendor across the marketplace." />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {mockVendors.map((v) => (
        <Link key={v.id} to={`/admin/vendors/${v.id}`} className="group">
          <Card className="border-border/60 p-4 sm:p-5 lg:p-6 transition-all hover:-translate-y-0.5 hover:shadow-elegant">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-soft text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{v.businessName}</p>
                  <p className="text-xs text-muted-foreground">{v.ownerName} · {v.city}</p>
                </div>
              </div>
              <StatusBadge status={v.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-center text-xs">
              <div>
                <p className="text-lg font-bold">{v.documentsCount}</p>
                <p className="text-muted-foreground">Documents</p>
              </div>
              <div>
                <p className="text-lg font-bold">{v.productsCount}</p>
                <p className="text-muted-foreground">Listings</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              View details <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  </div>
);

export default Vendors;


