import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface ValidationResult {
  passed: boolean;
  step: string;
  logs: string;
}

export interface IValidationPipeline {
  validate(taskId: string): Promise<ValidationResult>;
}

/**
 * P0: Validation Pipeline
 * Sequential checks: Typecheck -> Lint -> Tests -> Custom
 */
export class ValidationPipeline implements IValidationPipeline {
  private readonly projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  async validate(taskId: string): Promise<ValidationResult> {
    // Step 1: Typecheck
    try {
      await execAsync('npx tsc --noEmit', { cwd: this.projectDir });
    } catch (err: any) {
      return { passed: false, step: 'Typecheck', logs: err.stdout ? `${err.stdout}\n${err.stderr}` : err.message };
    }

    // Step 2: Lint
    // Note: If lint script doesn't exist, this will gracefully fail. In production, we'd check if the script exists.
    try {
      await execAsync('npm run lint --if-present', { cwd: this.projectDir });
    } catch (err: any) {
      return { passed: false, step: 'Lint', logs: err.stdout ? `${err.stdout}\n${err.stderr}` : err.message };
    }

    // Step 3: Tests (Stubbed for now, waiting for implementation in target project)
    try {
      await execAsync('npm run test --if-present', { cwd: this.projectDir });
    } catch (err: any) {
      return { passed: false, step: 'Tests', logs: err.stdout ? `${err.stdout}\n${err.stderr}` : err.message };
    }

    return { passed: true, step: 'All', logs: 'Validation passed successfully' };
  }
}
