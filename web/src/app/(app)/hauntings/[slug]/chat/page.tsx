"use client";

import { use, useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Loader2, Trash2, Ghost } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const haunting = useQuery(api.hauntings.getBySlug, { slug });
  const messages = useQuery(
    api.chatMessages.listForHaunting,
    haunting ? { hauntingId: haunting._id } : "skip",
  );
  const sendMessage = useMutation(api.chatMessages.send);
  const clearHistory = useMutation(api.chatMessages.clearHistory);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (haunting === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (haunting === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg text-muted-foreground">Haunting not found</p>
      </div>
    );
  }

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);

    try {
      // Save user message
      await sendMessage({
        hauntingId: haunting._id,
        role: "user",
        content: trimmed,
      });

      // Call chat API for response
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          hauntingId: haunting._id,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const data = await res.json();

      // Save assistant response
      await sendMessage({
        hauntingId: haunting._id,
        role: "assistant",
        content: data.response,
      });
    } catch (err) {
      console.error("Chat error:", err);
      await sendMessage({
        hauntingId: haunting._id,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (confirm("Clear all chat history for this haunting?")) {
      await clearHistory({ hauntingId: haunting._id });
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Link href={`/hauntings/${slug}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Chat — {haunting.name}</h1>
            <p className="text-xs text-muted-foreground">
              Ask questions about your research findings
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClear}>
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Clear
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 py-4" ref={scrollRef}>
        {(!messages || messages.length === 0) && !loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Ghost className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Ask me anything about your research on &quot;{haunting.name}&quot;
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try: &quot;What did you find?&quot; or &quot;What are the key
              threats?&quot;
            </p>
          </div>
        )}

        <div className="space-y-4">
          {messages?.map((msg) => (
            <div
              key={msg._id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "assistant" ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-muted px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border pt-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask about your research..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            className="resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-auto"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
