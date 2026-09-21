import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Switch } from "@/app/components/ui/switch";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { LegalRichTextEditor } from "@/app/components/admin/LegalRichTextEditor";
import { PageContentGate } from "@/app/components/shared/PageLoader";
import {
  LEGAL_SCREENS,
  LEGAL_SURFACES,
  legalDocumentsApi,
  type LegalDocumentDetailDto,
  type LegalDocumentVersionDetailDto,
  type LegalDocumentVersionSummaryDto,
  type LegalPlacementDto,
} from "@/app/services/legalDocumentsApi";
import { toast } from "sonner";
import { Monitor, Smartphone, Save, Settings2, Upload } from "lucide-react";
import { cn } from "@/app/helpers/utils";

function toDateInput(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function fromDateInput(value: string) {
  if (!value) return null;
  return `${value}T00:00:00.000Z`;
}

function formatStamp(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "dd MMM yyyy HH:mm");
}

function emptyPlacementGrid(existing: LegalPlacementDto[]): LegalPlacementDto[] {
  const map = new Map(existing.map((p) => [`${p.surface}:${p.screen}`, p]));
  const next: LegalPlacementDto[] = [];
  for (const surface of LEGAL_SURFACES) {
    for (const screen of LEGAL_SCREENS) {
      const key = `${surface.id}:${screen.id}`;
      next.push(
        map.get(key) ?? {
          surface: surface.id,
          screen: screen.id,
          isVisible: false,
          isRequiredToProceed: false,
          sortOrder: 0,
        },
      );
    }
  }
  return next;
}

export default function LegalDocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [doc, setDoc] = useState<LegalDocumentDetailDto | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [publicPath, setPublicPath] = useState("");
  const [summary, setSummary] = useState("");
  const [audience, setAudience] = useState("both");
  const [sortOrder, setSortOrder] = useState(0);
  const [isRequiredAcceptance, setIsRequiredAcceptance] = useState(false);
  const [html, setHtml] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [isMaterialChange, setIsMaterialChange] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [placements, setPlacements] = useState<LegalPlacementDto[]>([]);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [versions, setVersions] = useState<LegalDocumentVersionSummaryDto[]>([]);
  const [history, setHistory] = useState<LegalDocumentVersionDetailDto | null>(null);

  const load = async (documentId: string) => {
    setLoading(true);
    try {
      const [detail, versionList] = await Promise.all([
        legalDocumentsApi.get(documentId),
        legalDocumentsApi.listVersions(documentId),
      ]);
      setDoc(detail);
      setTitle(detail.title);
      setSlug(detail.slug);
      setPublicPath(detail.publicPath ?? "");
      setSummary(detail.summary ?? "");
      setAudience(detail.audience);
      setSortOrder(detail.sortOrder);
      setIsRequiredAcceptance(detail.isRequiredAcceptance);
      setHtml(detail.draftContentHtml || detail.contentHtml || "");
      setChangeSummary(detail.changeSummary ?? "");
      setIsMaterialChange(
        detail.documentType === "terms-of-use" ||
          detail.documentType === "privacy-policy" ||
          detail.documentType === "vendor-seller-policy"
          ? true
          : detail.isMaterialChange,
      );
      setEffectiveFrom(toDateInput(detail.effectiveFrom));
      setPlacements(emptyPlacementGrid(detail.placements ?? []));
      setVersions(versionList);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load document.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void load(id);
  }, [id]);

  const updatePlacement = (surface: string, screen: string, patch: Partial<LegalPlacementDto>) => {
    setPlacements((prev) =>
      prev.map((p) => (p.surface === surface && p.screen === screen ? { ...p, ...patch } : p)),
    );
  };

  const handleSaveMeta = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await legalDocumentsApi.update(id, {
        title,
        slug,
        summary,
        publicPath,
        audience,
        sortOrder,
        isRequiredAcceptance,
        placements,
      });
      setDoc(updated);
      setPlacements(emptyPlacementGrid(updated.placements ?? []));
      toast.success("Document settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await legalDocumentsApi.update(id, {
        title,
        slug,
        summary,
        publicPath,
        audience,
        sortOrder,
        isRequiredAcceptance,
        placements,
      });
      const updated = await legalDocumentsApi.saveDraft(id, {
        contentHtml: html,
        changeSummary,
      });
      setDoc(updated);
      const versionList = await legalDocumentsApi.listVersions(id);
      setVersions(versionList);
      toast.success("Draft saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save draft.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      await legalDocumentsApi.update(id, {
        title,
        slug,
        summary,
        publicPath,
        audience,
        sortOrder,
        isRequiredAcceptance,
        placements,
      });
      await legalDocumentsApi.saveDraft(id, {
        contentHtml: html,
        changeSummary,
      });
      const updated = await legalDocumentsApi.publish(id, {
        effectiveFrom: fromDateInput(effectiveFrom),
        changeSummary,
        isMaterialChange,
      });
      setDoc(updated);
      setHtml(updated.draftContentHtml || updated.contentHtml || html);
      const versionList = await legalDocumentsApi.listVersions(id);
      setVersions(versionList);
      toast.success("Document published.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setPublishing(false);
    }
  };

  const openHistory = async (versionId: string) => {
    if (!id) return;
    try {
      const detail = await legalDocumentsApi.getVersion(id, versionId);
      setHistory(detail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load version.");
    }
  };

  const editorKey = useMemo(
    () => `${doc?.id ?? ""}-${doc?.draftVersionId ?? doc?.publishedVersionId ?? "new"}`,
    [doc?.id, doc?.draftVersionId, doc?.publishedVersionId],
  );

  if (!id) return null;

  return (
    <PageContentGate loading={loading}>
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-12">
      <PageHeader
        title={title || "Legal document"}
        description="Format with headings, lists, links, and tables. Visibility and required flags control each surface. Live Terms/Privacy pages stay hardcoded until the next phase."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Website Content", href: "/admin/website-content" },
          { label: "Legal Documents", href: "/admin/website-content/legal" },
          { label: title || "Legal document" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin/website-content/legal">Back to list</Link>
            </Button>
            <Button variant="secondary" onClick={() => void handleSaveMeta()} disabled={saving || publishing}>
              <Settings2 className="mr-1.5 h-4 w-4" />
              Save settings
            </Button>
            <Button variant="outline" onClick={() => void handleSaveDraft()} disabled={saving || publishing}>
              <Save className="mr-1.5 h-4 w-4" />
              Save draft
            </Button>
            <Button onClick={() => void handlePublish()} disabled={saving || publishing}>
              <Upload className="mr-1.5 h-4 w-4" />
              Publish
            </Button>
          </div>
        }
      />

      {doc ? (
        <div className="flex flex-wrap gap-2">
          <Badge className="capitalize">{doc.status}</Badge>
          {doc.publishedVersionNumber ? <Badge variant="secondary">Published v{doc.publishedVersionNumber}</Badge> : null}
          {doc.draftVersionNumber ? <Badge variant="outline">Draft v{doc.draftVersionNumber}</Badge> : null}
        </div>
      ) : null}

      <div className="grid min-w-0 max-w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 max-w-full space-y-6">
          <Card className="min-w-0 max-w-full overflow-x-hidden">
            <CardHeader className="min-w-0">
              <CardTitle>Metadata</CardTitle>
              <CardDescription className="text-pretty break-words">Keep public paths stable for later `/terms-and-conditions` and `/privacy-policy` routes.</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="legal-title">Title</Label>
                  <Input id="legal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="legal-slug">Slug</Label>
                  <Input id="legal-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="legal-path">Public path</Label>
                  <Input id="legal-path" value={publicPath} onChange={(e) => setPublicPath(e.target.value)} placeholder="/terms-and-conditions" />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Audience</Label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                      <SelectItem value="platform">Platform</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="legal-effective">Effective from</Label>
                  <Input id="legal-effective" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="legal-sort">Sort order</Label>
                  <Input id="legal-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-summary">Summary</Label>
                <Textarea id="legal-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
              </div>
              <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Required acceptance (schema)</div>
                  <div className="text-pretty break-words text-xs text-muted-foreground">Used later on register / checkout. Does not write acceptances in this phase.</div>
                </div>
                <Switch className="shrink-0" checked={isRequiredAcceptance} onCheckedChange={setIsRequiredAcceptance} />
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 max-w-full overflow-x-hidden">
            <CardHeader className="min-w-0">
              <CardTitle>Content</CardTitle>
              <CardDescription className="text-pretty break-words">Draft is stored separately until you publish. Public API never returns drafts.</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
              <LegalRichTextEditor key={editorKey} value={html} onChange={setHtml} />
              <div className="space-y-2">
                <Label htmlFor="legal-change">Change summary</Label>
                <Input id="legal-change" value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} />
              </div>
              <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Material change</div>
                  <div className="text-pretty break-words text-xs text-muted-foreground">
                    Terms, Privacy, and Vendor / Seller always ask existing users to re-accept after a new publish.
                    Use this flag on other policies for the version history.
                  </div>
                </div>
                <Switch className="shrink-0" checked={isMaterialChange} onCheckedChange={setIsMaterialChange} />
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 max-w-full overflow-x-hidden">
            <CardHeader className="min-w-0">
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 max-w-full space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={previewMode === "desktop" ? "default" : "outline"} onClick={() => setPreviewMode("desktop")}>
                  <Monitor className="mr-1.5 h-4 w-4" />
                  Desktop
                </Button>
                <Button type="button" size="sm" variant={previewMode === "mobile" ? "default" : "outline"} onClick={() => setPreviewMode("mobile")}>
                  <Smartphone className="mr-1.5 h-4 w-4" />
                  Mobile
                </Button>
              </div>
              <div className="flex min-w-0 max-w-full justify-center overflow-x-hidden rounded-lg border bg-muted/30 p-3 sm:p-4">
                <div
                  className={cn(
                    "min-w-0 rounded-md bg-background shadow-sm",
                    previewMode === "mobile"
                      ? "mx-auto w-full max-w-[390px] max-h-[70vh] overflow-x-hidden overflow-y-auto border"
                      : "w-full",
                  )}
                >
                  <div
                    className="legal-prose min-w-0 max-w-full break-words p-4 sm:p-6"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 max-w-full">
            <CardHeader className="min-w-0">
              <CardTitle>Placements</CardTitle>
              <CardDescription className="text-pretty break-words">Visible = show on that surface and screen. Required = must accept or acknowledge to proceed. Use Save settings or Save draft in the header to keep this grid.</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 max-w-full overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border bg-muted/40 p-2 text-left">Screen</th>
                    {LEGAL_SURFACES.map((surface) => (
                      <th key={surface.id} className="border bg-muted/40 p-2 text-center" colSpan={2}>
                        {surface.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="border p-2" />
                    {LEGAL_SURFACES.map((surface) => (
                      <FragmentPair key={surface.id} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LEGAL_SCREENS.map((screen) => (
                    <tr key={screen.id}>
                      <td className="border p-2 font-medium">{screen.label}</td>
                      {LEGAL_SURFACES.map((surface) => {
                        const cell = placements.find((p) => p.surface === surface.id && p.screen === screen.id);
                        return (
                          <PlacementCell
                            key={`${surface.id}-${screen.id}`}
                            visible={cell?.isVisible ?? false}
                            required={cell?.isRequiredToProceed ?? false}
                            onVisible={(checked) => updatePlacement(surface.id, screen.id, { isVisible: checked })}
                            onRequired={(checked) =>
                              updatePlacement(surface.id, screen.id, {
                                isRequiredToProceed: checked,
                                isVisible: checked ? true : cell?.isVisible,
                              })
                            }
                          />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="min-w-0">
            <CardTitle>Version history</CardTitle>
            <CardDescription className="text-pretty break-words">Open a past version to preview it. Publishing archives the previous published copy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {versions.map((version) => (
              <button
                key={version.id}
                type="button"
                className="w-full rounded-md border p-3 text-left hover:bg-muted/40"
                onClick={() => void openHistory(version.id)}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="font-medium">v{version.versionNumber}</span>
                  <Badge variant={version.status === "published" ? "default" : "outline"} className="capitalize">
                    {version.status}
                  </Badge>
                </div>
                <div className="mt-1 break-words text-xs text-muted-foreground">
                  {version.changeSummary || "No change summary"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatStamp(version.publishedAt ?? version.createdAt)}
                </div>
              </button>
            ))}
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No versions yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!history} onOpenChange={(open) => !open && setHistory(null)}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {history ? `Version ${history.versionNumber}` : "Version"}
            </DialogTitle>
            <DialogDescription>
              {history ? `${history.status} · effective ${formatStamp(history.effectiveFrom)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {history ? (
            <div className="legal-prose min-w-0 max-w-full" dangerouslySetInnerHTML={{ __html: history.contentHtml }} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
    </PageContentGate>
  );
}

function FragmentPair() {
  return (
    <>
      <th className="border p-1 font-normal text-muted-foreground">Vis</th>
      <th className="border p-1 font-normal text-muted-foreground">Req</th>
    </>
  );
}

function PlacementCell({
  visible,
  required,
  onVisible,
  onRequired,
}: {
  visible: boolean;
  required: boolean;
  onVisible: (checked: boolean) => void;
  onRequired: (checked: boolean) => void;
}) {
  return (
    <>
      <td className="border p-1 text-center">
        <Checkbox checked={visible} onCheckedChange={(value) => onVisible(value === true)} />
      </td>
      <td className="border p-1 text-center">
        <Checkbox checked={required} onCheckedChange={(value) => onRequired(value === true)} />
      </td>
    </>
  );
}
