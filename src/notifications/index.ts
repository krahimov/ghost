import type { Haunting } from "../memory/haunting.js";
import { ConsoleChannel } from "./channels/console.js";

export interface Finding {
  priority: "critical" | "notable" | "incremental";
  title: string;
  summary: string;
  sourceUrl?: string;
}

export interface NotificationChannel {
  send(haunting: Haunting, findings: Finding[]): Promise<void>;
}

export class Notifier {
  private channels: NotificationChannel[];

  constructor(config: { console: boolean }) {
    this.channels = [];
    if (config.console) {
      this.channels.push(new ConsoleChannel());
    }
  }

  async notify(haunting: Haunting, findings: Finding[]): Promise<void> {
    if (findings.length === 0) return;

    for (const channel of this.channels) {
      await channel.send(haunting, findings);
    }
  }
}
