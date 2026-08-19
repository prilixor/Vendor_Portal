import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { websiteContentApi, FaqCategoryDto, FaqItemDto } from "@/app/services/websiteContentApi";
import { useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Plus, Pencil, Trash2, Search, CheckCircle, XCircle, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";

export function FAQContentManager() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<FaqCategoryDto[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItemDto[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FaqItemDto | null>(null);

  const [formCategoryId, setFormCategoryId] = useState("");
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [formIsPublished, setFormIsPublished] = useState(true);

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const loadContent = async () => {
    setLoading(true);
    try {
      const full = await websiteContentApi.getAdminContent();
      if (full) {
        if (full.faqCategories) setCategories(full.faqCategories);
        if (full.faqs) setFaqItems(full.faqs);
      }
    } catch (err) {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContent();
  }, []);

  const handleOpenAddItem = () => {
    setEditingItem(null);
    setFormCategoryId(categories[0]?.id || "");
    setFormQuestion("");
    setFormAnswer("");
    setFormIsPublished(true);
    setItemDialogOpen(true);
  };

  const handleOpenEditItem = (item: FaqItemDto) => {
    setEditingItem(item);
    setFormCategoryId(item.categoryId);
    setFormQuestion(item.question);
    setFormAnswer(item.answer);
    setFormIsPublished(item.isPublished);
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!formQuestion.trim() || !formAnswer.trim()) {
      toast.error("Please enter both question and answer.");
      return;
    }

    if (!formCategoryId) {
      toast.error("Please select a category.");
      return;
    }

    const payload: FaqItemDto = {
      id: editingItem?.id,
      categoryId: formCategoryId,
      question: formQuestion,
      answer: formAnswer,
      isPublished: formIsPublished,
      sortOrder: editingItem?.sortOrder ?? faqItems.length + 1,
    };

    try {
      await websiteContentApi.upsertFaqItem(payload);
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success("FAQ item saved successfully!");
    } catch (err) {
      toast.error("Failed to save FAQ item.");
    } finally {
      setItemDialogOpen(false);
    }
  };

  const handleDeleteItem = async (id?: string) => {
    if (!id) return;
    try {
      await websiteContentApi.deleteFaqItem(id);
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.info("FAQ question removed.");
    } catch (err) {
      toast.error("Failed to delete FAQ question.");
    }
  };

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) {
      toast.error("Please enter category name.");
      return;
    }

    try {
      await websiteContentApi.upsertFaqCategory({ name: newCatName.trim() });
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success(`Added category "${newCatName.trim()}".`);
      setNewCatName("");
    } catch (err) {
      toast.error("Failed to add category.");
    } finally {
      setCatDialogOpen(false);
    }
  };

  const filteredItems = faqItems.filter((item) => {
    if (selectedCategory !== "all" && item.categoryId !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return <PageLoaderSlot />;
  }

  return (
    <div className="space-y-6">
      {/* Category & Search Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" /> Frequently Asked Questions (FAQ)
              </CardTitle>
              <CardDescription>
                Manage questions and answers displayed in the landing page FAQ accordion section.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCatDialogOpen(true)}>
                <FolderPlus className="mr-2 h-4 w-4" /> Add Category
              </Button>
              <Button size="sm" onClick={handleOpenAddItem}>
                <Plus className="mr-2 h-4 w-4" /> Add Question
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search questions or answers..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full md:w-64">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories ({faqItems.length})</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id || ""}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions Table */}
      <Card>
        <CardContent className="pt-6">
          {/* Mobile Card List View */}
          <div className="space-y-3 sm:hidden">
            {filteredItems.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg p-4">
                No questions match your filter.
              </div>
            ) : (
              filteredItems.map((item, idx) => (
                <div key={item.id ?? idx} className="rounded-lg border p-4 space-y-3 bg-card shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{idx + 1}</span>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {item.categoryName || categories.find((c) => c.id === item.categoryId)?.name || "General"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEditItem(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteItem(item.id, item.question)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm text-foreground">{item.question}</h4>
                      {item.isPublished ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-300 gap-1 font-normal shrink-0">
                          <CheckCircle className="h-3 w-3" /> Published
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground gap-1 font-normal shrink-0">
                          <XCircle className="h-3 w-3" /> Draft
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.answer}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block rounded-md border overflow-x-auto w-full max-w-full">
            <Table className="min-w-[550px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead className="w-[180px]">Category</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No questions match your filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item, idx) => (
                    <TableRow key={item.id ?? idx}>
                      <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {item.categoryName || categories.find((c) => c.id === item.categoryId)?.name || "General"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{item.question}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{item.answer}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.isPublished ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-300 gap-1 font-normal">
                            <CheckCircle className="h-3 w-3" /> Published
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground gap-1 font-normal">
                            <XCircle className="h-3 w-3" /> Draft
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEditItem(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteItem(item.id, item.question)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Question Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit FAQ Question" : "Add FAQ Question"}</DialogTitle>
            <DialogDescription>
              Configure the question, detailed answer, and target category.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id || ""}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="faqQ">Question</Label>
              <Input
                id="faqQ"
                placeholder="e.g. How quickly can my order be delivered?"
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="faqA">Answer</Label>
              <Textarea
                id="faqA"
                rows={4}
                placeholder="Detailed answer text..."
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label htmlFor="pubSwitch" className="text-sm font-medium">Publish Status</Label>
                <p className="text-xs text-muted-foreground">Visible on public landing page accordion</p>
              </div>
              <Switch
                id="pubSwitch"
                checked={formIsPublished}
                onCheckedChange={setFormIsPublished}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem}>
              {editingItem ? "Save Changes" : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add FAQ Category</DialogTitle>
            <DialogDescription>
              Create a new category header to organize FAQ questions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="catName">Category Name</Label>
            <Input
              id="catName"
              placeholder="e.g. Safety & Hygiene"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory}>Add Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
