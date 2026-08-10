import { execSync } from 'child_process';
import * as path from 'path';

export interface DiffOptions {
  baseBranch?: string;
  files?: string[];
}

export class DiffParser {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  public getModifiedFiles(options?: DiffOptions): string[] {
    if (options?.files && options.files.length > 0) {
      return options.files;
    }

    const branch = options?.baseBranch || 'HEAD';
    let output = '';

    try {
      // Get staged and unstaged files, or differences against a branch
      if (branch === 'HEAD') {
         // staged
         const staged = execSync('git diff --name-only --cached', { cwd: this.cwd, encoding: 'utf-8' });
         // unstaged
         const unstaged = execSync('git diff --name-only', { cwd: this.cwd, encoding: 'utf-8' });
         // untracked
         const untracked = execSync('git ls-files --others --exclude-standard', { cwd: this.cwd, encoding: 'utf-8' });
         output = staged + '\n' + unstaged + '\n' + untracked;
      } else {
         output = execSync(`git diff --name-only ${branch}`, { cwd: this.cwd, encoding: 'utf-8' });
      }
    } catch (e: any) {
      console.warn('Failed to parse git diff. Ensure this is a git repository.', e.message);
      return [];
    }

    // Process output and normalize paths
    const files = new Set<string>();
    output.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        // Convert paths to posix format for uniform matching
        files.add(trimmed.split(path.sep).join(path.posix.sep));
      }
    });

    return Array.from(files);
  }
}
