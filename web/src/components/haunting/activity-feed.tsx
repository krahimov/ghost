"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Search,
  Globe,
  FileJson,
  BookOpen,
  Brain,
  Map,
  Bell,
  AlertCircle,
  Info,
} from "lucide-react";
import { useEffect, useRef } from "react";

const typeIcons: Record<string, typeof Search> = {
  search: Search,
  fetch: Globe,
  source_saved: FileJson,
  observation: BookOpen,
  info: Info,
  error: AlertCircle,
};

const phaseLabels: Record<string, { label: string; icon: typeof Search }> = {
  research: { label: "Research", icon: Search },
  observe: { label: "Observe", icon: BookOpen },
  reflect: { label: "Reflect", icon: Brain },
  plan: { label: "Plan", icon: Map },
  notify: { label: "Notify", icon: Bell },
};

export function ActivityFeed({
  cycleId,
}: {
  cycleId: Id<"cycles">;
}) {
  const activity = useQuery(api.cycleActivity.listForCycle, { cycleId });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activity?.length]);

  if (!activity || activity.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5" />
        Waiting for agent activity...
      </div>
    );
  }

  return (
    <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border bg-background/50 p-3">
      {activity.map((event) => {
        const Icon = typeIcons[event.type] || Info;
        const phaseInfo = phaseLabels[event.phase];

        return (
          <div
            key={event._id}
            className="flex items-start gap-2 text-xs leading-relaxed"
          >
            <Icon
              className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${
                event.type === "error"
                  ? "text-red-400"
                  : event.type === "source_saved"
                    ? "text-green-400"
                    : event.type === "search"
                      ? "text-blue-400"
                      : event.type === "fetch"
                        ? "text-purple-400"
                        : "text-muted-foreground"
              }`}
            />
            <div className="min-w-0 flex-1">
              {event.url ? (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline-offset-2 hover:underline"
                >
                  {event.title}
                </a>
              ) : (
                <span
                  className={
                    event.type === "error"
                      ? "text-red-400"
                      : "text-foreground/80"
                  }
                >
                  {event.title}
                </span>
              )}
              {event.detail && (
                <span className="ml-1 text-muted-foreground">
                  {event.detail}
                </span>
              )}
            </div>
            <span className="flex-shrink-0 text-[10px] text-muted-foreground/60">
              {phaseInfo?.label}
            </span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
