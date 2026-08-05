import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Hash,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { chatApi, type ChatSessionApi } from "@/app/services/chatApi";
import { ChatMessageTextarea } from "@/app/components/shared/ChatMessageTextarea";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardHeader } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { cn } from "@/app/helpers/utils";

const SESSIONS_POLL_MS = 10000;
const MESSAGES_POLL_MS = 5000;

export default function AdminCustomerChats() {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    data: sessions = [],
    isLoading: loadingSessions,
    refetch: refetchSessions,
    isFetching: fetchingSessions,
  } = useQuery({
    queryKey: ["admin-customer-chat-sessions"],
    queryFn: () => chatApi.getAdminSessions(),
    refetchInterval: SESSIONS_POLL_MS,
  });

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) ?? null;
  }, [sessions, selectedSessionId]);

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["admin-customer-chat-messages", selectedSessionId],
    queryFn: () => chatApi.getAdminMessages(selectedSessionId!),
    enabled: !!selectedSessionId,
    refetchInterval: MESSAGES_POLL_MS,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: (text: string) => chatApi.sendAdminMessage(selectedSessionId!, text),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({
        queryKey: ["admin-customer-chat-messages", selectedSessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-customer-chat-sessions"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to send message."),
  });

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sessions;
    return sessions.filter(
      (s) =>
        s.customerName.toLowerCase().includes(term) ||
        (s.subject && s.subject.toLowerCase().includes(term)) ||
        (s.orderNumber && s.orderNumber.toLowerCase().includes(term)) ||
        (s.vendorName && s.vendorName.toLowerCase().includes(term))
    );
  }, [sessions, search]);

  const renderSessionMeta = (s: ChatSessionApi) => (
    <div className="mt-2 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100">
          <User className="h-3 w-3 text-slate-500" />
        </div>
        <span className="truncate text-[10px] text-muted-foreground">{s.customerName}</span>
      </div>
      <span className="whitespace-nowrap text-[9px] font-bold text-slate-400">
        {formatDistanceToNow(new Date(s.lastMessageAt), { addSuffix: true })}
      </span>
    </div>
  );

  const showListOnMobile = !selectedSessionId;
  const showChatOnMobile = !!selectedSessionId;

  return (
    <div className="flex min-h-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground sm:gap-3 sm:text-3xl">
            <MessageSquare className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" />
            <span className="truncate">Customer Order Chats</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground sm:text-base">
            Reply to customer chats started from order details.
          </p>
        </div>
        <Button
          onClick={() => void refetchSessions()}
          variant="outline"
          className="w-full gap-2 font-bold shadow-sm sm:w-auto"
          disabled={fetchingSessions}
        >
          <RefreshCw className={cn("h-4 w-4", fetchingSessions && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid min-h-[min(70dvh,640px)] grid-cols-1 gap-4 lg:h-[calc(100dvh-220px)] lg:grid-cols-12 lg:gap-6">
        {/* Session list — full width on mobile until a chat is opened */}
        <Card
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-primary/5 shadow-xl",
            "lg:col-span-4",
            showListOnMobile ? "flex" : "hidden",
            "lg:flex"
          )}
        >
          <CardHeader className="space-y-4 border-b border-border px-3 py-3 sm:px-4 sm:py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customer, order..."
                className="h-11 border-none bg-muted/30 pl-9 shadow-inner"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <ScrollArea className="min-h-0 flex-1 bg-secondary/20">
            <div className="space-y-1 p-2">
              {loadingSessions ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
                  <p className="animate-pulse text-sm font-bold">Loading chats...</p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <MessageSquare className="mb-4 h-12 w-12 opacity-10" />
                  <p className="text-sm font-bold">No customer chats yet</p>
                  <p className="text-xs">Chats appear when customers message from an order.</p>
                </div>
              ) : (
                filteredSessions.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className={cn(
                      "relative w-full overflow-hidden rounded-xl border p-3 text-left transition-all",
                      selectedSessionId === s.id
                        ? "border-primary bg-card shadow-lg ring-1 ring-primary/20"
                        : "border-transparent bg-card/50 hover:border-border hover:bg-card"
                    )}
                  >
                    {selectedSessionId === s.id && (
                      <div className="absolute bottom-0 left-0 top-0 w-1 bg-primary" />
                    )}
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[10px] font-bold text-muted-foreground">
                        {s.orderNumber || "No order"}
                      </span>
                      {s.isClosed ? (
                        <Badge variant="outline" className="shrink-0 text-[9px] uppercase">Closed</Badge>
                      ) : (
                        <Badge className="shrink-0 border-none bg-success/10 text-[9px] uppercase text-success">
                          Open
                        </Badge>
                      )}
                    </div>
                    <h4 className="truncate text-[13px] font-bold transition-colors group-hover:text-primary">
                      {s.subject || "Order chat"}
                    </h4>
                    {renderSessionMeta(s)}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Conversation — replaces list on mobile when a session is selected */}
        <Card
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-primary/5 bg-secondary/20 shadow-2xl",
            "lg:col-span-8",
            showChatOnMobile ? "flex" : "hidden",
            "lg:flex",
            !activeSession && "items-center justify-center p-8 text-center sm:p-12"
          )}
        >
          {!activeSession ? (
            <div className="hidden text-muted-foreground lg:block">
              <MessageSquare className="mx-auto mb-4 h-16 w-16 opacity-10" />
              <p className="text-lg font-bold">Select a conversation</p>
              <p className="text-sm">Choose a customer order chat from the left to reply.</p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-3 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 lg:hidden"
                      onClick={() => setSelectedSessionId(null)}
                      aria-label="Back to chat list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="truncate text-base font-extrabold tracking-tight sm:text-lg">
                      {activeSession.customerName}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-10 lg:pl-0">
                    {activeSession.orderNumber && (
                      <Badge variant="outline" className="max-w-full truncate font-mono text-[10px]">
                        <Hash className="mr-1 h-3 w-3 shrink-0" />
                        <span className="truncate">{activeSession.orderNumber}</span>
                      </Badge>
                    )}
                    {activeSession.orderId && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                        <Link to={`/admin/orders/${activeSession.orderId}`}>View order</Link>
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 pl-10 text-xs font-medium text-muted-foreground sm:text-sm lg:pl-0">
                    {activeSession.subject}
                    {activeSession.vendorName ? ` • Vendor: ${activeSession.vendorName}` : ""}
                  </p>
                </div>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-3 p-3 sm:p-6">
                  {loadingMessages ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      No messages yet. Reply to start helping this customer.
                    </p>
                  ) : (
                    messages.map((msg) => {
                      const isAdmin = msg.senderType === "Admin";
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex w-fit max-w-[85%] flex-col rounded-lg p-3 text-sm shadow-sm sm:max-w-[80%]",
                            isAdmin
                              ? "ml-auto self-end rounded-tr-none bg-primary text-primary-foreground"
                              : "mr-auto self-start rounded-tl-none border bg-card text-foreground"
                          )}
                        >
                          <span className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-80">
                            {isAdmin ? "You (Admin)" : "Customer"}
                          </span>
                          <p className="break-words whitespace-pre-wrap leading-relaxed">{msg.messageText}</p>
                          <span className="mt-1.5 self-end text-[10px] font-semibold opacity-75">
                            {new Date(msg.sentAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="shrink-0 border-t bg-card p-3 sm:p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!replyText.trim() || sendMut.isPending || activeSession.isClosed) return;
                    sendMut.mutate(replyText.trim());
                  }}
                  className="flex items-end gap-2"
                >
                  <ChatMessageTextarea
                    placeholder={
                      activeSession.isClosed
                        ? "This chat is closed"
                        : "Type a reply..."
                    }
                    value={replyText}
                    onChange={setReplyText}
                    onSubmit={() => {
                      if (!replyText.trim() || sendMut.isPending || activeSession.isClosed) return;
                      sendMut.mutate(replyText.trim());
                    }}
                    submitDisabled={sendMut.isPending || activeSession.isClosed}
                    disabled={sendMut.isPending || activeSession.isClosed}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="shrink-0"
                    disabled={sendMut.isPending || !replyText.trim() || activeSession.isClosed}
                  >
                    {sendMut.isPending ? "Sending..." : "Send"}
                  </Button>
                </form>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
