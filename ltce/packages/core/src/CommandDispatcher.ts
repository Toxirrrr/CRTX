import { CapabilityLookup } from "../../sdk/src/context";
import { Command, CommandResult, SelectionPolicy, CommandExecutor } from "../../sdk/src/command";
import { PluginCatalog } from "./PluginCatalog";

export class CommandDispatcher implements CommandExecutor {
  constructor(
    private readonly capabilityLookup: CapabilityLookup,
    private readonly selectionPolicy: SelectionPolicy,
    private readonly catalog: PluginCatalog
  ) {}

  async execute<T = unknown>(command: Command<any>): Promise<CommandResult<T>> {
    try {
      if (command.cancellationToken?.isCancelled) {
        return {
          success: false,
          pluginId: "none",
          error: new Error("Command cancelled before execution")
        };
      }

      // 1. CapabilityLookup.find()
      const matches = this.capabilityLookup.find(command.capability);

      // 2. Policy
      const selectedMatch = this.selectionPolicy.select(matches);

      if (!selectedMatch) {
        return {
          success: false,
          pluginId: "none",
          error: new Error(`No available plugin found for capability: ${command.capability}`)
        };
      }

      const descriptor = this.catalog.findById(selectedMatch.pluginId);
      if (!descriptor || !descriptor.instance || !descriptor.instance.execute) {
        return {
          success: false,
          pluginId: selectedMatch.pluginId,
          error: new Error(`Plugin ${selectedMatch.pluginId} cannot execute commands or is not loaded`)
        };
      }

      // 3. Plugin.execute()
      const value = await descriptor.instance.execute<T>(command);

      return {
        success: true,
        pluginId: selectedMatch.pluginId,
        value
      };
    } catch (err) {
      return {
        success: false,
        pluginId: "unknown",
        error: err instanceof Error ? err : new Error(String(err))
      };
    }
  }
}
