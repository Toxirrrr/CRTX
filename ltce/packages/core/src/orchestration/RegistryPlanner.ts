import { Planner } from "../../sdk/src/orchestration";
import { EventEnvelope } from "../../sdk/src/events";
import { Command } from "../../sdk/src/command";

export class RegistryPlanner implements Planner {
  private readonly planners = new Map<string, Planner>();

  register(eventType: string, planner: Planner): void {
    this.planners.set(eventType, planner);
  }

  async plan(event: EventEnvelope<any>): Promise<Command<any>[]> {
    const planner = this.planners.get(event.type);
    if (!planner) {
      return [];
    }
    return planner.plan(event);
  }
}
