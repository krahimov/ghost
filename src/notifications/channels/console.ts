import type { Haunting } from "../../memory/haunting.js";
import type { Finding, NotificationChannel } from "../index.js";

export class ConsoleChannel implements NotificationChannel {
  async send(haunting: Haunting, findings: Finding[]): Promise<void> {
    console.log();
    for (const f of findings) {
      const icon =
        f.priority === "critical"
          ? "🔴"
          : f.priority === "notable"
            ? "🟡"
            : "⚪";
      console.log(`👻 [${haunting.config.name}] ${icon} ${f.title}`);
      console.log(`   ${f.summary}`);
      if (f.sourceUrl) {
        console.log(`   Source: ${f.sourceUrl}`);
      }
      console.log();
    }
  }
}
