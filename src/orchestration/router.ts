import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

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
    const crtxSkillsDir = path.resolve(process.cwd(), 'policies/skills');
    if (fs.existsSync(crtxSkillsDir)) {
      const skillFiles = fs.readdirSync(crtxSkillsDir)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''));
      if (skillFiles.length > 0) {
        text += `AVAILABLE SKILLS:\n- ${skillFiles.join('\n- ')}\n`;
      }
    } else {
      // Fallback: legacy memory/skills.json
      const skillsPath = path.resolve(process.cwd(), 'memory/skills.json');
      if (fs.existsSync(skillsPath)) {
        const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
        text += `AVAILABLE SKILLS:\n- ${skills.join('\n- ')}\n`;
      }
    }

    const mcpFilePath = path.resolve(process.cwd(), '../.mcp.json');
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
  analysis: string; // "Analyze task to find the optimal variant"
  contextBudget?: number;
  subTasks?: { title: string; agent: string; reviewer?: string; instruction: string; contextBudget?: number; dependsOn?: string[]; stateCapsule?: any }[];
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
You are the Master Orchestrator (Meta-Planner).
1. Analyze the user's directive deeply and provide the MOST OPTIMAL approach in the "analysis" field.
2. Break it into concrete "subTasks". Populate the 'dependsOn' array for sequential dependencies.
3. For HIGH/CRITICAL risk tasks, you MUST assign a "reviewer" (e.g. "code-reviewer" or "fable") to enforce Pair Programming.
7. Model Selection Rules:
   - Opus: architecture, planning, security (ONLY FOR CLAUDE AGENT. DO NOT assign Opus to Antigravity)
   - Sonnet (Claude 3.5): coding, refactoring, complex logic (Primary for Antigravity & Claude)
   - Gemini 3.1 Pro: repository-wide analysis, search, multi-file context (Available for Antigravity)
   - Fable 5: final audit, release validation, code-review (STRICTLY ONLY analyzes/reviews Claude's work)
   - Haiku: grep, summaries, classification
8. Agent Assignment Rules: CLAUDE is the MAIN AGENT (Architect/Distributor). ANTIGRAVITY is the SECONDARY AGENT (Helper with access to Sonnet and Gemini, NO OPUS).
9. CONTEXT BUDGET MANAGER: Assign tokens and adhere to STRICT thresholds: <20k (normal), 20-50k (capsule preferred), 50-100k (capsule only), >100k (mandatory compression). Opus (120k), Sonnet (80k), Gemini (200k), Fable (60k).
10. STATE CAPSULES: Instead of passing chat logs or full files, pass a minimal structured JSON state capsule between agents.
    Schema: { "task": "", "classification": "", "files": [], "decision": "", "rootCause": "", "changes": [], "validation": {}, "openQuestions": [], "next": "" }
11. STRICT ORCHESTRATOR USAGE: Use Memory, Logs, Locks, and Delegation.
12. RELEASE GATE: Before closing a task, ensure Build, Lint, Tests, Review, and Security pass. If red, task != done.

Respond ONLY in valid JSON format:
{
  "domain": "OPERATIONS",
  "agent": "planner",
  "engine": "claude",
  "model": "sonnet",
  "risk": "HIGH",
  "contextBudget": 120000,
  "rationale": "Why this routing...",
  "analysis": "Optimal variant is to...",
  "subTasks": [
    { "title": "...", "agent": "backend-engineer", "reviewer": "code-reviewer", "instruction": "...", "contextBudget": 80000, "dependsOn": ["ID-PREVIOUS"], "stateCapsule": { "task": "ID", "status": "pending", "files": [], "decision": "", "next": "" } }
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
    const cleanJson = jsonStr.slice(start, end);
    return JSON.parse(cleanJson) as Routing;
  } catch (e) {
    throw new Error('Failed to parse AI routing response');
  }
}

function fallbackKeywordRoute(text: string, override?: Engine): Routing {
  const engine = override || 'claude';
  
  return {
    domain: 'META',
    agent: 'architect',
    engine,
    model: 'pro',
    risk: 'MEDIUM',
    rationale: 'Decentralized routing. Delegated to agent for manual triage.',
    analysis: 'API keys missing. Agent must read directive and spawn sub-tasks manually.',
    subTasks: [
      {
        title: 'Triage & Route',
        agent: 'architect',
        instruction: `[DECENTRALIZED ROUTING]\nRead directive and manually create JSON sub-tasks in tasks/ folder.

Model Routing Rules:
- Opus: architecture, planning, security (ONLY FOR CLAUDE AGENT)
- Sonnet (Claude 3.5): coding, refactoring, complex logic (Primary for Antigravity & Claude)
- Gemini 3.1 Pro: repository-wide analysis, search, multi-file context (Available for Antigravity)
- Fable 5: final audit, release validation, code-review (STRICTLY ONLY analyzes/reviews Claude's work)
- Haiku: grep, summaries, classification

Context Budget Rules (Strict Thresholds):
- < 20k: normal
- 20k-50k: capsule preferred
- 50k-100k: capsule only
- > 100k: mandatory compression

Release Gate Rules:
- Build, Lint, Tests, Review, Security MUST pass before a task is marked done.

State Capsule Rules:
Instead of passing full chat transcripts or large file diffs, use this exact minimal JSON structure for handoffs:
{
  "task": "ID",
  "classification": "CONFIRMED",
  "files": ["path/to/file.ts"],
  "decision": "soft-delete only",
  "rootCause": "Explanation of bug...",
  "changes": ["deleteMany -> updateMany", "preserve API"],
  "validation": { "build": true, "eslint": true, "tests": "missing" },
  "openQuestions": ["Need repository tests?"],
  "next": "add tests"
}

Agent Assignment Rules:
- CLAUDE: Main agent, Architect. Distributes tasks, builds architecture, writes core logic.
- ANTIGRAVITY: Secondary agent, Helper. Executes tasks that do not break structure, safe modifications.

STRICT ORCHESTRATOR USAGE:
1. MEMORY: Always use memory functionality to share context.
2. LOGS: Document every step and decision in the task's "notes" array.
3. DELEGATION: Claude (Main) MUST delegate safe, structural-preserving tasks to Antigravity (Helper).

Directive:
${text}

${getCapabilitiesText()}`
      }
    ]
  };
}
