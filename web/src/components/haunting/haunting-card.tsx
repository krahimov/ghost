"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Play,
  Pause,
  CheckCircle,
  Loader2,
  BookOpen,
  FileText,
} from "lucide-react";
import type { Doc } from "../../../convex/_generated/dataModel";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: any }
> = {
  active: { label: "Active", variant: "default", icon: Play },
  paused: { label: "Paused", variant: "secondary", icon: Pause },
  completed: { label: "Completed", variant: "outline", icon: CheckCircle },
  running: { label: "Running", variant: "destructive", icon: Loader2 },
};

export function HauntingCard({
  haunting,
}: {
  haunting: Doc<"hauntings">;
}) {
  const config = statusConfig[haunting.status] ?? statusConfig.active;
  const StatusIcon = config.icon;

  const observationCount = (
    haunting.journal.match(/^### \d{4}-\d{2}-\d{2}/gm) || []
  ).length;

  return (
    <Link href={`/hauntings/${haunting.slug}`}>
      <Card className="transition-colors hover:border-primary/50 hover:bg-accent/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base leading-tight">
              {haunting.name}
            </CardTitle>
            <Badge variant={config.variant} className="ml-2 shrink-0">
              <StatusIcon
                className={`mr-1 h-3 w-3 ${haunting.status === "running" ? "animate-spin" : ""}`}
              />
              {config.label}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2 text-xs">
            {haunting.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              <span>{observationCount} observations</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>{haunting.totalCycles} cycles</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{haunting.schedule.interval}</span>
            </div>
          </div>
          {haunting.lastCycleAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last run:{" "}
              {new Date(haunting.lastCycleAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
