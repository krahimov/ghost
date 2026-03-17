"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Save, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function HauntingSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const haunting = useQuery(api.hauntings.getBySlug, { slug });
  const updateHaunting = useMutation(api.hauntings.update);
  const removeHaunting = useMutation(api.hauntings.remove);

  const [depth, setDepth] = useState<string | null>(null);
  const [interval, setInterval] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (haunting === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (haunting === null) {
    return <p className="text-muted-foreground">Haunting not found</p>;
  }

  const currentDepth = depth ?? haunting.research.depth;
  const currentInterval = interval ?? haunting.schedule.interval;
  const currentContext = context ?? haunting.context ?? "";
  const currentPurpose = purpose ?? haunting.purpose ?? "";

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateHaunting({
        id: haunting._id,
        depth: currentDepth,
        interval: currentInterval,
        context: currentContext || undefined,
        purpose: currentPurpose || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${haunting.name}" and all its data? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await removeHaunting({ id: haunting._id });
      router.push("/");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/hauntings/${slug}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Settings — {haunting.name}</h1>
      </div>

      {/* Research Config */}
      <Card>
        <CardHeader>
          <CardTitle>Research Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Depth</label>
            <div className="grid grid-cols-3 gap-3">
              {["shallow", "standard", "deep"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`rounded-lg border p-3 text-left text-sm capitalize transition-colors ${
                    currentDepth === d
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Schedule</label>
            <div className="grid grid-cols-3 gap-3">
              {["hourly", "daily", "weekly"].map((i) => (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  className={`rounded-lg border p-3 text-left text-sm capitalize transition-colors ${
                    currentInterval === i
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Context */}
      <Card>
        <CardHeader>
          <CardTitle>Project Context</CardTitle>
          <CardDescription>
            Per-project researcher identity. Overrides global context for this
            haunting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={currentContext}
            onChange={(e) => setContext(e.target.value)}
            rows={8}
            placeholder="# Researcher Context for this project..."
          />
        </CardContent>
      </Card>

      {/* Purpose */}
      <Card>
        <CardHeader>
          <CardTitle>Research Purpose</CardTitle>
          <CardDescription>
            Connects this research topic to your strategic needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={currentPurpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={8}
            placeholder="# Purpose: Why this research matters..."
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Delete Haunting
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
