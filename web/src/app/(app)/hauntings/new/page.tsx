"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";

type Step = "topic" | "config" | "queries" | "review";

const depths = [
  {
    value: "shallow",
    label: "Shallow",
    desc: "5 sources per cycle — quick scans",
  },
  {
    value: "standard",
    label: "Standard",
    desc: "10 sources per cycle — balanced",
  },
  { value: "deep", label: "Deep", desc: "15 sources per cycle — thorough" },
];

const intervals = [
  { value: "hourly", label: "Hourly", desc: "Every hour" },
  { value: "daily", label: "Daily", desc: "Once per day" },
  { value: "weekly", label: "Weekly", desc: "Once per week" },
];

export default function NewHauntingPage() {
  const router = useRouter();
  const createHaunting = useMutation(api.hauntings.create);
  const user = useQuery(api.users.currentUser);

  const [step, setStep] = useState<Step>("topic");
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [depth, setDepth] = useState("standard");
  const [interval, setInterval] = useState("daily");
  const [queries, setQueries] = useState<string[]>([]);
  const [queryInput, setQueryInput] = useState("");

  const addQuery = () => {
    const q = queryInput.trim();
    if (q && queries.length < 10) {
      setQueries([...queries, q]);
      setQueryInput("");
    }
  };

  const removeQuery = (index: number) => {
    setQueries(queries.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      await createHaunting({
        name,
        description,
        depth,
        interval,
        searchQueries: queries,
        context: user?.globalContext ?? undefined,
      });

      router.push(`/hauntings/${slug}`);
    } catch (err: any) {
      alert(err.message || "Failed to create haunting");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">New Haunting</h1>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2">
        {(["topic", "config", "queries", "review"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              (["topic", "config", "queries", "review"] as Step[]).indexOf(
                step,
              ) >= i
                ? "bg-primary"
                : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Topic */}
      {step === "topic" && (
        <Card>
          <CardHeader>
            <CardTitle>What do you want to research?</CardTitle>
            <CardDescription>
              Give your research mission a name and describe what you want to
              learn
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Topic Name
              </label>
              <Input
                placeholder="e.g., AI Agent Frameworks"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Description
              </label>
              <Textarea
                placeholder="Describe what you want to learn about this topic..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setStep("config")}
                disabled={!name.trim() || !description.trim()}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Config */}
      {step === "config" && (
        <Card>
          <CardHeader>
            <CardTitle>Research Configuration</CardTitle>
            <CardDescription>
              Choose how deep and how often Ghost should research
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Research Depth
              </label>
              <div className="grid grid-cols-3 gap-3">
                {depths.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDepth(d.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      depth === d.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-sm font-medium">{d.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Schedule</label>
              <div className="grid grid-cols-3 gap-3">
                {intervals.map((i) => (
                  <button
                    key={i.value}
                    onClick={() => setInterval(i.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      interval === i.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-sm font-medium">{i.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("topic")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep("queries")}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Seed Queries */}
      {step === "queries" && (
        <Card>
          <CardHeader>
            <CardTitle>Seed Search Queries</CardTitle>
            <CardDescription>
              Add initial search queries to guide the first research cycle.
              Ghost will also generate its own queries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g., AI agent frameworks 2026"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addQuery()}
              />
              <Button onClick={addQuery} disabled={!queryInput.trim()}>
                Add
              </Button>
            </div>

            {queries.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {queries.map((q, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeQuery(i)}
                  >
                    {q} &times;
                  </Badge>
                ))}
              </div>
            )}

            {queries.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No queries added yet. You can skip this step — Ghost will
                generate queries automatically.
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("config")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep("review")}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Create</CardTitle>
            <CardDescription>
              Confirm your haunting configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div>
                <span className="text-xs text-muted-foreground">Topic</span>
                <p className="font-medium">{name}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">
                  Description
                </span>
                <p className="text-sm">{description}</p>
              </div>
              <div className="flex gap-6">
                <div>
                  <span className="text-xs text-muted-foreground">Depth</span>
                  <p className="text-sm font-medium capitalize">{depth}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Schedule
                  </span>
                  <p className="text-sm font-medium capitalize">{interval}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Seed Queries
                  </span>
                  <p className="text-sm font-medium">{queries.length}</p>
                </div>
              </div>
              {user?.globalContext && (
                <div>
                  <span className="text-xs text-muted-foreground">
                    Context
                  </span>
                  <p className="text-sm">Using global researcher context</p>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("queries")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Create Haunting
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
