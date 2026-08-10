import { MasterOrchestrator } from '../../core/orchestrator';

export async function runOrchestrate(args: string[]) {
  const options = args.length > 0 ? { files: args } : undefined;
  const orchestrator = new MasterOrchestrator();
  await orchestrator.run(options);
}
