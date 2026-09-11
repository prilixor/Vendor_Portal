import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ClipboardList, Search } from "lucide-react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { PageContentGate } from "@/app/components/shared/PageLoader";
import { TablePagination } from "@/app/components/shared/TablePagination";
import { Badge } from "@/app/components/ui/badge";
import {
  LEGAL_SCREENS,
  LEGAL_SURFACES,
  legalDocumentsApi,
  type LegalAcceptanceAdminDto,
  type LegalDocumentListItemDto,
} from "@/app/services/legalDocumentsApi";
import { toast } from "sonner";

const PAGE_SIZE = 10;

const SCREEN_LABELS = Object.fromEntries(LEGAL_SCREENS.map((s) => [s.id, s.label]));
const SURFACE_LABELS = Object.fromEntries(LEGAL_SURFACES.map((s) => [s.id, s.label]));

function labelScreen(value: string) {
  return SCREEN_LABELS[value] ?? value.replace(/_/g, " ");
}

function labelSurface(value: string) {
  return SURFACE_LABELS[value] ?? value.replace(/_/g, " ");
}

function formatStamp(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "dd MMM yyyy, HH:mm");
}

function actorHref(row: LegalAcceptanceAdminDto) {
  if (row.actorType === "vendor") return `/admin/vendors/${row.actorId}`;
  if (row.actorType === "customer") return `/admin/customers/${row.actorId}`;
  return null;
}

export default function LegalAcceptances() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LegalAcceptanceAdminDto[]>([]);
  const [documents, setDocuments] = useState<LegalDocumentListItemDto[]>([]);
  const [search, setSearch] = useState("");
  const [actorType, setActorType] = useState("all");
  const [documentId, setDocumentId] = useState("all");
  const [screen, setScreen] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [list, docs] = await Promise.all([
          legalDocumentsApi.listAcceptances(),
          legalDocumentsApi.list(),
        ]);
        setRows(list);
        setDocuments(docs);
        setPage(1);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load legal acceptances.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const screens = useMemo(() => {
    const ids = new Set(rows.map((r) => r.sourceScreen).filter(Boolean));
    return Array.from(ids).sort((a, b) => labelScreen(a).localeCompare(labelScreen(b)));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (actorType !== "all" && row.actorType !== actorType) return false;
      if (documentId !== "all" && row.documentId !== documentId) return false;
      if (screen !== "all" && row.sourceScreen !== screen) return false;
      if (!q) return true;
      return (
        row.actorName.toLowerCase().includes(q) ||
        (row.actorEmail ?? "").toLowerCase().includes(q) ||
        row.documentTitle.toLowerCase().includes(q) ||
        row.documentSlug.toLowerCase().includes(q) ||
        (row.signedName ?? "").toLowerCase().includes(q) ||
        (row.ipAddress ?? "").toLowerCase().includes(q) ||
        `v${row.versionNumber}`.includes(q)
      );
    });
  }, [rows, search, actorType, documentId, screen]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  useEffect(() => {
    setPage(1);
  }, [search, actorType, documentId, screen]);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-12">
      <PageHeader
        title="Legal acceptances"
        description="Exact published version each customer or vendor accepted, including checkout checkboxes and vendor e-sign."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Website Content", href: "/admin/website-content" },
          { label: "Legal Documents", href: "/admin/website-content/legal" },
          { label: "Acceptances" },
        ]}
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        <PageContentGate loading={loading}>
          <>
            <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:flex-wrap lg:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, policy, e-sign…"
                  className="pl-9"
                />
              </div>
              <Select value={actorType} onValueChange={setActorType}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actors</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="vendor">Vendors</SelectItem>
                </SelectContent>
              </Select>
              <Select value={documentId} onValueChange={setDocumentId}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All policies</SelectItem>
                  {documents.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={screen} onValueChange={setScreen}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All screens</SelectItem>
                  {screens.map((id) => (
                    <SelectItem key={id} value={id}>{labelScreen(id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ClipboardList className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No acceptances match your filters.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">When</th>
                        <th className="px-4 py-3 font-semibold">Actor</th>
                        <th className="px-4 py-3 font-semibold">Policy</th>
                        <th className="px-4 py-3 font-semibold">Version</th>
                        <th className="px-4 py-3 font-semibold">Screen</th>
                        <th className="px-4 py-3 font-semibold">Surface</th>
                        <th className="px-4 py-3 font-semibold">Signed name</th>
                        <th className="px-4 py-3 font-semibold">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pageRows.map((row) => {
                        const href = actorHref(row);
                        return (
                          <tr key={row.id} className="hover:bg-muted/20">
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                              {formatStamp(row.acceptedAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className="w-fit capitalize">{row.actorType}</Badge>
                                {href ? (
                                  <Link to={href} className="font-medium text-primary hover:underline">
                                    {row.actorName}
                                  </Link>
                                ) : (
                                  <span className="font-medium">{row.actorName}</span>
                                )}
                                {row.actorEmail ? (
                                  <span className="break-all text-xs text-muted-foreground">{row.actorEmail}</span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                to={`/admin/website-content/legal/${row.documentId}`}
                                className="font-medium hover:underline"
                              >
                                {row.documentTitle}
                              </Link>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">v{row.versionNumber}</td>
                            <td className="px-4 py-3">{labelScreen(row.sourceScreen)}</td>
                            <td className="px-4 py-3">{labelSurface(row.sourceSurface)}</td>
                            <td className="px-4 py-3">{row.signedName || "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {row.ipAddress || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={safePage}
                  pageSize={PAGE_SIZE}
                  total={filtered.length}
                  onPageChange={setPage}
                  label="acceptances"
                />
              </>
            )}
          </>
        </PageContentGate>
      </Card>
    </div>
  );
}
