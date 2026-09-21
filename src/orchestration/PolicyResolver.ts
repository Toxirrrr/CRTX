import * as fs from 'fs';
import * as path from 'path';

export interface GovernanceRecord {
  id: string;
  type: string;
  status: string;
  scope: string[];
  intent?: string;
  sourceFile: string;
}

export class PolicyResolver {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  public resolve(): GovernanceRecord[] {
    const records: GovernanceRecord[] = [];
    const files = this.getAllMarkdownFiles(this.baseDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const blocks = this.extractYamlBlocks(content);
      
      for (const block of blocks) {
        try {
          const record = this.parseYaml(block);
          record.sourceFile = file.substring(this.baseDir.length).replace(/\\/g, '/');
          
          if (!record.id || !record.type || !record.status || !record.scope || !Array.isArray(record.scope) || record.scope.length === 0) {
            throw new Error(`Malformed governance record in ${record.sourceFile}: missing required fields or empty scope.`);
          }

          const allowedTypes = ['DECISION', 'RULE', 'RELEASE_STATE'];
          if (!allowedTypes.includes(record.type)) {
            throw new Error(`Invalid governance record type in ${record.sourceFile}: ${record.type}. Allowed: ${allowedTypes.join(', ')}`);
          }

          const validMatrix: Record<string, string[]> = {
            'DECISION': ['ACTIVE', 'UNKNOWN', 'VIOLATION', 'DRIFT', 'FROZEN'],
            'RULE': ['ACTIVE', 'UNKNOWN', 'VIOLATION', 'DRIFT'],
            'RELEASE_STATE': ['ACTIVE', 'FROZEN']
          };

          if (!validMatrix[record.type].includes(record.status)) {
            throw new Error(`Invalid type/status combination in ${record.sourceFile}: ${record.type} + ${record.status}`);
          }
          
          if (records.some(r => r.id === record.id)) {
            throw new Error(`Duplicate governance ID detected: ${record.id}`);
          }
          
          records.push(record as GovernanceRecord);
        } catch (e: any) {
          throw new Error(`Failed to parse governance block in ${file}: ${e.message}`);
        }
      }
    }
    
    return records;
  }

  private getAllMarkdownFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = this.getAllMarkdownFiles(fullPath, arrayOfFiles);
      } else {
        if (file.endsWith('.md')) {
          arrayOfFiles.push(fullPath);
        }
      }
    });

    return arrayOfFiles;
  }

  private extractYamlBlocks(content: string): string[] {
    const blocks: string[] = [];
    // Regex to match ```yaml governance ... ```
    const regex = /```yaml\s+governance\s+([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      blocks.push(match[1]);
    }
    return blocks;
  }

  // Very basic flat YAML parser since we cannot add external dependencies.
  private parseYaml(yaml: string): Partial<GovernanceRecord> {
    const record: Partial<GovernanceRecord> = { scope: [] };
    const lines = yaml.split('\n');
    let inScope = false;

    for (let line of lines) {
      line = line.replace('\r', '');
      if (line.trim() === '') continue;

      if (line.startsWith('id:')) {
        record.id = line.substring(3).trim();
        inScope = false;
      } else if (line.startsWith('type:')) {
        record.type = line.substring(5).trim();
        inScope = false;
      } else if (line.startsWith('status:')) {
        record.status = line.substring(7).trim();
        inScope = false;
      } else if (line.startsWith('intent:')) {
        record.intent = line.substring(7).trim().replace(/^["']|["']$/g, '');
        inScope = false;
      } else if (line.startsWith('scope:')) {
        inScope = true;
      } else if (inScope && line.trim().startsWith('-')) {
        const scopeVal = line.trim().substring(1).trim().replace(/^["']|["']$/g, '');
        if (scopeVal) {
          record.scope!.push(scopeVal);
        }
      } else {
        inScope = false;
      }
    }

    return record;
  }
}
