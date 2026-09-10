import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { legalDocumentsApi, type LegalDocumentListItemDto } from "@/app/services/legalDocumentsApi";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { Pencil, Scale } from "lucide-react";
import { toast } from "sonner";

function statusBadge(status: string) {
  if (status === "published") return <Badge>Published</Badge>;
  if (status === "scheduled") return <Badge variant="secondary">Scheduled</Badge>;
  if (status === "draft") return <Badge variant="outline">Draft</Badge>;
  return <Badge variant="outline">Unpublished</Badge>;
}

function formatStamp(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "dd MMM yyyy");
}

export default function LegalDocumentsManager() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<LegalDocumentListItemDto[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = await legalDocumentsApi.list();
        setDocuments(list);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load legal documents.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-12">
      {loading && <PageLoaderSlot />}
      <PageHeader
        title="Legal Documents"
        description="Platform terms and policies shown to customers and vendors. Draft, format, and publish from here."
      />

      <Card className="min-w-0 max-w-full">
        <CardContent className="min-w-0 max-w-full overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="min-w-0">
                    <div className="flex items-start gap-2">
                      <Scale className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="break-words font-medium">{doc.title}</div>
                        <div className="break-all text-xs text-muted-foreground">
                          {doc.slug}
                          {doc.publicPath ? ` · ${doc.publicPath}` : ""}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{doc.audience}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {statusBadge(doc.status)}
                      {doc.draftVersionNumber ? (
                        <span className="text-xs text-muted-foreground">Draft v{doc.draftVersionNumber}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{formatStamp(doc.effectiveFrom)}</TableCell>
                  <TableCell>{formatStamp(doc.lastUpdated)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/website-content/legal/${doc.id}`}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No legal documents yet. Run migration 076, then restart the API to seed the seven policies.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
