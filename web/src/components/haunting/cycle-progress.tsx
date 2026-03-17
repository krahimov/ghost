"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CheckCircle, Loader2, Circle } from "lucide-react";
import { ActivityFeed } from "./activity-feed";
import { useEffect, useState } from "react";

const phases = [
  { key: "research", label: "Research" },
  { key: "observe", label: "Observe" },
  { key: "reflect", label: "Reflect" },
  { key: "plan", label: "Plan" },
  { key: "notify", label: "Notify" },
];

export function CycleProgress({
  hauntingId,
}: {
  hauntingId: Id<"hauntings">;
}) {
  const cycle = useQuery(api.cycles.getCurrent, { hauntingId });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!cycle || cycle.status !== "running") return;
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - cycle.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [cycle]);

  if (!cycle || cycle.status !== "running") return null;

  const currentPhaseIndex = phases.findIndex(
    (p) => p.key === cycle.currentPhase,
  );

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Cycle in progress</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {minutes}m {seconds.toString().padStart(2, "0")}s
        </span>
      </div>

      <div className="flex items-center gap-1">
        {phases.map((phase, i) => {
          let status: "done" | "active" | "pending" = "pending";
          if (i < currentPhaseIndex) status = "done";
          else if (i === currentPhaseIndex) status = "active";

          return (
            <div key={phase.key} className="flex flex-1 items-center gap-1">
              <div className="flex items-center gap-1">
                {status === "done" ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                ) : status === "active" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
                <span
                  className={`text-xs ${
                    status === "active"
                      ? "font-medium text-primary"
                      : status === "done"
                        ? "text-green-500"
                        : "text-muted-foreground/40"
                  }`}
                >
                  {phase.label}
                </span>
              </div>
              {i < phases.length - 1 && (
                <div
                  className={`mx-1 h-px flex-1 ${
                    i < currentPhaseIndex ? "bg-green-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {(cycle.sourcesFetched > 0 || cycle.observationsAdded > 0) && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          {cycle.sourcesFetched > 0 && (
            <span>{cycle.sourcesFetched} sources found</span>
          )}
          {cycle.observationsAdded > 0 && (
            <span>{cycle.observationsAdded} observations added</span>
          )}
        </div>
      )}

      {/* Live activity feed */}
      <ActivityFeed cycleId={cycle._id} />
    </div>
  );
}
