import { Command, CommandResult, CommandExecutor } from "./command";
import { CancellationToken } from "./context";

export interface ExecutionContext {
  command: Command<any>;
  startedAt: Date;
  cancellationToken?: CancellationToken;
  metadata: Map<string, unknown>;
}

export interface PipelineBehavior {
  execute(context: ExecutionContext, next: () => Promise<CommandResult>): Promise<CommandResult>;
}

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
}

export interface TelemetrySink {
  record(metric: Metric): void;
}
