import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition } from './types';
import { EvidenceRecord } from './evidence';

export interface ReleaseData {
  version: string;
  filesChanged: string[];
  skillsRun: SkillDefinition[];
  evidence: Record<string, EvidenceRecord>;
  timestamp: string;
}

export class ReleaseManager {
  private releaseDir = path.join(process.cwd(), 'crtx', 'releases');

  constructor() {
    if (!fs.existsSync(this.releaseDir)) {
      fs.mkdirSync(this.releaseDir, { recursive: true });
    }
  }

  public generateRelease(data: ReleaseData): void {
    const versionDir = path.join(this.releaseDir, `v${data.version}`);
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }

    // Write evidence.json
    fs.writeFileSync(
      path.join(versionDir, 'evidence.json'),
      JSON.stringify(data, null, 2)
    );

    // Generate dashboard.md
    const dashboardContent = this.buildDashboard(data);
    fs.writeFileSync(path.join(versionDir, 'dashboard.md'), dashboardContent);

    // Generate risk-report.md
    const riskContent = this.buildRiskReport(data);
    fs.writeFileSync(path.join(versionDir, 'risk-report.md'), riskContent);

    // Output prompt package for AI agent execution
    const promptContent = this.buildPromptPackage(data);
    fs.writeFileSync(path.join(versionDir, 'ai-prompt-package.md'), promptContent);

    console.log(`[ReleaseManager] Successfully generated release package at crtx/releases/v${data.version}`);
  }

  private buildDashboard(data: ReleaseData): string {
    const passedEvidence = Object.values(data.evidence).every(e => e.status === 'PASS');
    return `# Release Dashboard: v${data.version}

## Overview
- **Timestamp:** ${data.timestamp}
- **Files Modified:** ${data.filesChanged.length}
- **Skills Orchestrated:** ${data.skillsRun.length}
- **Static Evidence:** ${passedEvidence ? '✅ PASS' : '❌ FAIL'}

## Orchestration Pipeline
${data.skillsRun.map(s => `- [${s.metadata.stage}] ${s.metadata.id} (${s.metadata.priority})`).join('\n')}

## Evidence Cache
${Object.entries(data.evidence).map(([key, record]) => `- **${key.toUpperCase()}:** ${record.status}`).join('\n')}
`;
  }

  private buildRiskReport(data: ReleaseData): string {
    const highPriority = data.skillsRun.filter(s => s.metadata.priority === 'P0');
    return `# Risk Report: v${data.version}

## Critical Paths Affected
This release triggered ${highPriority.length} P0 governance checks.

${highPriority.map(s => `- **${s.metadata.id}** requires rigorous AI validation.`).join('\n')}

> **Notice:** The AI Auditor must execute all skills outlined in the prompt package to clear this release.
`;
  }

  private buildPromptPackage(data: ReleaseData): string {
    return `You are an AI Auditor orchestrating release v${data.version}.
    
Based on the Master Orchestrator, you must execute the following skills:
${data.skillsRun.map(s => `- ${s.metadata.id} (Stage: ${s.metadata.stage})`).join('\n')}

Please read the metadata for these skills in \`crtx/policies/skills\` and generate the final audit report.
`;
  }
}
