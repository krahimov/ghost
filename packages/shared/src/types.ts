export interface Observation {
  date: string;
  time: string;
  title: string;
  priority: "critical" | "notable" | "incremental";
  source: string;
  content: string;
}

export interface Finding {
  priority: "critical" | "notable" | "incremental";
  title: string;
  summary: string;
  sourceUrl?: string;
}

export interface CycleResult {
  observationsAdded: number;
  sourcesFetched: number;
  reflected: boolean;
  planUpdated: boolean;
  notificationsSent: number;
  error?: string;
  journal: string;
  plan: string;
  reflections: string;
}

export type HauntingStatus = "active" | "paused" | "completed" | "running";
export type ResearchDepth = "shallow" | "standard" | "deep";
export type ScheduleInterval = "hourly" | "daily" | "weekly";
export type ObservationPriority = "critical" | "notable" | "incremental";
