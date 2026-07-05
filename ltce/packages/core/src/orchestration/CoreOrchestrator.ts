import { Orchestrator, Planner } from "../../sdk/src/orchestration";
import { EventEnvelope } from "../../sdk/src/events";
import { Scheduler } from "../../sdk/src/scheduler";
import { randomUUID } from "crypto";

export class CoreOrchestrator implements Orchestrator {
  constructor(
    private readonly planner: Planner,
    private readonly scheduler: Scheduler
  ) {}

  async handle(event: EventEnvelope<any>): Promise<void> {
    const commands = await this.planner.plan(event);

    for (const command of commands) {
      // Create a default immediate schedule for execution
      this.scheduler.schedule(command, { 
        id: `sched-${command.id || randomUUID()}` 
      });
    }
  }
}
