import { CommandResult } from "../../sdk/src/command";
import { ExecutionContext, PipelineBehavior, TelemetrySink } from "../../sdk/src/pipeline";
import { Clock } from "../../sdk/src/context";

export class TelemetryBehavior implements PipelineBehavior {
  constructor(
    private readonly sink: TelemetrySink,
    private readonly clock: Clock
  ) {}

  async execute(context: ExecutionContext, next: () => Promise<CommandResult>): Promise<CommandResult> {
    const startTime = this.clock.now().getTime();

    try {
      const result = await next();
      
      const duration = this.clock.now().getTime() - startTime;
      
      this.sink.record({
        name: "command.duration",
        value: duration,
        timestamp: this.clock.now(),
        tags: {
          capability: context.command.capability,
          success: result.success ? "true" : "false",
          pluginId: result.pluginId
        }
      });

      return result;
    } catch (err) {
      const duration = this.clock.now().getTime() - startTime;
      
      this.sink.record({
        name: "command.duration",
        value: duration,
        timestamp: this.clock.now(),
        tags: {
          capability: context.command.capability,
          success: "false",
          pluginId: "unknown",
          error: "true"
        }
      });

      throw err; // Propagate up
    }
  }
}
