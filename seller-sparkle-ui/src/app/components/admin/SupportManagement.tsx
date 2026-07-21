import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Ticket, 
  MessageSquare, 
  Search, 
  Filter, 
  ChevronRight, 
  Clock, 
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
  ImageIcon
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { ChatMessageTextarea } from "@/app/components/shared/ChatMessageTextarea";
import { Badge } from "@/app/components/ui/badge";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
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

  useEffect(() => {
    selectedTicketIdRef.current = selectedTicket?.id ?? null;
  }, [selectedTicket?.id]);

  useEffect(() => {
    void loadTickets();
    const interval = setInterval(() => {
      void loadTickets(true);
    }, SUPPORT_TICKETS_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const loadTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await supportApi.getAllTickets();
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
    } catch (error) {
      if (!silent) toast.error("Failed to load tickets.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = useCallback(async (ticketId: string, silent = false) => {
    if (!silent) setMessagesLoading(true);
    try {
      const data = await supportApi.getTicketMessages(ticketId);
      setMessages(data);
    } catch (error) {
      if (!silent) toast.error("Failed to load messages.");
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, []);

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
    } catch (error) {
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

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.vendorEmail?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || t.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-250px)]">
        {/* Ticket List */}
        <Card className="lg:col-span-4 flex flex-col overflow-hidden shadow-xl border-primary/5">
          <CardHeader className="px-4 py-4 space-y-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search tickets, email..." 
                className="pl-9 h-11 bg-muted/30 border-none shadow-inner"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Tabs defaultValue="all" className="w-full" onValueChange={setStatusFilter}>
              <TabsList className="grid grid-cols-4 w-full h-10 p-1 bg-muted/50">
                <TabsTrigger value="all" className="text-[10px] font-bold uppercase">All</TabsTrigger>
                <TabsTrigger value="open" className="text-[10px] font-bold uppercase">Open</TabsTrigger>
                <TabsTrigger value="in progress" className="text-[10px] font-bold uppercase">Active</TabsTrigger>
                <TabsTrigger value="closed" className="text-[10px] font-bold uppercase">Done</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <ScrollArea className="flex-1 bg-secondary/20">
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                  <p className="text-sm font-bold animate-pulse">Loading tickets...</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-center">
                  <Ticket className="h-12 w-12 mb-4 opacity-10" />
                  <p className="text-sm font-bold">No tickets found</p>
                  <p className="text-xs">Adjust your search or filters.</p>
                </div>
              ) : (
                filteredTickets.map((t) => (
                  <div 
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer group relative overflow-hidden",
                      selectedTicket?.id === t.id 
                        ? "bg-card border-primary shadow-lg ring-1 ring-primary/20" 
                        : "bg-card/50 border-transparent hover:bg-card hover:border-border"
                    )}
                  >
                    {selectedTicket?.id === t.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground group-hover:text-primary transition-colors">{t.ticketNumber}</span>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 border-none font-bold uppercase", getStatusBadge(t.status))}>
                        {t.status}
                      </Badge>
                    </div>
                    <h4 className="text-[13px] font-bold truncate group-hover:text-primary transition-colors">{t.subject}</h4>
                    <div className="flex items-center justify-between mt-2">
                       <div className="flex items-center gap-1.5 min-w-0">
                          <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <User className="h-3 w-3 text-slate-500" />
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{t.vendorEmail}</span>
                       </div>
                       <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                         {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                       </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat Area */}
        <Card className={cn(
            "lg:col-span-8 flex flex-col overflow-hidden shadow-2xl border-primary/5 bg-secondary/20",
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
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
                  </div>
                ) : (
                  messages.map((m) => (
                    <div 
                      key={m.id}
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
                          {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
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
                    ))
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
