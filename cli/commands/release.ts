import { MasterOrchestrator } from '../../core/orchestrator';
import { ReleaseManager } from '../../core/release-manager';

export async function runRelease(args: string[]) {
  const version = args[0];
  if (!version) {
    console.error('Usage: npx tsx crtx/cli/index.ts release <version>');
    process.exit(1);
  }
  
  // Extract remaining args as files (if provided manually)
  const files = args.slice(1);
  const options = files.length > 0 ? { files } : undefined;
  
  const orchestrator = new MasterOrchestrator();
  const data = await orchestrator.run(options);
  
  if (data) {
    data.version = version;
    const releaseManager = new ReleaseManager();
    releaseManager.generateRelease(data);
  }
}
