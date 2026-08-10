import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const EVIDENCE_DIR = path.join(process.cwd(), '.crtx', 'evidence');

export interface EvidenceRecord {
  status: 'PASS' | 'FAIL' | 'NOT_RUN';
  timestamp: string;
  output: string;
}

export class EvidenceCache {
  constructor() {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  }

  private getCachePath(name: string): string {
    return path.join(EVIDENCE_DIR, `${name}.json`);
  }

  public read(name: string): EvidenceRecord | null {
    const cachePath = this.getCachePath(name);
    if (fs.existsSync(cachePath)) {
      try {
        return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  public write(name: string, record: EvidenceRecord): void {
    fs.writeFileSync(this.getCachePath(name), JSON.stringify(record, null, 2));
  }

  public invalidate(name: string): void {
    const cachePath = this.getCachePath(name);
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  }

  public invalidateAll(): void {
    ['lint', 'typecheck', 'tests', 'audit'].forEach(name => this.invalidate(name));
  }
}

export class EvidenceRunner {
  private cache = new EvidenceCache();

  public runTypeCheck(force: boolean = false): EvidenceRecord {
    return this.executeCachedCommand('typecheck', 'npm run type-check --if-present', force);
  }

  public runLint(force: boolean = false): EvidenceRecord {
    return this.executeCachedCommand('lint', 'npm run lint --if-present', force);
  }

  public runTests(force: boolean = false): EvidenceRecord {
    return this.executeCachedCommand('tests', 'npm run test --if-present', force);
  }

  private executeCachedCommand(name: string, command: string, force: boolean): EvidenceRecord {
    if (!force) {
      const existing = this.cache.read(name);
      if (existing) return existing;
    }

    let status: 'PASS' | 'FAIL' = 'PASS';
    let output = '';

    try {
      console.log(`[Evidence] Running ${name}...`);
      output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (e: any) {
      status = 'FAIL';
      output = e.stdout || e.message;
    }

    const record: EvidenceRecord = {
      status,
      timestamp: new Date().toISOString(),
      output
    };

    this.cache.write(name, record);
    return record;
  }
}
