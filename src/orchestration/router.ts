import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Cycle } from './types';
import * as CycleFactory from './CycleFactory';
// NOTE: LegacyImporter/LegacyExporter MUST NOT be imported here — router is Cycle-pure.
export type { Cycle };

/**
 * CRTX Capability Injection
 * Reads provider-neutral skills from crtx/policies/skills/ (primary)
 * and falls back to memory/skills.json for legacy compat.
 * Claude-specific skills in .claude/skills/ are NOT injected here.
 */
function getCapabilitiesText(): string {
  try {
    let text = '\n\n--- CRTX AUTO-INJECTED CAPABILITIES ---\n';

    // Primary: crtx/policies/skills/ (provider-neutral .md skill files)
    const crtxSkillsDir = path.resolve(__dirname, '../../policies/skills');
    if (fs.existsSync(crtxSkillsDir)) {
      const skillFiles = fs.readdirSync(crtxSkillsDir).filter(f => f.endsWith('.md'));
      if (skillFiles.length > 0) {
        text += `AVAILABLE SKILLS (INSTRUCTIONS):\n`;
        for (const file of skillFiles) {
          const content = fs.readFileSync(path.join(crtxSkillsDir, file), 'utf8');
          text += `\n--- SKILL: ${file.replace('.md', '')} ---\n${content}\n`;
        }
      }
    } else {
      // Fallback: legacy memory/skills.json
      const skillsPath = path.resolve(__dirname, '../../memory/skills.json');
      if (fs.existsSync(skillsPath)) {
        const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
        text += `AVAILABLE SKILLS:\n- ${skills.join('\n- ')}\n`;
      }
    }

    const mcpFilePath = path.resolve(__dirname, '../../../.mcp.json');
    if (fs.existsSync(mcpFilePath)) {
      const mcpData = JSON.parse(fs.readFileSync(mcpFilePath, 'utf8'));
      const servers = Object.keys(mcpData.mcpServers || {});
      text += `\nACTIVE MCP SERVERS:\n- ${servers.join('\n- ')}\n`;
      text += `(Agents MUST utilize these MCP servers instead of manual scripts where applicable)\n`;
    }
    return text + '---------------------------------------\n';
  } catch (e) {
    return '';
  }
}

// CRTX: Engine type — capability-based routing. Never hardcode a specific provider.

export type Engine = 'claude' | 'antigravity' | 'cursor' | 'windsurf' | 'codex-cli' | 'cline' | 'aider' | 'opencode';
export type Risk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Domain = 'SALES' | 'LOGISTICS' | 'INVENTORY' | 'OPERATIONS' | 'ADMINISTRATION' | 'META';

export interface Routing {
  domain: Domain;
  agent: string;
  engine: Engine;
  model: string;
  risk: Risk;
  rationale: string;
  analysis: string;
  contextBudget?: number;
  cycles?: Cycle[];
}

// Check for API keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

/**
 * Intelligent AI-driven Router
 */
export async function route(text: string, override?: Engine): Promise<Routing> {
  // If no AI keys are present, fallback to the old keyword logic
  if (!ANTHROPIC_API_KEY && !GEMINI_API_KEY) {
    return fallbackKeywordRoute(text, override);
  }

  try {
    const useGemini = override === 'antigravity' || (!override && GEMINI_API_KEY && text.length > 500);
    
    if (useGemini && GEMINI_API_KEY) {
      return await askGeminiRouter(text);
    } else if (ANTHROPIC_API_KEY) {
      return await askClaudeRouter(text);
    }
  } catch (error) {
    console.error('AI Routing failed, falling back to static:', error);
  }
  
  return fallbackKeywordRoute(text, override);
}

const SYSTEM_PROMPT = `
You are the Master Orchestrator (Meta-Planner) for CRTX Autonomous Cycle Engineering v1.
1. Analyze the user's directive deeply and define a single comprehensive Engineering Cycle.
2. An Engineering Cycle is a fully autonomous mission that goes from Planning to Final Audit.
3. Define the Cycle's goal, scope, and initial internal plan.
4. Model Selection Rules:
   - Opus 4.8 (ultracode, high reasoning effort): architecture, planning, security, final audit, release validation (ONLY FOR CLAUDE AGENT)
   - Sonnet (Claude 3.5): coding, refactoring, complex logic (Primary)
   - Gemini 3.1 Pro: repository-wide analysis, search, multi-file context (Available for Antigravity)
   - Haiku: grep, summaries, classification
5. Agent Assignment Rules: CLAUDE is the MAIN AGENT (Autonomous Senior Principal Engineer). ANTIGRAVITY is the SECONDARY AGENT.
6. CONTEXT BUDGET MANAGER: Assign tokens and adhere to STRICT thresholds: <20k (normal), 20-50k (capsule preferred), 50-100k (capsule only), >100k (mandatory compression).
7. CYCLE PHASES (Must be executed autonomously by the assigned agent):
   - Phase 1: Repository Audit
   - Phase 2: Execution Plan
   - Phase 3: Implementation
   - Phase 4: Verification (build, lint, tests)
   - Phase 5: Optimization
   - Phase 6: Final Audit

Respond ONLY in valid JSON format:
{
  "domain": "OPERATIONS",
  "agent": "claude",
  "engine": "claude",
  "model": "sonnet",
  "risk": "HIGH",
  "contextBudget": 120000,
  "rationale": "Why this routing...",
  "analysis": "Optimal variant is to...",
  "cycles": [
    { 
      "id": "generated-cycle-id",
      "missionId": "generated-mission-id",
      "objective": "Full context and instructions for the cycle...",
      "scope": { "include": [], "exclude": [] },
      "budget": { "maxHours": 1, "maxFiles": 50, "maxModules": 1 },
      "constraints": [],
      "risk": "HIGH",
      "definitionOfDone": [],
      "qualityGates": [],
      "execution": { "status": "PENDING", "sourceAgent": "orchestrator", "targetAgent": "claude", "payload": { "stateCapsule": {} } },
      "evidence": [],
      "artifacts": [],
      "audit": {},
      "releaseDecision": "PENDING",
      "createdAt": "2026-07-07T00:00:00Z",
      "updatedAt": "2026-07-07T00:00:00Z"
    }
  ]
}
`;

async function askClaudeRouter(text: string): Promise<Routing> {
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1000,
      system: SYSTEM_PROMPT + getCapabilitiesText(),
      messages: [{ role: 'user', content: text }],
    },
    {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );

  const jsonStr = response.data.content[0].text;
  return parseAIResponse(jsonStr);
}

async function askGeminiRouter(text: string): Promise<Routing> {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: SYSTEM_PROMPT + getCapabilitiesText() + "\n\nUser Directive: " + text }] }],
      generationConfig: { responseMimeType: "application/json" }
    }
  );

  const jsonStr = response.data.candidates[0].content.parts[0].text;
  return parseAIResponse(jsonStr);
}

function parseAIResponse(jsonStr: string): Routing {
  try {
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}') + 1;
    const raw: unknown = JSON.parse(jsonStr.slice(start, end));

    if (typeof raw !== 'object' || raw === null) {
      throw new Error('AI response is not an object');
    }

    const r = raw as Record<string, unknown>;
    const rawCycles: unknown[] = Array.isArray(r['cycles']) ? r['cycles'] : [];

    const cycles: Cycle[] = [];
    const cycleErrors: string[] = [];
    for (const rawCycle of rawCycles) {
      const result = CycleFactory.parse(rawCycle);
      if (result.ok) {
        cycles.push(result.cycle);
      } else {
        cycleErrors.push(`Cycle parse error: ${result.errors.join('; ')}`);
      }
    }

    if (cycleErrors.length > 0) {
      console.warn('[Router] Some AI-generated cycles failed validation:', cycleErrors);
    }

    const VALID_DOMAINS: Routing['domain'][] = ['SALES', 'LOGISTICS', 'INVENTORY', 'OPERATIONS', 'ADMINISTRATION', 'META'];
    const VALID_ENGINES: Routing['engine'][] = ['claude', 'antigravity', 'cursor', 'windsurf', 'codex-cli', 'cline', 'aider', 'opencode'];
    const VALID_RISKS: Routing['risk'][] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    const domain = VALID_DOMAINS.includes(r['domain'] as Routing['domain']) ? r['domain'] as Routing['domain'] : 'META';
    const engine = VALID_ENGINES.includes(r['engine'] as Routing['engine']) ? r['engine'] as Routing['engine'] : 'claude';
    const risk   = VALID_RISKS.includes(r['risk'] as Routing['risk'])       ? r['risk'] as Routing['risk']   : 'MEDIUM';

    return {
      domain,
      agent: (typeof r['agent'] === 'string') ? r['agent'] : 'claude',
      engine,
      model: (typeof r['model'] === 'string') ? r['model'] : 'pro',
      risk,
      rationale: (typeof r['rationale'] === 'string') ? r['rationale'] : '',
      analysis: (typeof r['analysis'] === 'string') ? r['analysis'] : '',
      contextBudget: (typeof r['contextBudget'] === 'number') ? r['contextBudget'] : undefined,
      cycles,
    };

  } catch (e) {
    throw new Error(`Failed to parse AI routing response: ${(e as Error).message}`);
  }
}

function fallbackKeywordRoute(text: string, override?: Engine): Routing {
  const engine = override || 'claude';
  
  return {
    domain: 'META',
    agent: 'claude',
    engine,
    model: 'pro',
    risk: 'MEDIUM',
    rationale: 'Decentralized routing. Delegated to agent for manual triage.',
    analysis: 'API keys missing. Agent must read directive and spawn an Engineering Cycle manually.',
    cycles: [
      CycleFactory.create({
        missionId: 'fallback-mission',
        objective: `[DECENTRALIZED ROUTING]\nRead directive and manually create a JSON cycle in cycles/ folder.\n\nDirective:\n${text}\n\n${getCapabilitiesText()}`,
        sourceAgent: 'orchestrator',
        targetAgent: engine,
        risk: 'MEDIUM',
        payload: {
          stateCapsule: {
            goal: 'Triage user directive',
            scope: [],
            plan: []
          }
        }
      })
    ]
  };
}
