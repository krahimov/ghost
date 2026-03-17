"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface Observation {
  date: string;
  time: string;
  title: string;
  priority: "critical" | "notable" | "incremental";
  source: string;
}

const priorityConfig = {
  critical: { icon: "🔴", label: "Critical", variant: "destructive" as const },
  notable: { icon: "🟡", label: "Notable", variant: "default" as const },
  incremental: {
    icon: "⚪",
    label: "Incremental",
    variant: "secondary" as const,
  },
};

export function ObservationCard({ obs }: { obs: Observation }) {
  const config = priorityConfig[obs.priority];

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>{config.icon}</span>
          <span className="text-sm font-medium">{obs.title}</span>
        </div>
        <Badge variant={config.variant} className="shrink-0 text-[10px]">
          {config.label}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {obs.date} {obs.time}
        </span>
        {obs.source && obs.source !== "N/A" && (
          <a
            href={obs.source}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 truncate hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            {new URL(obs.source).hostname}
          </a>
        )}
      </div>
    </div>
  );
}
