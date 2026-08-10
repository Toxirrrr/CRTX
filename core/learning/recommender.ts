import * as fs from 'fs';
import * as path from 'path';

export interface IncidentReport {
  id: string;
  title: string;
  description: string;
  rootCause: string;
  impactedFiles: string[];
}

export class LearningRecommender {
  private pendingDir = path.join(process.cwd(), 'crtx', 'knowledge', 'pending');

  constructor() {
    if (!fs.existsSync(this.pendingDir)) {
      fs.mkdirSync(this.pendingDir, { recursive: true });
    }
  }

  public generateRecommendation(incidentFile: string): void {
    if (!fs.existsSync(incidentFile)) {
      throw new Error(`Incident file not found: ${incidentFile}`);
    }

    const raw = fs.readFileSync(incidentFile, 'utf-8');
    let incident: IncidentReport;
    
    try {
      incident = JSON.parse(raw);
    } catch (e) {
      throw new Error('Failed to parse incident JSON.');
    }

    // In a full LLM integration, this is where we would call the LLM
    // with the incident data to propose a rule. Here we generate a mock recommendation.
    const recommendation = this.buildRecommendation(incident);
    const draftName = `draft-rule-${incident.id}.md`;
    
    fs.writeFileSync(path.join(this.pendingDir, draftName), recommendation);
    console.log(`[Learning] Draft recommendation created at: crtx/knowledge/pending/${draftName}`);
    console.log(`[Learning] Waiting for human approval before merging to the Knowledge Base.`);
  }

  private buildRecommendation(incident: IncidentReport): string {
    return `---
id: learning-recommendation-${incident.id}
sourceIncident: ${incident.id}
status: PENDING_HUMAN_APPROVAL
---

# Recommended Architectural Update
**Based on Incident:** ${incident.title}

## Analysis of Root Cause
${incident.rootCause}

## Proposed New Rule / Anti-Pattern
> **RULE:** Any modifications to the following paths must be audited for this specific regression:
${incident.impactedFiles.map(f => `- \`${f}\``).join('\n')}

## Action Required
If you approve this rule, move this file to \`crtx/knowledge/anti-patterns.md\` or update an existing skill in \`crtx/policies/skills/\`.
`;
  }
}
