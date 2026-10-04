/**
 * chatgpt.ts — CLI command handler for the CRTX ChatGPT integration.
 *
 * Follows the exact same pattern as other CRTX CLI commands.
 *
 * Subcommands:
 *   crtx chatgpt login
 *     Open the browser and wait for manual ChatGPT login.
 *
 *   crtx chatgpt status
 *     Show browser, auth, and profile directory state.
 *
 *   crtx chatgpt projects
 *     List all visible ChatGPT projects from the sidebar.
 *
 *   crtx chatgpt connect <crtx-project> --project <chatgpt-project>
 *     Map a CRTX project to a ChatGPT project by visible name.
 *     Example: crtx chatgpt connect tiniq --project TINIQ
 *
 *   crtx chatgpt test
 *     Run a safe connectivity test without sending a real message.
 */

import { ChatGPTBrowserManager } from '../../src/integrations/chatgpt/ChatGPTBrowserManager';
import { ChatGPTMappingStore } from '../../src/integrations/chatgpt/ChatGPTMappingStore';
import { ChatGPTService }      from '../../src/integrations/chatgpt/ChatGPTService';
import { loadChatGPTConfig }   from '../../src/integrations/chatgpt/ChatGPTConfig';
import { ChatGPTError }        from '../../src/integrations/chatgpt/ChatGPTErrors';

export async function runChatGPT(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'login':    await cmdLogin(args.slice(1));   break;
    case 'status':   await cmdStatus(args.slice(1));  break;
    case 'projects': await cmdProjects(args.slice(1)); break;
    case 'connect':  await cmdConnect(args.slice(1)); break;
    case 'test':     await cmdTest(args.slice(1));    break;
    default:
      console.log('Usage: crtx chatgpt <subcommand> [args...]');
      console.log('');
      console.log('Subcommands:');
      console.log('  login                                 Open browser for manual ChatGPT login');
      console.log('  status                                Show browser / auth / profile state');
      console.log('  projects                              List visible ChatGPT projects');
      console.log('  connect <crtx-project> --project <n> Map CRTX project → ChatGPT project');
      console.log('  test                                  Run safe connectivity test');
      console.log('');
      console.log('Examples:');
      console.log('  npx ts-node crtx/cli/index.ts chatgpt login');
      console.log('  npx ts-node crtx/cli/index.ts chatgpt connect tiniq --project TINIQ');
      console.log('  npx ts-node crtx/cli/index.ts chatgpt status');
      break;
  }
}

// ── login ────────────────────────────────────────────────────────────────────

async function cmdLogin(_args: string[]): Promise<void> {
  const config  = loadChatGPTConfig();
  config.headless = false; // Always visible for login
  
  try {
    const browser = await ChatGPTBrowserManager.getBrowser(config);
    const store   = new ChatGPTMappingStore();
    const service = new ChatGPTService(browser, store, config);

    console.log('[ChatGPT] Opening browser for login...');
    await browser.ensureAuthenticated();
    console.log('[ChatGPT] Login successful. Profile saved.');
    console.log(`[ChatGPT] Profile directory: ${config.browserProfileDir}`);
  } catch (e) {
    printError(e);
    process.exit(1);
  } finally {
    await ChatGPTBrowserManager.closeBrowser();
  }
}

// ── status ───────────────────────────────────────────────────────────────────

async function cmdStatus(_args: string[]): Promise<void> {
  const config  = loadChatGPTConfig();
  
  try {
    const browser = await ChatGPTBrowserManager.getBrowser(config);
    const store   = new ChatGPTMappingStore();
    const service = new ChatGPTService(browser, store, config);

    const status = await service.testConnectivity();

    console.log('');
    console.log('─── ChatGPT Integration Status ───────────────────────────');
    console.log(`  Browser:  ${status.browser}`);
    console.log(`  ChatGPT:  ${status.auth}`);
    console.log(`  Profile:  ${status.profile}`);
    console.log(`  Enabled:  ${config.enabled}`);
    console.log(`  Headless: ${config.headless}`);
    console.log('──────────────────────────────────────────────────────────');
    console.log('');

    await store.load();
    const projectMappings = store.getAllProjectMappings();
    if (projectMappings.length > 0) {
      console.log('Project Mappings:');
      for (const m of projectMappings) {
        console.log(`  ${m.crtxProjectId} → ${m.chatgptProjectName}`);
      }
      console.log('');
    }
  } catch (e) {
    printError(e);
  } finally {
    await ChatGPTBrowserManager.closeBrowser();
  }
}

// ── projects ─────────────────────────────────────────────────────────────────

async function cmdProjects(_args: string[]): Promise<void> {
  const config  = loadChatGPTConfig();
  
  try {
    const browser = await ChatGPTBrowserManager.getBrowser(config);
    const store   = new ChatGPTMappingStore();
    const service = new ChatGPTService(browser, store, config);

    const projects = await service.listProjects();

    console.log('');
    console.log('ChatGPT Projects');
    console.log('');
    if (projects.length === 0) {
      console.log('  (no projects found — ChatGPT UI may have changed or projects sidebar is collapsed)');
    } else {
      for (const p of projects) {
        console.log(`  - ${p}`);
      }
    }
    console.log('');
  } catch (e) {
    printError(e);
    process.exit(1);
  } finally {
    await ChatGPTBrowserManager.closeBrowser();
  }
}

// ── connect ──────────────────────────────────────────────────────────────────

async function cmdConnect(args: string[]): Promise<void> {
  // Usage: connect <crtx-project> --project <chatgpt-project>
  const crtxProjectId = args[0];
  const projectFlagIdx = args.indexOf('--project');
  const chatgptProjectName = projectFlagIdx >= 0 ? args[projectFlagIdx + 1] : undefined;

  if (!crtxProjectId || !chatgptProjectName) {
    console.error('[ChatGPT] Error: Usage: crtx chatgpt connect <crtx-project> --project <chatgpt-project-name>');
    console.error('[ChatGPT] Example: crtx chatgpt connect tiniq --project TINIQ');
    process.exit(1);
  }

  const config  = loadChatGPTConfig();
  
  try {
    const browser = await ChatGPTBrowserManager.getBrowser(config);
    const store   = new ChatGPTMappingStore();
    const service = new ChatGPTService(browser, store, config);

    await service.connectProject(crtxProjectId, chatgptProjectName);
    console.log('');
    console.log(`CRTX project "${crtxProjectId}"`);
    console.log(`→ ChatGPT project "${chatgptProjectName}"`);
    console.log('');
    console.log('Connection saved.');
  } catch (e) {
    printError(e);
    process.exit(1);
  } finally {
    await ChatGPTBrowserManager.closeBrowser();
  }
}

// ── test ─────────────────────────────────────────────────────────────────────

async function cmdTest(_args: string[]): Promise<void> {
  const config  = loadChatGPTConfig();
  
  console.log('[ChatGPT] Running connectivity test...');

  try {
    const browser = await ChatGPTBrowserManager.getBrowser(config);
    const store   = new ChatGPTMappingStore();
    const service = new ChatGPTService(browser, store, config);

    const status = await service.testConnectivity();

    const allOk = status.browser === 'OK' && status.auth === 'authenticated';
    console.log('');
    console.log(`  Browser:  ${status.browser}`);
    console.log(`  Auth:     ${status.auth}`);
    console.log(`  Profile:  ${status.profile}`);
    console.log('');
    console.log(allOk ? '[ChatGPT] Test PASSED.' : '[ChatGPT] Test FAILED — see details above.');

    if (!allOk) process.exit(1);
  } catch (e) {
    printError(e);
    process.exit(1);
  } finally {
    await ChatGPTBrowserManager.closeBrowser();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function printError(e: unknown): void {
  if (e instanceof ChatGPTError) {
    console.error(`[ChatGPT] Error [${e.code}]: ${e.message}`);
  } else {
    console.error(`[ChatGPT] Error: ${(e as Error).message}`);
  }
}
