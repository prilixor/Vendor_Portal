import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MessageCircle, X, Send, Loader2, Paperclip, Bot, User, FileText, Plus, Ticket, ChevronLeft, AlertCircle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { ChatMessageTextarea } from "@/app/components/shared/ChatMessageTextarea";
import { FileUploadZone } from "@/app/components/shared/FileUploadZone";
import { Badge } from "@/app/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { supportApi, SupportMessageDto, SupportTicketDto, AiChatResult } from "@/app/services/supportApi";
import { useSupportChat } from "@/app/contexts/SupportChatContext";
import { cn } from "@/app/helpers/utils";
import { shouldUseAiChat } from "@/app/helpers/supportChatRouting";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface SupportChatProps {
  vendorId: string;
}

const SUPPORT_CHAT_POLL_MS = 3000;

const QUICK_REPLIES = [
  { label: "Product Issue", icon: "📦", category: "Products" },
  { label: "Account Issue", icon: "👤", category: "Account" },
  { label: "Document Issue", icon: "📄", category: "Documents" },
  { label: "Verification Issue", icon: "✅", category: "Verification" },
  { label: "Inventory Issue", icon: "📊", category: "Inventory" },
];

const getStatusBadgeClasses = (status: string) => {
  switch (status.toLowerCase()) {
    case "open": return "bg-success/10 text-success border-success/20";
    case "in progress": return "bg-warning/10 text-warning border-warning/20";
    case "resolved": return "bg-info/10 text-info border-info/20";
    case "closed": return "bg-muted text-muted-foreground border-muted-foreground/20";
    default: return "bg-muted";
  }
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case "open": return <AlertCircle className="h-3.5 w-3.5 text-success" />;
    case "in progress": return <RefreshCw className="h-3.5 w-3.5 text-warning" />;
    case "resolved": return <CheckCircle2 className="h-3.5 w-3.5 text-info" />;
    case "closed": return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    default: return <Ticket className="h-3.5 w-3.5" />;
  }
};

export const SupportChat = ({ vendorId }: SupportChatProps) => {
  const { pendingRequest, consumePendingRequest } = useSupportChat();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"welcome" | "chat" | "tickets">("welcome");
  const [messages, setMessages] = useState<SupportMessageDto[]>([]);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load tickets when widget opens or ticket list view is shown
  useEffect(() => {
    if (isOpen && view === "tickets") {
      loadTickets();
    }
  }, [isOpen, view]);

  const refreshActiveConversation = useCallback(async () => {
    if (!ticketId) return;
    try {
      const [msgs, ticketList] = await Promise.all([
        supportApi.getTicketMessages(ticketId),
        supportApi.getVendorTickets(vendorId),
      ]);
      setMessages(msgs);
      const active = ticketList.find((t) => t.id === ticketId);
      if (active) {
        setTicketStatus(active.status);
      }
    } catch {
      // silent background refresh
    }
  }, [ticketId, vendorId]);

  // Poll for new messages while chat is open (admin replies, etc.)
  useEffect(() => {
    if (!ticketId || !isOpen || view !== "chat") return;

    void refreshActiveConversation();
    const interval = setInterval(() => {
      void refreshActiveConversation();
    }, SUPPORT_CHAT_POLL_MS);

    const onFocus = () => {
      void refreshActiveConversation();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [ticketId, isOpen, view, refreshActiveConversation]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, aiThinking]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      const data = await supportApi.getVendorTickets(vendorId);
      setTickets(data);
    } catch {
      toast.error("Failed to load tickets.");
    } finally {
      setTicketsLoading(false);
    }
  };

  const loadMessagesForTicket = async (t: SupportTicketDto) => {
    setTicketId(t.id);
    setTicketStatus(t.status);
    try {
      const msgs = await supportApi.getTicketMessages(t.id);
      setMessages(msgs);
      setView("chat");
    } catch {
      toast.error("Failed to load messages.");
    }
  };

  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);

  const handleSendMessage = async (
    text: string,
    category?: string,
    fileUrls?: string[],
    forceNewTicket = false,
  ) => {
    if (!text.trim() || vendorId === "undefined") return;

    const useAi = shouldUseAiChat({
      ticketId,
      ticketStatus,
      messages,
      forceNewTicket,
    });

    setAiThinking(useAi);

    // Add optimistic user message
    const optimisticMsg: SupportMessageDto = {
      id: `temp-${Date.now()}`,
      ticketId: ticketId ?? "",
      senderId: vendorId,
      senderType: "Vendor",
      message: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage("");

    try {
      let activeTicketId = ticketId;

      if (useAi) {
        const result = await supportApi.aiChat({
          vendorId,
          message: text.trim(),
          category: category,
          forceNewTicket: forceNewTicket && ticketId === null,
          attachmentUrls: fileUrls,
        });

        activeTicketId = result.ticket.id;
        setTicketId(result.ticket.id);
        setTicketStatus(result.ticket.status);
      } else {
        if (!ticketId) {
          throw new Error("Missing active ticket.");
        }

        await supportApi.sendMessage(ticketId, {
          senderId: vendorId,
          senderType: "Vendor",
          message: text.trim(),
        });

        const tickets = await supportApi.getVendorTickets(vendorId);
        const active = tickets.find((ticket) => ticket.id === ticketId);
        if (active) {
          setTicketStatus(active.status);
        }
      }

      setView("chat");

      if (activeTicketId) {
        const msgs = await supportApi.getTicketMessages(activeTicketId);
        setMessages(msgs);
      }
    } catch {
      toast.error("Failed to send message. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } finally {
      setAiThinking(false);
      scrollToBottom();
    }
  };

  const handleQuickReply = (label: string, category: string) => {
    handleSendMessage(label, category);
  };

  useEffect(() => {
    if (!pendingRequest) return;

    const request = pendingRequest;
    consumePendingRequest();

    setIsOpen(true);
    setView("chat");
    setTicketId(null);
    setTicketStatus(null);
    setMessages([]);
    setNewMessage("");
    setAiThinking(false);

    void handleSendMessage(
      request.message,
      request.category,
      undefined,
      true,
    );
  }, [pendingRequest, consumePendingRequest]);

  const handleNewConversation = () => {
    setTicketId(null);
    setTicketStatus(null);
    setMessages([]);
    setNewMessage("");
    setAiThinking(false);
    setView("welcome");
  };

  const isTicketLocked = ticketStatus === "Closed";

  const waitingForHumanSupport = useMemo(() => {
    if (messages.length === 0 || aiThinking) return false;
    const hasAdmin = messages.some((m) => m.senderType === "Admin");
    if (hasAdmin) return false;
    const hasEscalation = messages.some(
      (m) =>
        m.senderType === "AI"
        && m.message.toLowerCase().includes("support team will assist"),
    );
    const last = messages[messages.length - 1];
    return hasEscalation && last?.senderType === "Vendor";
  }, [messages, aiThinking]);

  const uploadAttachment = async (file: File) => {
    try {
      const result = await supportApi.uploadFile(vendorId, file);
      const fileUrls = [result.fileUrl];
      await handleSendMessage(`📎 Attached: ${result.originalFileName}`, undefined, fileUrls);
      setAttachOpen(false);
    } catch {
      toast.error("Failed to upload file.");
    }
  };

  const getAttachmentPreview = (msg: SupportMessageDto) => {
    if (!msg.attachmentUrls?.length) return null;
    return msg.attachmentUrls.map((url, i) => {
      // Strip query params for extension detection (S3 presigned URLs have query strings)
      const cleanUrl = url.split("?")[0];
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(cleanUrl);
      return isImage ? (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
          <img src={url} alt="attachment" className="max-w-[200px] rounded-lg border border-border/50" />
        </a>
      ) : (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block mt-2 text-xs font-medium text-primary hover:opacity-80 flex items-center gap-1.5 no-underline">
          <FileText className="h-3.5 w-3.5" />
          Download attachment
        </a>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {/* Chat Window */}
      {isOpen && (
        <Card className="w-[380px] h-[600px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-120px)] flex flex-col overflow-hidden shadow-2xl border-primary/10 animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary/80 p-4 pb-3 text-white flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              {view !== "welcome" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                  onClick={() => setView("welcome")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">
                  {view === "tickets" ? "My Tickets" : "BlinksMed Support"}
                </h3>
                <p className="text-[10px] opacity-80 font-medium">We typically reply instantly</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {view === "welcome" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                  onClick={() => setView("tickets")}
                  title="View Tickets"
                >
                  <Ticket className="h-4 w-4" />
                </Button>
              ) : view === "chat" && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                    onClick={() => setView("tickets")}
                    title="View Tickets"
                  >
                    <Ticket className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                    onClick={handleNewConversation}
                    title="New Conversation"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Ticket List View */}
          {view === "tickets" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-secondary/30 to-background">
              {ticketsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                  <Ticket className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">No tickets yet.</p>
                  <p className="text-xs">Start a conversation to create one.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-full"
                    onClick={() => setView("welcome")}
                  >
                    <Plus className="h-3 w-3 mr-1" /> New Conversation
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider px-1">
                    Your Support Tickets ({tickets.length})
                  </p>
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => loadMessagesForTicket(t)}
                      className="p-3 rounded-xl border bg-card shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground group-hover:text-primary transition-colors">
                          {t.ticketNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(t.status)}
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1.5 py-0 h-4 border-none font-bold uppercase",
                              getStatusBadgeClasses(t.status)
                            )}
                          >
                            {t.status}
                          </Badge>
                        </div>
                      </div>
                      <h4 className="text-[13px] font-bold truncate group-hover:text-primary transition-colors">
                        {t.subject}
                      </h4>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground">{t.category}</span>
                        <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                          {formatDistanceToNow(new Date(t.updatedAt ?? t.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Welcome / Chat View */}
          {(view === "welcome" || view === "chat") && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-secondary/30 to-background" ref={scrollRef}>
                {/* AI Welcome Message */}
                {view === "welcome" && (
                  <div className="flex flex-col items-start gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        BlinksMed Assistant
                      </span>
                    </div>
                    <div className="bg-card border border-primary/10 rounded-2xl rounded-tl-none px-5 py-3.5 text-sm shadow-sm max-w-[90%]">
                      <p className="font-medium text-foreground">
                        👋 Hi! I'm <strong>BlinksMed Support Assistant</strong>.
                      </p>
                      <p className="text-muted-foreground mt-1">
                        How can I help you today? You can choose a topic below or just type your question.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 mb-2">
                      {QUICK_REPLIES.map((qr) => (
                        <button
                          key={qr.label}
                          onClick={() => handleQuickReply(qr.label, qr.category)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-card border border-border hover:border-primary/30 hover:bg-primary/10 dark:hover:bg-primary/5 rounded-full text-xs font-semibold text-foreground shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                          <span>{qr.icon}</span>
                          <span>{qr.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                {view === "chat" && messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[88%]",
                      msg.senderType === "Vendor" ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      {msg.senderType === "AI" && (
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-3 w-3 text-primary" />
                        </div>
                      )}
                      {msg.senderType === "Admin" && (
                        <div className="h-5 w-5 rounded-full bg-warning/10 flex items-center justify-center">
                          <User className="h-3 w-3 text-warning" />
                        </div>
                      )}
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        {msg.senderType === "AI" ? "Assistant" : msg.senderType === "Admin" ? "Support Team" : "You"}
                      </span>
                      {msg.senderType === "AI" && (
                        <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5 border-none bg-primary/5 text-primary font-bold uppercase">
                          AI
                        </Badge>
                      )}
                      <span className="text-[8px] text-slate-400 font-medium">
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "px-4 py-2.5 rounded-2xl text-sm shadow-sm leading-relaxed break-words whitespace-pre-wrap",
                        msg.senderType === "Vendor"
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : msg.senderType === "AI"
                            ? "bg-card border border-primary/10 rounded-tl-none"
                            : "bg-card border border-warning/20 rounded-tl-none"
                      )}
                    >
                      {msg.message}
                      {getAttachmentPreview(msg)}
                    </div>
                  </div>
                ))}

                {/* Ticket Status Banner */}
                {ticketStatus && (
                  <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-t border-border pt-3 mt-2">
                    {getStatusIcon(ticketStatus)}
                    <span>Ticket Status:</span>
                    <Badge variant="outline" className={cn("text-[9px] px-2 py-0.5 border-none font-bold uppercase", getStatusBadgeClasses(ticketStatus))}>
                      {ticketStatus}
                    </Badge>
                  </div>
                )}

                {waitingForHumanSupport && (
                  <p className="text-center text-xs text-muted-foreground pb-1">
                    Message received · waiting for support team
                  </p>
                )}

                {/* AI Typing Indicator */}
                {aiThinking && view === "chat" && (
                  <div className="flex flex-col items-start gap-2">
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Assistant</span>
                    </div>
                <div className="bg-card border border-primary/10 rounded-2xl rounded-tl-none px-5 py-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground font-medium">Thinking...</span>
                  </div>
                </div>
                  </div>
                )}
              </div>

              {/* Input Bar */}
              <div className="shrink-0 border-t border-border bg-background px-4 py-3 space-y-2">
                {isTicketLocked ? (
                  <div className="flex items-center justify-center py-3 text-xs text-muted-foreground font-medium italic bg-muted/30 rounded-2xl border border-dashed border-border">
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    This ticket is {ticketStatus?.toLowerCase()}. Start a new conversation for further help.
                  </div>
                ) : (
                  <div className="flex items-end gap-2.5">
                    <Popover open={attachOpen} onOpenChange={setAttachOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mb-0.5 h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5"
                          disabled={aiThinking}
                          aria-label="Attach file"
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="top" align="start" className="w-[min(92vw,320px)] p-3">
                        <FileUploadZone
                          compact
                          hideLabel
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                          hint="Images, PDF, DOC, XLS, TXT"
                          showPreview={false}
                          disabled={aiThinking}
                          onFilesSelected={(files) => void uploadAttachment(files[0])}
                          dropTitle="Attach a file"
                          dropDescription="Drag & drop or click to browse from your device"
                          browseButtonLabel="Browse attachment"
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-border bg-muted/30 px-3 py-2 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
                      <ChatMessageTextarea
                        placeholder="Type your question…"
                        className="min-h-[48px] max-h-[120px] flex-1 border-none bg-transparent px-0 py-2 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
                        value={newMessage}
                        onChange={setNewMessage}
                        onSubmit={() => {
                          if (newMessage.trim() && !aiThinking) {
                            handleSendMessage(newMessage);
                          }
                        }}
                        submitDisabled={aiThinking}
                        disabled={aiThinking}
                        rows={2}
                      />
                      <Button
                        size="icon"
                        onClick={() => handleSendMessage(newMessage)}
                        disabled={aiThinking || !newMessage.trim()}
                        className="mb-0.5 h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md disabled:opacity-50"
                      >
                        {aiThinking ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-center text-[10px] leading-relaxed text-muted-foreground/55">
                  Powered by AI · Admin may reply for urgent issues
                </p>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Floating Button — Icon only */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className={cn(
          "h-14 w-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group relative",
          isOpen ? "bg-white text-primary border border-primary/20 shadow-xl" : "bg-gradient-to-r from-primary to-primary/80 text-white shadow-xl"
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="h-7 w-7" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
          </div>
        )}
        {!isOpen && (
          <div className="absolute -top-12 right-0 bg-card text-foreground text-[11px] font-bold py-1.5 px-3 rounded-full shadow-lg border border-border whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            Need help? Chat with us!
            <div className="absolute -bottom-1 right-6 w-2 h-2 bg-card border-r border-b border-border rotate-45" />
          </div>
        )}
      </Button>
    </div>
  );
};