import { useState, useEffect } from "react";

import { PageHeader } from "@/app/components/shared/PageHeader";

import { Card } from "@/app/components/ui/card";

import { StatusBadge } from "@/app/components/shared/StatusBadge";

import { adminApi, VendorDto } from "@/app/services/adminApi";

import { Building2, ArrowRight, Loader2 } from "lucide-react";

import { Link } from "react-router-dom";

import { toast } from "sonner";



const Vendors = () => {

  const [vendors, setVendors] = useState<VendorDto[]>([]);

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    loadVendors();

  }, []);



  const loadVendors = async () => {

    setLoading(true);

    try {

      const data = await adminApi.getVendors();

      setVendors(data);

    } catch (error) {

      const message = error instanceof Error ? error.message : "Failed to load vendors.";

      toast.error(message);

    } finally {

      setLoading(false);

    }

  };



  return (

    <div>

      <PageHeader title="All vendors" description="Browse every onboarded vendor across the marketplace." />

      {loading ? (

        <div className="flex items-center justify-center py-12">

          <Loader2 className="h-8 w-8 animate-spin text-primary" />

        </div>

      ) : (

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {vendors.map((v) => (

            <Link key={v.id} to={`/admin/vendors/${v.id}`} className="group">

              <Card className="border-border/60 p-4 sm:p-5 lg:p-6 transition-all hover:-translate-y-0.5 hover:shadow-elegant">

                <div className="flex items-start justify-between gap-2">

                  <div className="flex items-start gap-3 min-w-0 flex-1">

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-soft text-primary flex-shrink-0">

                      <Building2 className="h-5 w-5" />

                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="font-semibold truncate">{v.email}</p>

                      <p className="text-xs text-muted-foreground truncate">{v.registrationStage}</p>

                    </div>

                  </div>

                  <div className="flex-shrink-0">
                    <StatusBadge status={v.accountStatus as "pending" | "approved" | "rejected" | "under_review"} />
                  </div>

                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-center text-xs">

                  <div>

                    <p className="text-lg font-bold">-</p>

                    <p className="text-muted-foreground">Documents</p>

                  </div>

                  <div>

                    <p className="text-lg font-bold">-</p>

                    <p className="text-muted-foreground">Listings</p>

                  </div>

                </div>

                <div className="mt-3 flex items-center justify-end text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">

                  View details <ArrowRight className="ml-1 h-3.5 w-3.5" />

                </div>

              </Card>

            </Link>

          ))}

          {vendors.length === 0 && (

            <div className="col-span-full py-8 text-center text-muted-foreground">No vendors found</div>

          )}

        </div>

      )}

    </div>

  );

};



export default Vendors;





