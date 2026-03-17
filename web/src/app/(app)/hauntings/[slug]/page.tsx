"use client";

import { use } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CycleProgress } from "@/components/haunting/cycle-progress";
import { ObservationCard } from "@/components/haunting/observation-card";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import {
  ArrowLeft,
  Play,
  Pause,
  MessageSquare,
  Settings,
  BookOpen,
  FileText,
  Brain,
  Map,
  Database,
  History,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

function parseObservations(journal: string) {
  const observations: Array<{
    date: string;
    time: string;
    title: string;
    priority: "critical" | "notable" | "incremental";
    source: string;
  }> = [];

  const obsRegex =
    /### (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) — (.+)\n\*\*Priority\*\*: (🔴 Critical|🟡 Notable|⚪ Incremental)\n\*\*Source\*\*: (.+)/g;

  const priorityMap: Record<string, "critical" | "notable" | "incremental"> = {
    "🔴 Critical": "critical",
    "🟡 Notable": "notable",
    "⚪ Incremental": "incremental",
  };

  let match;
  while ((match = obsRegex.exec(journal)) !== null) {
    observations.push({
      date: match[1],
      time: match[2],
      title: match[3],
      priority: priorityMap[match[4]] ?? "incremental",
      source: match[5],
    });
  }

  return observations;
}

export default function HauntingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const haunting = useQuery(api.hauntings.getBySlug, { slug });
  const pauseHaunting = useMutation(api.hauntings.pause);
  const resumeHaunting = useMutation(api.hauntings.resume);
  const startCycle = useMutation(api.cycles.start);

  if (haunting === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (haunting === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg text-muted-foreground">Haunting not found</p>
        <Link href="/" className="mt-4">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const observations = parseObservations(haunting.journal);
  const criticalCount = observations.filter(
    (o) => o.priority === "critical",
  ).length;
  const notableCount = observations.filter(
    (o) => o.priority === "notable",
  ).length;

  const handleRunCycle = async () => {
    try {
      await startCycle({ hauntingId: haunting._id });
    } catch (err: any) {
      alert(err.message || "Failed to start cycle");
    }
  };

  const handleTogglePause = async () => {
    if (haunting.status === "paused") {
      await resumeHaunting({ id: haunting._id });
    } else {
      await pauseHaunting({ id: haunting._id });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{haunting.name}</h1>
            <p className="text-sm text-muted-foreground">
              {haunting.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunCycle}
            disabled={haunting.status === "running"}
          >
            {haunting.status === "running" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {haunting.status === "running" ? "Running..." : "Run Cycle"}
          </Button>
          <Link href={`/hauntings/${slug}/chat`}>
            <Button variant="outline" size="sm">
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleTogglePause}>
            <Pause className="mr-2 h-4 w-4" />
            {haunting.status === "paused" ? "Resume" : "Pause"}
          </Button>
          <Link href={`/hauntings/${slug}/settings`}>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Cycle Progress (visible when running) */}
      {haunting.status === "running" && (
        <CycleProgress hauntingId={haunting._id} />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{haunting.totalCycles}</div>
            <p className="text-xs text-muted-foreground">Cycles completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{observations.length}</div>
            <p className="text-xs text-muted-foreground">Observations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {criticalCount}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {notableCount}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Critical / Notable
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm font-medium capitalize">
              {haunting.schedule.interval}
            </div>
            <p className="text-xs text-muted-foreground">
              {haunting.research.depth} depth
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="journal" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Journal
          </TabsTrigger>
          <TabsTrigger value="reflections" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            Reflections
          </TabsTrigger>
          <TabsTrigger value="plan" className="gap-1.5">
            <Map className="h-3.5 w-3.5" />
            Plan
          </TabsTrigger>
          <TabsTrigger value="sources" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="cycles" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Cycles
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {observations.length > 0 ? (
            <>
              <h3 className="text-sm font-medium text-muted-foreground">
                Recent Observations
              </h3>
              <div className="space-y-2">
                {observations.slice(-5).reverse().map((obs, i) => (
                  <ObservationCard key={i} obs={obs} />
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center py-8">
                <p className="text-sm text-muted-foreground">
                  No observations yet. Run a research cycle to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Journal Tab */}
        <TabsContent value="journal">
          <Card>
            <CardContent className="pt-6">
              <MarkdownRenderer content={haunting.journal} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reflections Tab */}
        <TabsContent value="reflections">
          <Card>
            <CardContent className="pt-6">
              <MarkdownRenderer content={haunting.reflections} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plan Tab */}
        <TabsContent value="plan">
          <Card>
            <CardContent className="pt-6">
              <MarkdownRenderer content={haunting.plan} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources">
          <SourcesList hauntingId={haunting._id} />
        </TabsContent>

        {/* Cycles Tab */}
        <TabsContent value="cycles">
          <CyclesList hauntingId={haunting._id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SourcesList({ hauntingId }: { hauntingId: any }) {
  const sources = useQuery(api.sources.listForHaunting, { hauntingId });

  if (sources === undefined) {
    return <Skeleton className="h-48" />;
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            No sources yet. Sources will appear after the first research cycle.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => (
        <Card key={source._id}>
          <CardContent className="py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{source.title}</p>
                {source.summary && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {source.summary}
                  </p>
                )}
                {source.keyClaims && source.keyClaims.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {source.keyClaims.slice(0, 3).map((claim, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px]"
                      >
                        {claim.slice(0, 50)}
                        {claim.length > 50 ? "..." : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {source.relevance != null && (
                <Badge variant="secondary" className="shrink-0">
                  {Math.round(source.relevance * 100)}%
                </Badge>
              )}
            </div>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-xs text-primary hover:underline truncate"
            >
              {source.url}
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CyclesList({ hauntingId }: { hauntingId: any }) {
  const cycles = useQuery(api.cycles.listForHaunting, { hauntingId });

  if (cycles === undefined) {
    return <Skeleton className="h-48" />;
  }

  if (cycles.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            No cycles yet. Run your first research cycle.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {cycles.map((cycle) => {
        const duration = cycle.completedAt
          ? Math.round((cycle.completedAt - cycle.startedAt) / 1000)
          : null;
        const durationStr = duration
          ? `${Math.floor(duration / 60)}m ${duration % 60}s`
          : "—";

        return (
          <Card key={cycle._id}>
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-4">
                <Badge
                  variant={
                    cycle.status === "completed"
                      ? "default"
                      : cycle.status === "running"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {cycle.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(cycle.startedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{cycle.sourcesFetched} sources</span>
                <span>{cycle.observationsAdded} observations</span>
                {cycle.reflected && <span>reflected</span>}
                <span>{durationStr}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
