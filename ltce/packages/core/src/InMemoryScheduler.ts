import { CommandExecutor } from "../../sdk/src/command";
import { Schedule, ScheduledTask, ScheduledTaskState, Scheduler } from "../../sdk/src/scheduler";
import { Clock } from "../../sdk/src/context";
import { randomUUID } from "crypto";

class InMemoryScheduledTask<T> implements ScheduledTask<T> {
  public state: ScheduledTaskState = "PENDING";
  
  constructor(
    public id: string,
    public command: any,
    public schedule: Schedule,
    private cancelCallback: () => void
  ) {}

  cancel(): void {
    if (this.state !== "COMPLETED" && this.state !== "FAILED" && this.state !== "CANCELLED") {
      this.cancelCallback();
      this.state = "CANCELLED";
    }
  }
}

export class InMemoryScheduler implements Scheduler {
  private tasks = new Map<string, InMemoryScheduledTask<any>>();
  private timeouts = new Map<string, NodeJS.Timeout>();
  private isShutdown = false;

  constructor(
    private readonly executor: CommandExecutor,
    private readonly clock: Clock
  ) {}

  schedule<T>(command: any, schedule: Schedule): ScheduledTask<T> {
    if (this.isShutdown) {
      throw new Error("Scheduler is shutdown");
    }

    const taskId = randomUUID();
    
    const task = new InMemoryScheduledTask<T>(
      taskId,
      command,
      schedule,
      () => this.cancel(taskId)
    );

    this.tasks.set(taskId, task);

    // Calculate delay relative to provided Clock
    let delayMs = 0;
    if (schedule.executeAt) {
      delayMs = schedule.executeAt.getTime() - this.clock.now().getTime();
      if (delayMs < 0) delayMs = 0;
    }

    task.state = "SCHEDULED";

    const timeoutId = setTimeout(async () => {
      task.state = "RUNNING";
      this.timeouts.delete(taskId);
      try {
        await this.executor.execute(command);
        task.state = "COMPLETED";
      } catch (err) {
        task.state = "FAILED";
      }
    }, delayMs);

    this.timeouts.set(taskId, timeoutId);

    return task;
  }

  cancel(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const timeoutId = this.timeouts.get(taskId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(taskId);
    }
    
    if (task.state === "SCHEDULED" || task.state === "PENDING") {
      task.state = "CANCELLED";
    }
  }

  shutdown(): void {
    this.isShutdown = true;
    for (const [taskId, timeoutId] of this.timeouts.entries()) {
      clearTimeout(timeoutId);
      const task = this.tasks.get(taskId);
      if (task && (task.state === "SCHEDULED" || task.state === "PENDING")) {
        task.state = "CANCELLED";
      }
    }
    this.timeouts.clear();
  }
}
