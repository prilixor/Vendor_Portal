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
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { chatApi, type ChatSessionApi } from "@/app/services/chatApi";
import { ChatMessageTextarea } from "@/app/components/shared/ChatMessageTextarea";
import { ChatDaySeparator } from "@/app/components/shared/ChatDaySeparator";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardHeader } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { isSameChatDay } from "@/app/helpers/chatDayLabel";
import { cn } from "@/app/helpers/utils";

const SESSIONS_POLL_MS = 10000;
const MESSAGES_POLL_MS = 5000;

export default function AdminCustomerChats() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionFromUrl = searchParams.get("sessionId");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionFromUrl);
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

  useEffect(() => {
    if (sessionFromUrl && sessionFromUrl !== selectedSessionId) {
      setSelectedSessionId(sessionFromUrl);
    }
  }, [sessionFromUrl]);

  const selectSession = (sessionId: string | null) => {
    setSelectedSessionId(sessionId);
    if (sessionId) {
      searchParams.set("sessionId", sessionId);
    } else {
      searchParams.delete("sessionId");
    }
    setSearchParams(searchParams, { replace: true });
  };

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

  // Opening a thread marks customer messages read — refresh badges.
  useEffect(() => {
    if (!selectedSessionId || loadingMessages) return;
    void queryClient.invalidateQueries({ queryKey: ["admin-customer-chat-sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-customer-chat-unread"] });
  }, [selectedSessionId, loadingMessages, messages.length, queryClient]);

  const sendMut = useMutation({
    mutationFn: (text: string) => chatApi.sendAdminMessage(selectedSessionId!, text),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({
        queryKey: ["admin-customer-chat-messages", selectedSessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-customer-chat-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-customer-chat-unread"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to send message."),
  });

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = !term
      ? [...sessions]
      : sessions.filter(
          (s) =>
            s.customerName.toLowerCase().includes(term) ||
            (s.subject && s.subject.toLowerCase().includes(term)) ||
            (s.orderNumber && s.orderNumber.toLowerCase().includes(term)) ||
            (s.vendorName && s.vendorName.toLowerCase().includes(term)),
        );

    return list.sort((a, b) => {
      const unreadA = (a.unreadCount ?? 0) > 0 ? 1 : 0;
      const unreadB = (b.unreadCount ?? 0) > 0 ? 1 : 0;
      if (unreadA !== unreadB) return unreadB - unreadA;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [sessions, search]);

  const showListOnMobile = !selectedSessionId;
  const showChatOnMobile = !!selectedSessionId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-foreground">
            <MessageSquare className="h-8 w-8 shrink-0 text-primary" />
            <span className="truncate">Customer Order Chats</span>
          </h1>
          <p className="mt-1 font-medium text-muted-foreground">
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

      <div className="grid min-h-[560px] grid-cols-1 gap-5 lg:h-[calc(100vh-220px)] lg:grid-cols-12">
        {/* Session list — same card pattern as Vendor Support Center */}
        <Card
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-border/70 shadow-sm",
            "lg:col-span-5 xl:col-span-4",
            showListOnMobile ? "flex" : "hidden",
            "lg:flex",
          )}
        >
          <CardHeader className="shrink-0 space-y-3 border-b border-border/70 px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Conversations</p>
              <span className="text-xs tabular-nums text-muted-foreground">
                {filteredSessions.length}
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customer, order..."
                className="h-10 border-border/60 bg-background pl-9 shadow-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-2 p-3">
              {loadingSessions ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <Loader2 className="mb-4 h-7 w-7 animate-spin text-primary" />
                  <p className="text-sm font-medium">Loading chats...</p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center text-muted-foreground">
                  <MessageSquare className="mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm font-semibold text-foreground">No customer chats yet</p>
                  <p className="mt-1 text-xs">
                    Chats appear when customers message from an order.
                  </p>
                </div>
              ) : (
                filteredSessions.map((s) => {
                  const selected = selectedSessionId === s.id;
                  const unread = s.unreadCount ?? 0;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => selectSession(s.id)}
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
                        <span className="truncate font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">
                          {s.orderNumber || "No order"}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {unread > 0 && (
                            <Badge className="h-5 min-w-5 justify-center border-none bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                              {unread > 9 ? "9+" : unread}
                            </Badge>
                          )}
                          {s.isClosed ? (
                            <Badge
                              variant="outline"
                              className="h-5 border px-1.5 text-[10px] font-semibold uppercase tracking-wide"
                            >
                              Closed
                            </Badge>
                          ) : (
                            <Badge className="h-5 border-none bg-success/10 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                              Open
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p
                        className={cn(
                          "mt-1.5 line-clamp-2 text-sm leading-snug text-foreground",
                          unread > 0 ? "font-bold" : "font-semibold",
                        )}
                      >
                        {s.subject || "Order chat"}
                      </p>

                      {s.vendorName ? (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          Vendor: {s.vendorName}
                        </p>
                      ) : null}

                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <span
                            className="truncate text-xs font-medium text-foreground/80"
                            title={s.customerName}
                          >
                            {s.customerName}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(s.lastMessageAt), { addSuffix: true })}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Conversation — replaces list on mobile when a session is selected */}
        <Card
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-border/70 bg-secondary/15 shadow-sm",
            "lg:col-span-7 xl:col-span-8",
            showChatOnMobile ? "flex" : "hidden",
            "lg:flex",
            !activeSession && "items-center justify-center p-8 text-center sm:p-12",
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
              <div className="relative z-10 flex shrink-0 flex-col gap-3 border-b border-border bg-card px-3 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-8 w-8 shrink-0 lg:hidden"
                    onClick={() => selectSession(null)}
                    aria-label="Back to chat list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-extrabold tracking-tight">
                        {activeSession.customerName}
                      </h2>
                      {activeSession.isClosed ? (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          Closed
                        </Badge>
                      ) : (
                        <Badge className="border-none bg-success/10 text-[10px] uppercase text-success">
                          Open
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {activeSession.subject}
                      {activeSession.vendorName ? ` · Vendor: ${activeSession.vendorName}` : ""}
                    </p>
                  </div>
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
                    messages.map((msg, index) => {
                      const isAdmin = msg.senderType === "Admin";
                      const prev = index > 0 ? messages[index - 1] : null;
                      const showDay = !prev || !isSameChatDay(prev.sentAt, msg.sentAt);
                      return (
                        <div key={msg.id} className="flex flex-col space-y-3">
                          {showDay && <ChatDaySeparator date={msg.sentAt} />}
                          <div
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
