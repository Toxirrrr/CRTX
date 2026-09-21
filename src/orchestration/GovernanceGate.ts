import { GovernanceRecord } from './PolicyResolver';

export interface GovernanceResult {
  passed: boolean;
  reason: string;
  blockingRecords: GovernanceRecord[];
}

export class GovernanceGate {
  private records: GovernanceRecord[];

  constructor(records: GovernanceRecord[]) {
    this.records = records;
  }

  public check(files: string[], taskType: string, engineeringCycleId?: string): GovernanceResult {
    const blockingRecords: GovernanceRecord[] = [];
    const tType = taskType.toUpperCase();

    // 1. Check GLOBAL rules first
    for (const record of this.records) {
      if (record.scope.includes('GLOBAL')) {
        if (record.status === 'FROZEN') {
          // In FROZEN state, only specific task types are allowed
          if (!['BUGFIX', 'SECURITY_FIX', 'PERFORMANCE', 'HOTFIX'].includes(tType)) {
            // Check for explicit Engineering Cycle authorization for FEATURE
            if (tType === 'FEATURE' && engineeringCycleId) {
              const hasAuth = this.records.some(r => r.id === engineeringCycleId && r.status === 'ACTIVE' && r.type === 'DECISION');
              if (!hasAuth) {
                blockingRecords.push(record);
              }
            } else {
              blockingRecords.push(record);
            }
          }
        } else if (record.status === 'UNKNOWN') {
           blockingRecords.push(record);
        } else if (record.status === 'VIOLATION' || record.status === 'DRIFT') {
           if (tType !== 'REMEDIATION') {
             blockingRecords.push(record);
           }
        }
      }
    }

    // 2. Check File Scopes
    for (const file of files) {
      const normalizedFile = file.replace(/\\/g, '/');

      for (const record of this.records) {
        if (record.scope.includes('GLOBAL')) continue;

        let matched = false;
        for (const pattern of record.scope) {
          if (this.matchGlob(normalizedFile, pattern)) {
            matched = true;
            break;
          }
        }

        if (matched) {
          const status = record.status;

          if (status === 'UNKNOWN') {
            // UNKNOWN blocks everything
            blockingRecords.push(record);
          } else if (status === 'VIOLATION' || status === 'DRIFT') {
            // VIOLATION and DRIFT block unless task is REMEDIATION
            if (tType !== 'REMEDIATION') {
              blockingRecords.push(record);
            }
          } else if (status === 'FROZEN') {
             // For file-specific FROZEN status (e.g. mobile architecture)
             if (!['BUGFIX', 'SECURITY_FIX', 'PERFORMANCE', 'HOTFIX'].includes(tType)) {
               if (tType === 'FEATURE' && engineeringCycleId) {
                 const hasAuth = this.records.some(r => r.id === engineeringCycleId && r.status === 'ACTIVE' && r.type === 'DECISION');
                 if (!hasAuth) {
                   blockingRecords.push(record);
                 }
               } else {
                 blockingRecords.push(record);
               }
             }
          }
        }
      }
    }

    // Deduplicate blocking records
    const uniqueBlocking = Array.from(new Set(blockingRecords));

    if (uniqueBlocking.length > 0) {
      return {
        passed: false,
        reason: 'GOVERNANCE_BLOCKED',
        blockingRecords: uniqueBlocking
      };
    }

    return {
      passed: true,
      reason: 'CLEAN',
      blockingRecords: []
    };
  }

  private matchGlob(file: string, pattern: string): boolean {
    if (pattern === file) return true;
    
    // Convert glob to regex
    // Escape regex chars except *
    let regexStr = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace ** with .*
    regexStr = regexStr.replace(/\*\*/g, '.*');
    // Replace * with [^/]*
    regexStr = regexStr.replace(/\*/g, '[^/]*');
    
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(file);
  }
}
