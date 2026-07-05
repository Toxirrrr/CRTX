import { EventEnvelope } from "./events";
import { Command } from "./command";

export interface Planner {
  plan(event: EventEnvelope<any>): Promise<Command<any>[]>;
}

export interface Orchestrator {
  handle(event: EventEnvelope<any>): Promise<void>;
}
