import { Command, CommandResult, CommandExecutor } from "../../sdk/src/command";
import { ExecutionContext, PipelineBehavior } from "../../sdk/src/pipeline";
import { Clock } from "../../sdk/src/context";

export class PipelineExecutor implements CommandExecutor {
  constructor(
    private readonly behaviors: PipelineBehavior[],
    private readonly finalExecutor: CommandExecutor,
    private readonly clock: Clock
  ) {}

  async execute<T>(command: Command<any>): Promise<CommandResult<T>> {
    const context: ExecutionContext = {
      command,
      startedAt: this.clock.now(),
      cancellationToken: command.cancellationToken,
      metadata: new Map()
    };

    let index = 0;

    const next = async (): Promise<CommandResult<T>> => {
      if (index < this.behaviors.length) {
        const behavior = this.behaviors[index++];
        return behavior.execute(context, next) as Promise<CommandResult<T>>;
      } else {
        return this.finalExecutor.execute(context.command);
      }
    };

    return next();
  }
}
