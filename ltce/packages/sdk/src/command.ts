import { Capability } from "../../types/src";
import { CancellationToken } from "./context";
import { CapabilityMatch } from "./contracts";

export interface Command<T = unknown> {
  id: string;
  capability: Capability;
  payload: T;
  createdAt: Date;
  correlationId?: string;
  cancellationToken?: CancellationToken;
}

export interface CommandResult<T = unknown> {
  success: boolean;
  pluginId: string;
  value?: T;
  error?: Error;
}

export interface SelectionPolicy {
  select(matches: CapabilityMatch[]): CapabilityMatch | null;
}

export interface CommandExecutor {
  execute<T>(command: Command<any>): Promise<CommandResult<T>>;
}
