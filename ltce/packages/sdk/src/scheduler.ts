import { Command } from "./command";

export interface Schedule {
  id: string;
  executeAt?: Date;
  interval?: number;
  cron?: string;
  repeat?: boolean;
}

export type ScheduledTaskState = "PENDING" | "SCHEDULED" | "RUNNING" | "COMPLETED" | "CANCELLED" | "FAILED";

export interface ScheduledTask<T = unknown> {
  id: string;
  command: Command<T>;
  schedule: Schedule;
  state: ScheduledTaskState;
  cancel(): void;
}

export interface Scheduler {
  schedule<T>(command: Command<T>, schedule: Schedule): ScheduledTask<T>;
  cancel(taskId: string): void;
  shutdown(): void;
}
