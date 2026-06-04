import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/guards/AuthContext";
import { chatApi, type ChatSessionApi, type ChatMessageApi } from "@/app/services/chatApi";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Separator } from "@/app/components/ui/separator";
import { Skeleton } from "@/app/components/ui/skeleton";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { MessageSquare, Send, Search, ExternalLink, User, Hash } from "lucide-react";
import { cn } from "@/app/helpers/utils";

const VendorChats = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const vendorId = user?.id || "";

  // 1. Fetch chat sessions for vendor
  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["vendor-chat-sessions", vendorId],
    queryFn: () => chatApi.getVendorSessions(vendorId),
    enabled: !!vendorId,
    refetchInterval: 10000, // Poll sessions list every 10 seconds
  });

  // Find active selected session object
  const activeSession = useMemo(() => {
    if (!sessions) return null;
    return sessions.find((s) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  // 2. Fetch messages in active session
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["vendor-chat-messages", vendorId, selectedSessionId],
    queryFn: () => chatApi.getVendorMessages(vendorId, selectedSessionId!),
    enabled: !!vendorId && !!selectedSessionId,
    refetchInterval: 5000, // Poll messages in active thread every 5 seconds
  });

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // 3. Send message mutation
  const sendReplyMut = useMutation({
    mutationFn: (text: string) =>
      chatApi.sendVendorMessage(vendorId, selectedSessionId!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vendor-chat-messages", vendorId, selectedSessionId],
      });
      setReplyText("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to send message.");
    },
  });

  // Filter sessions by customer name or subject
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return sessions;
    return sessions.filter(
      (s) =>
        s.customerName.toLowerCase().includes(term) ||
        (s.subject && s.subject.toLowerCase().includes(term)) ||
        (s.orderNumber && s.orderNumber.toLowerCase().includes(term))
    );
  }, [sessions, searchTerm]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || sendReplyMut.isPending) return;
    sendReplyMut.mutate(replyText.trim());
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-4">
      <PageHeader
        title="Direct Messages"
        description="Communicate directly with your customers regarding active orders and rental inquiries."
      />

      <div className="flex flex-1 overflow-hidden rounded-xl border border-border bg-card/65 backdrop-blur-md shadow-lg">
        {/* Sessions Sidebar Pane */}
        <div className="w-80 flex flex-col border-r border-border bg-muted/20">
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              {loadingSessions ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="space-y-2 flex-1 min-w-0">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <p className="text-xs text-muted-foreground font-medium">No conversations found</p>
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const isSelected = session.id === selectedSessionId;
                  const initials = session.customerName
                    ? session.customerName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()
                    : "C";
                  return (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all duration-200",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-md scale-[1.01]"
                          : "hover:bg-accent/40 text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border",
                          isSelected
                            ? "bg-primary-foreground/15 border-primary-foreground/30 text-primary-foreground"
                            : "bg-muted border-border text-muted-foreground"
                        )}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold truncate leading-none">
                            {session.customerName}
                          </p>
                          <span
                            className={cn(
                              "text-[10px] tabular-nums",
                              isSelected ? "text-primary-foreground/75" : "text-muted-foreground"
                            )}
                          >
                            {new Date(session.lastMessageAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "text-xs truncate leading-snug",
                            isSelected ? "text-primary-foreground/90" : "text-muted-foreground"
                          )}
                        >
                          {session.subject || "No Subject"}
                        </p>
                        {session.orderNumber && (
                          <div className="flex items-center gap-1 mt-1 text-[10px]">
                            <Hash className="h-3 w-3 opacity-60" />
                            <span className="font-mono truncate">{session.orderNumber}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Conversation Thread Pane */}
        <div className="flex-1 flex flex-col bg-background">
          {activeSession ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">{activeSession.customerName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{activeSession.subject}</p>
                </div>
                {activeSession.orderId && (
                  <Button variant="outline" size="sm" asChild className="text-xs gap-1.5 h-8">
                    <Link to={`/vendor/orders?orderId=${activeSession.orderId}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Order
                    </Link>
                  </Button>
                )}
              </div>

              {/* Thread Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingMessages ? (
                  <div className="space-y-4">
                    <div className="flex gap-2 max-w-[70%]">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <Skeleton className="h-14 w-full rounded-lg" />
                    </div>
                    <div className="flex gap-2 max-w-[70%] ml-auto">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    </div>
                  </div>
                ) : !messages || messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-xs">No messages yet. Send a message to open communication.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isMe = msg.senderType === "Vendor";
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex items-end gap-2 max-w-[80%]",
                            isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                          )}
                        >
                          <div
                            className={cn(
                              "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border bg-muted text-muted-foreground"
                            )}
                          >
                            {isMe ? "V" : "C"}
                          </div>
                          <div
                            className={cn(
                              "rounded-lg p-3 text-sm shadow-sm relative group",
                              isMe
                                ? "bg-primary text-primary-foreground rounded-br-none"
                                : "bg-muted text-muted-foreground rounded-bl-none border border-border"
                            )}
                          >
                            <p className="break-words font-medium leading-relaxed">
                              {msg.messageText}
                            </p>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="text-[9px] opacity-75 font-semibold">
                                {new Date(msg.sentAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Thread Reply Input Footer */}
              <div className="p-4 border-t border-border bg-muted/10">
                <form onSubmit={handleSend} className="flex gap-2 items-center">
                  <Input
                    placeholder="Type a message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={sendReplyMut.isPending}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={sendReplyMut.isPending || !replyText.trim()}
                    className="gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-8 space-y-3 bg-muted/5">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                <MessageSquare className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold">Select a conversation</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Choose a customer chat from the list to view the message history and reply.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorChats;
