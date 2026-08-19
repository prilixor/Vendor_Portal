import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Ticket, 
  MessageSquare, 
  Search, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Send,
  Loader2,
  RefreshCw,
  Mail,
  MoreVertical,
  FileText,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardHeader } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { ChatMessageTextarea } from "@/app/components/shared/ChatMessageTextarea";
import { ChatDaySeparator } from "@/app/components/shared/ChatDaySeparator";
import { Badge } from "@/app/components/ui/badge";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { isSameChatDay } from "@/app/helpers/chatDayLabel";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/app/components/ui/dropdown-menu";
import { supportApi, SupportTicketDto, SupportMessageDto } from "@/app/services/supportApi";
import { useAuth } from "@/app/guards/AuthContext";
import { cn } from "@/app/helpers/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const SUPPORT_CHAT_POLL_MS = 3000;
const SUPPORT_TICKETS_POLL_MS = 10000;

export default function SupportManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketDto | null>(null);
  const [messages, setMessages] = useState<SupportMessageDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedTicketIdRef = useRef<string | null>(null);
  const deepLinkHandledRef = useRef<string | null>(null);

  useEffect(() => {
    selectedTicketIdRef.current = selectedTicket?.id ?? null;
  }, [selectedTicket?.id]);

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await supportApi.getAllTickets({ quiet: silent });
      setTickets(data);
      const activeId = selectedTicketIdRef.current;
      if (activeId) {
        const refreshed = data.find((t) => t.id === activeId);
        if (refreshed) {
          setSelectedTicket((current) =>
            current?.id === refreshed.id ? refreshed : current,
          );
        }
      }
    } catch {
      if (!silent) toast.error("Failed to load tickets.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
    const interval = setInterval(() => {
      void loadTickets(true);
    }, SUPPORT_TICKETS_POLL_MS);
    return () => clearInterval(interval);
  }, [loadTickets]);

  const loadMessages = useCallback(async (ticketId: string, silent = false) => {
    if (!silent) setMessagesLoading(true);
    try {
      const data = await supportApi.getTicketMessages(ticketId, { markReadForAdmin: true });
      setMessages(data);
      void queryClient.invalidateQueries({ queryKey: ["admin-vendor-support-unread"] });
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, unreadCount: 0 } : t)),
      );
    } catch {
      if (!silent) toast.error("Failed to load messages.");
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, [queryClient]);

  // Deep-link from Admin Notifications: /admin/support?ticketId=...
  useEffect(() => {
    const ticketId = searchParams.get("ticketId");
    if (!ticketId || tickets.length === 0) return;
    if (deepLinkHandledRef.current === ticketId) return;
    const match = tickets.find((t) => t.id === ticketId);
    if (!match) return;
    deepLinkHandledRef.current = ticketId;
    setSelectedTicket(match);
  }, [searchParams, tickets]);

  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedTicket.id);
    const interval = setInterval(() => {
      void loadMessages(selectedTicket.id, true);
    }, SUPPORT_CHAT_POLL_MS);

    const onFocus = () => {
      void loadMessages(selectedTicket.id, true);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [selectedTicket?.id, loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket || !user) return;

    setSending(true);
    try {
      await supportApi.sendMessage(selectedTicket.id, {
        senderId: user.id,
        senderType: "Admin",
        message: newMessage
      });
      setNewMessage("");
      await loadMessages(selectedTicket.id, true);
      await loadTickets(true);
      void queryClient.invalidateQueries({ queryKey: ["admin-vendor-support-unread"] });
    } catch {
      toast.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket || !user) return;

    try {
      await supportApi.updateTicketStatus(selectedTicket.id, {
        status,
        adminId: user.id
      });
      toast.success(`Ticket status updated to ${status}`);
      setSelectedTicket({ ...selectedTicket, status });
      loadTickets();
    } catch (error) {
      toast.error("Failed to update status.");
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch =
      t.ticketNumber.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.vendorEmail?.toLowerCase().includes(q) ||
      t.vendorBusinessName?.toLowerCase().includes(q);

    const status = t.status.toLowerCase();
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "done"
        ? status === "closed" || status === "resolved"
        : status === statusFilter.toLowerCase());

    return matchesSearch && matchesStatus;
  });

  const selectTicket = (ticket: SupportTicketDto) => {
    setSelectedTicket(ticket);
    const next = new URLSearchParams(searchParams);
    next.set("ticketId", ticket.id);
    setSearchParams(next, { replace: true });
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "open": return <AlertCircle className="h-4 w-4 text-success" />;
      case "in progress": return <RefreshCw className="h-4 w-4 text-warning animate-spin-slow" />;
      case "resolved": return <CheckCircle2 className="h-4 w-4 text-info" />;
      case "closed": return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default: return <Ticket className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "open": return "bg-success/10 text-success border-success/20";
      case "in progress": return "bg-warning/10 text-warning border-warning/20";
      case "resolved": return "bg-info/10 text-info border-info/20";
      case "closed": return "bg-muted text-muted-foreground border-muted-foreground/20";
      default: return "bg-muted";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            Support Center
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Manage vendor support tickets and communications.</p>
        </div>
        <Button onClick={loadTickets} variant="outline" className="gap-2 font-bold shadow-sm" disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-220px)] min-h-[560px]">
        {/* Ticket List */}
        <Card className="lg:col-span-5 xl:col-span-4 flex flex-col overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="shrink-0 space-y-3 border-b border-border/70 px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Tickets</p>
              <span className="text-xs text-muted-foreground tabular-nums">
                {filteredTickets.length}
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ticket, vendor, email..."
                className="h-10 border-border/60 bg-background pl-9 shadow-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Tabs defaultValue="all" className="w-full" onValueChange={setStatusFilter}>
              <TabsList className="grid h-9 w-full grid-cols-4 bg-muted/60 p-1">
                <TabsTrigger value="all" className="text-xs font-semibold">All</TabsTrigger>
                <TabsTrigger value="open" className="text-xs font-semibold">Open</TabsTrigger>
                <TabsTrigger value="in progress" className="text-xs font-semibold">Active</TabsTrigger>
                <TabsTrigger value="done" className="text-xs font-semibold">Done</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-3">
              {loading ? (
                <div className="min-h-[8rem]" aria-busy="true" aria-label="Loading tickets" />
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center text-muted-foreground">
                  <Ticket className="mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm font-semibold text-foreground">No tickets found</p>
                  <p className="mt-1 text-xs">Try another search or status filter.</p>
                </div>
              ) : (
                filteredTickets.map((t) => {
                  const selected = selectedTicket?.id === t.id;
                  const unread = t.unreadCount ?? 0;
                  const vendorLabel = t.vendorBusinessName || t.vendorEmail || "Vendor";
                  const preview = t.latestMessage?.message?.trim();

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTicket(t)}
                      className={cn(
                        "w-full rounded-xl border px-3.5 py-3 text-left transition-all",
                        selected
                          ? "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/15"
                          : unread > 0
                            ? "border-primary/25 bg-card hover:border-primary/40 hover:bg-primary/[0.04]"
                            : "border-border/60 bg-card hover:border-border hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">
                          {t.ticketNumber}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {unread > 0 && (
                            <Badge className="h-5 min-w-5 justify-center border-none bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                              {unread > 9 ? "9+" : unread}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 border px-1.5 text-[10px] font-semibold uppercase tracking-wide",
                              getStatusBadge(t.status),
                            )}
                          >
                            {t.status}
                          </Badge>
                        </div>
                      </div>

                      <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                        {t.subject}
                      </p>

                      {preview ? (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {preview}
                        </p>
                      ) : null}

                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <span className="truncate text-xs font-medium text-foreground/80" title={vendorLabel}>
                            {vendorLabel}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(t.updatedAt ?? t.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat Area */}
        <Card className={cn(
            "lg:col-span-7 xl:col-span-8 flex flex-col overflow-hidden border-border/70 bg-secondary/15 shadow-sm",
          !selectedTicket && "items-center justify-center text-center p-12"
        )}>
          {selectedTicket ? (
            <>
              {/* Header */}
              <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between shadow-sm relative z-10">
                <div className="flex items-center gap-4">
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner", getStatusBadge(selectedTicket.status))}>
                    {getStatusIcon(selectedTicket.status)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-lg font-extrabold tracking-tight">{selectedTicket.ticketNumber}</h2>
                      <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 border-none font-bold uppercase", getStatusBadge(selectedTicket.status))}>
                        {selectedTicket.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                      <span className="text-primary font-bold">{selectedTicket.category}</span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {selectedTicket.vendorEmail}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="font-bold gap-2 shadow-sm border-slate-200">
                        Update Status
                        <ChevronRight className="h-4 w-4 rotate-90" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-1">
                      <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-2">Select Status</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleUpdateStatus("Open")} className="rounded-lg gap-2 focus:bg-success/10 focus:text-success">
                        <AlertCircle className="h-4 w-4" /> Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateStatus("In Progress")} className="rounded-lg gap-2 focus:bg-warning/10 focus:text-warning">
                        <RefreshCw className="h-4 w-4" /> In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateStatus("Resolved")} className="rounded-lg gap-2 focus:bg-info/10 focus:text-info">
                        <CheckCircle2 className="h-4 w-4" /> Resolved
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem onClick={() => handleUpdateStatus("Closed")} className="rounded-lg gap-2 focus:bg-slate-100 text-muted-foreground">
                        <XCircle className="h-4 w-4" /> Closed
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Subject Banner */}
              <div className="bg-primary/5 px-6 py-2.5 border-b flex items-center justify-between text-xs font-bold text-primary">
                 <span className="flex items-center gap-2"><Ticket className="h-3.5 w-3.5" /> SUBJECT: {selectedTicket.subject}</span>
                 <span className="flex items-center gap-1.5 opacity-60"><Clock className="h-3.5 w-3.5" /> CREATED {new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
                {messagesLoading ? (
                  <div className="flex h-full min-h-[8rem] items-center justify-center" aria-busy="true" aria-label="Loading messages" />
                ) : (
                  messages.map((m, index) => {
                    const prev = index > 0 ? messages[index - 1] : null;
                    const showDay = !prev || !isSameChatDay(prev.createdAt, m.createdAt);
                    return (
                    <div key={m.id} className="flex flex-col gap-2">
                      {showDay && <ChatDaySeparator date={m.createdAt} />}
                    <div 
                      className={cn(
                        "flex flex-col max-w-[75%]",
                        m.senderType === "Admin" ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {m.senderType === "Admin" ? "Support Team" : m.senderType === "AI" ? "AI Assistant" : "Vendor"}
                        </span>
                        {m.senderType === "AI" && (
                          <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-none bg-primary/5 text-primary font-bold uppercase">
                            AI
                          </Badge>
                        )}
                        <span className="text-[9px] text-slate-400 font-medium">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div 
                        className={cn(
                          "px-5 py-3 rounded-2xl text-[14px] shadow-sm leading-relaxed whitespace-pre-wrap",
                          m.senderType === "Admin" 
                            ? "bg-primary text-primary-foreground rounded-tr-none shadow-primary/10" 
                            : m.senderType === "AI"
                              ? "bg-card border border-primary/10 text-foreground rounded-tl-none"
                              : "bg-card border text-foreground rounded-tl-none"
                        )}
                        >
                          {m.message}
                          {m.attachmentUrls?.length ? m.attachmentUrls.map((url, i) => {
                            const cleanUrl = url.split("?")[0];
                            const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(cleanUrl);
                            return isImage ? (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                <img src={url} alt="attachment" className="max-w-[250px] rounded-lg border border-border/50" />
                              </a>
                            ) : (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block mt-2 text-xs font-medium text-primary hover:opacity-80 flex items-center gap-1.5 no-underline">
                                <FileText className="h-3.5 w-3.5" />
                                Download attachment
                              </a>
                            );
                          }) : null}
                        </div>
                      </div>
                    </div>
                    );
                  })
                  )}
                </div>

              {/* Input */}
              <div className="p-4 bg-card border-t border-border shadow-[0_-8px_30px_rgb(0,0,0,0.04)] relative z-10">
                {selectedTicket.status === "Closed" ? (
                  <div className="flex items-center justify-center p-4 bg-muted/30 rounded-2xl border border-dashed border-border">
                    <p className="text-sm font-bold text-muted-foreground flex items-center gap-2 italic">
                      <XCircle className="h-4 w-4" /> This ticket is closed. Reopen to send messages.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-3 items-end bg-muted/30 p-2 rounded-[2rem] border border-border focus-within:border-primary/30 focus-within:ring-4 focus-within:ring-primary/5 transition-all">
                    <ChatMessageTextarea
                      placeholder="Type your reply... (Shift+Enter for new line)"
                      className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 min-h-[48px] px-4 font-medium"
                      value={newMessage}
                      onChange={setNewMessage}
                      onSubmit={handleSendMessage}
                      submitDisabled={sending}
                      disabled={sending}
                      rows={1}
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="rounded-full h-12 px-6 bg-gradient-primary shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all font-bold gap-2"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send Reply
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center">
              <div className="h-24 w-24 rounded-[2rem] bg-primary/5 flex items-center justify-center mb-6 ring-1 ring-primary/10">
                <Ticket className="h-10 w-10 text-primary opacity-40" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight mb-2">No Ticket Selected</h2>
              <p className="text-muted-foreground max-w-sm font-medium">Select a support ticket from the list on the left to view details and start chatting with the vendor.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
