/**
 * CRTX RuntimeRegistry — reads runtime descriptions from crtx/runtime/registry.json (primary)
 * and live health state from memory/runtime_health.json.
 *
 * These are intentionally kept separate:
 *   crtx/runtime/registry.json  → WHAT each runtime is (provider, models, capabilities) — provider-neutral
 *   memory/runtime_health.json  → IS each runtime online right now
 *
 * Fallback: memory/runtime_registry.json (legacy, kept for backward compat)
 */

import * as fs from 'fs';
import fsp from 'node:fs/promises';
import * as path from 'path';
import { RuntimeHealth } from './RuntimeAdapter';

// CRTX canonical path — now the project root/crtx/ where the orchestrator runs
const CRTX_DIR   = path.resolve(process.cwd());
const MEMORY_DIR = path.resolve(process.cwd(), 'memory');

export interface RuntimeDescriptor {
  provider: string;
  models: string[];
  capabilities: string[];
}

export interface RuntimeEntry extends RuntimeDescriptor {
  name: string;
  health: RuntimeHealth;
}

export class RuntimeRegistry {
  // CRTX canonical registry path
  private registryPath = path.join(CRTX_DIR, 'runtime', 'registry.json');
  // Legacy fallback
  private legacyRegistryPath = path.join(MEMORY_DIR, 'runtime_registry.json');
  private healthPath   = path.join(MEMORY_DIR, 'runtime_health.json');

  /** Returns all registered runtimes with their current health merged in. */
  async all(): Promise<RuntimeEntry[]> {
    const registry = await this.readRegistry();
    const health   = await this.readHealth();

    return Object.entries(registry).map(([name, desc]) => {
      const h = health.agents?.[name] ?? health[name];
      const online = h?.status === 'online' || h?.online === true;
      return {
        name,
        ...desc,
        health: {
          online,
          lastCheckedAt: h?.lastSeen ?? new Date().toISOString(),
        },
      };
    });
  }

  /** Returns a single runtime entry by name, or null if not registered. */
  async get(name: string): Promise<RuntimeEntry | null> {
    const all = await this.all();
    return all.find(r => r.name === name) ?? null;
  }

  /** Returns true if the named runtime is currently online. */
  async isOnline(name: string): Promise<boolean> {
    const entry = await this.get(name);
    return entry?.health.online ?? false;
  }

  private async readRegistry(): Promise<Record<string, RuntimeDescriptor>> {
    try {
      const raw = JSON.parse(await fsp.readFile(this.registryPath, 'utf8'));
      // CRTX format: { runtimes: [{ id, provider, models, capabilities, ... }] }
      if (Array.isArray(raw.runtimes)) {
        return Object.fromEntries(
          raw.runtimes.map((r: any) => [r.id, {
            provider:     r.provider,
            models:       r.models ?? [],
            capabilities: r.capabilities ?? [],
          }])
        );
      }
      // Legacy flat object format: { name: { provider, models, capabilities } }
      return raw;
    } catch {
      // Final fallback: legacy memory/runtime_registry.json
      try {
        return JSON.parse(await fsp.readFile(this.legacyRegistryPath, 'utf8'));
      } catch {
        return {};
      }
    }
  }

  private async readHealth(): Promise<any> {
    try {
      return JSON.parse(await fsp.readFile(this.healthPath, 'utf8'));
    } catch {
      return {};
    }
  }
}
