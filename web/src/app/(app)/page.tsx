"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { HauntingCard } from "@/components/haunting/haunting-card";
import { Button } from "@/components/ui/button";
import { Plus, Ghost } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const hauntings = useQuery(api.hauntings.list);

  if (hauntings === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your Hauntings</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Hauntings</h1>
        <Link href="/hauntings/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Haunting
          </Button>
        </Link>
      </div>

      {hauntings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <Ghost className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-lg font-semibold">No hauntings yet</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first research mission to get started
          </p>
          <Link href="/hauntings/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Haunting
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hauntings.map((haunting) => (
            <HauntingCard key={haunting._id} haunting={haunting} />
          ))}
        </div>
      )}
    </div>
  );
}
