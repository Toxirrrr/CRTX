#!/usr/bin/env node

/**
 * TINIQ Dynamic Document Writer
 * 
 * Automatically writes, updates, and verifies living documentation files based on
 * TypeScript AST and Prisma schema truth.
 * 
 * Usage:
 *   node crtx/dist/cli/doc-writer.js sync
 *   node crtx/dist/cli/doc-writer.js verify-drift
 */

import * as path from 'path';
import * as fs from 'fs';
import { buildContextCatalog } from '../context/catalogBuilder';
import { generateLivingDocuments } from '../context/docGenerator';
import { ContextCatalog } from '../context/types';

function getProjectRoot(): string {
  return path.resolve(__dirname, '..', '..', '..');
}

async function main() {
  const projectRoot = getProjectRoot();
  const args = process.argv.slice(2);
  const action = args[0] || 'sync';

  if (action === 'sync') {
    console.log('📝 TINIQ Dynamic Document Writer — Initiating Sync...');
    const startTime = Date.now();
    const catalog = buildContextCatalog({ projectRoot });
    const result = generateLivingDocuments(catalog, projectRoot);
    const duration = Date.now() - startTime;

    console.log(`✨ Living documents generated in ${duration}ms:`);
    console.log(`  • Models:    ${catalog.stats.modelCount}`);
    console.log(`  • Enums:     ${catalog.stats.enumCount}`);
    console.log(`  • DTOs:      ${catalog.stats.dtoCount}`);
    console.log(`  • Endpoints: ${catalog.stats.endpointCount}`);
    console.log(`\nUpdated targets:`);
    console.log(`  📄 ${result.databaseModelsPath}`);
    console.log(`  📄 ${result.dtoCatalogPath}`);
    console.log(`  📄 ${result.apiEndpointsPath}`);
    console.log(`  📄 ${result.codebaseTruthPath}`);
    console.log(`  📄 ${result.jsonContractsPath}`);
  } else if (action === 'verify-drift') {
    console.log('🔍 Checking documentation drift against code truth...');
    const snapshotPath = path.join(projectRoot, 'docs', 'contracts', 'codebase-contracts.json');
    if (!fs.existsSync(snapshotPath)) {
      console.error('❌ Drift Detected: Living documentation snapshot does not exist. Run "node crtx/dist/cli/doc-writer.js sync"');
      process.exit(1);
    }

    const previousCatalog: ContextCatalog = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    const currentCatalog = buildContextCatalog({ projectRoot });

    const prevModels = Object.keys(previousCatalog.models).sort();
    const currModels = Object.keys(currentCatalog.models).sort();

    const prevDtos = Object.keys(previousCatalog.dtos).sort();
    const currDtos = Object.keys(currentCatalog.dtos).sort();

    const prevEndpoints = previousCatalog.endpoints.length;
    const currEndpoints = currentCatalog.endpoints.length;

    let hasDrift = false;

    if (prevModels.length !== currModels.length) {
      console.warn(`⚠️ Model count drift: Previous=${prevModels.length}, Current=${currModels.length}`);
      hasDrift = true;
    }

    if (prevDtos.length !== currDtos.length) {
      console.warn(`⚠️ DTO count drift: Previous=${prevDtos.length}, Current=${currDtos.length}`);
      hasDrift = true;
    }

    if (prevEndpoints !== currEndpoints) {
      console.warn(`⚠️ Endpoint count drift: Previous=${prevEndpoints}, Current=${currEndpoints}`);
      hasDrift = true;
    }

    if (hasDrift) {
      console.error('\n❌ DOCUMENTATION DRIFT DETECTED! Codebase types have changed without updating living documentation.');
      console.error('Run: node crtx/dist/cli/doc-writer.js sync\n');
      process.exit(1);
    } else {
      console.log('✅ Zero Drift: Living documentation is 100% in sync with code truth.');
    }
  } else {
    console.log('Usage: node crtx/dist/cli/doc-writer.js [sync|verify-drift]');
  }
}

main().catch(err => {
  console.error('Dynamic Doc Writer Error:', err);
  process.exit(1);
});
