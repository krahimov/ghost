"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { Save, Pencil, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ContextPage() {
  const user = useQuery(api.users.currentUser);
  const updateContext = useMutation(api.users.updateGlobalContext);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (user === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Researcher Context</h1>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const handleEdit = () => {
    setDraft(user?.globalContext ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    await updateContext({ context: draft });
    setEditing(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Researcher Context</h1>
          <p className="text-sm text-muted-foreground">
            Tell Ghost who you are, what you&apos;re building, and what research
            matters most to you
          </p>
        </div>
        {!editing && (
          <Button variant="outline" onClick={handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            {user?.globalContext ? "Edit" : "Set up"}
          </Button>
        )}
      </div>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Context</CardTitle>
            <CardDescription>
              Write in markdown. This context is shared with all your research
              agents to personalize their findings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={16}
              placeholder={`# Researcher Context

## Identity
I am a [role] at [company]...

## What We're Building
- [Key focus areas]

## Strategic Position
[Competitors, differentiators, market position]

## Research Needs
[What kind of research is most valuable]`}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save Context
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : user?.globalContext ? (
        <Card>
          <CardContent className="pt-6">
            <MarkdownRenderer content={user.globalContext} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <p className="mb-4 text-sm text-muted-foreground">
              No researcher context set up yet. Adding context helps Ghost
              personalize research findings to your specific needs.
            </p>
            <Button onClick={handleEdit}>Set Up Context</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
