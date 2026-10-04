#!/usr/bin/env node

/**
 * TINIQ Living Context CLI (Context7 Local Alternative)
 * 
 * Query internal codebase types, Prisma models, DTOs, interfaces, and API endpoints
 * dynamically directly from AST and schema truth.
 * 
 * Usage:
 *   node crtx/dist/cli/context.js docs <TypeName|ModelName|Endpoint>
 *   node crtx/dist/cli/context.js search <keyword>
 *   node crtx/dist/cli/context.js list [models|dtos|endpoints|enums]
 *   node crtx/dist/cli/context.js sync
 *   node crtx/dist/cli/context.js stats
 */

import * as path from 'path';
import * as fs from 'fs';
import { buildContextCatalog } from '../context/catalogBuilder';
import { generateLivingDocuments } from '../context/docGenerator';
import { ContextCatalog } from '../context/types';

function getProjectRoot(): string {
  // Current file is in crtx/dist/cli or crtx/src/cli
  return path.resolve(__dirname, '..', '..', '..');
}

function getOrLoadCatalog(projectRoot: string): ContextCatalog {
  const cachedPath = path.join(projectRoot, 'docs', 'contracts', 'codebase-contracts.json');
  if (fs.existsSync(cachedPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachedPath, 'utf-8'));
      return data as ContextCatalog;
    } catch {
      // Fallback to building
    }
  }
  return buildContextCatalog({ projectRoot });
}

async function main() {
  const projectRoot = getProjectRoot();
  const args = process.argv.slice(2);
  const command = args[0] || 'stats';
  const query = args[1];

  switch (command.toLowerCase()) {
    case 'sync': {
      console.log('🔄 Scanning codebase AST, Prisma schema, and controllers...');
      const catalog = buildContextCatalog({ projectRoot });
      const result = generateLivingDocuments(catalog, projectRoot);
      console.log('✅ Dynamic living documents successfully updated!');
      console.log(`📊 Stats: ${catalog.stats.modelCount} Models, ${catalog.stats.enumCount} Enums, ${catalog.stats.dtoCount} DTOs, ${catalog.stats.endpointCount} Endpoints.`);
      console.log(`📁 Files updated:`);
      console.log(`  - ${path.relative(projectRoot, result.databaseModelsPath)}`);
      console.log(`  - ${path.relative(projectRoot, result.dtoCatalogPath)}`);
      console.log(`  - ${path.relative(projectRoot, result.apiEndpointsPath)}`);
      console.log(`  - ${path.relative(projectRoot, result.codebaseTruthPath)}`);
      console.log(`  - ${path.relative(projectRoot, result.jsonContractsPath)}`);
      break;
    }

    case 'docs': {
      if (!query) {
        console.error('Error: Please provide a type, model, or endpoint name. Example: context docs CreateTaskDto');
        process.exit(1);
      }
      const catalog = getOrLoadCatalog(projectRoot);

      // 1. Check DTOs / Interfaces
      if (catalog.dtos[query]) {
        const dto = catalog.dtos[query];
        console.log(`\n### DTO: ${dto.className}${dto.extendsClass ? ` (extends ${dto.extendsClass})` : ''}`);
        console.log(`File: ${dto.filePath}\n`);
        console.log(`Properties:`);
        for (const p of dto.properties) {
          const req = p.isOptional ? 'Optional' : 'Required';
          const rules = p.validationRules.length > 0 ? ` [${p.validationRules.join(', ')}]` : '';
          const desc = p.description ? ` - ${p.description}` : '';
          console.log(`  • ${p.name}: ${p.type} (${req})${rules}${desc}`);
        }
        return;
      }

      // 2. Check Prisma Models
      if (catalog.models[query]) {
        const model = catalog.models[query];
        console.log(`\n### Prisma Model: ${model.name}`);
        if (model.documentation) console.log(`Description: ${model.documentation}`);
        console.log(`\nFields:`);
        for (const f of model.fields) {
          const req = f.isRequired ? 'Required' : 'Optional';
          const id = f.isId ? ' [PRIMARY KEY]' : '';
          const uniq = f.isUnique ? ' [UNIQUE]' : '';
          const rel = f.isRelation ? ` [RELATION -> ${f.relationTarget}]` : '';
          const def = f.defaultValue ? ` [DEFAULT: ${f.defaultValue}]` : '';
          console.log(`  • ${f.name}: ${f.type}${f.isList ? '[]' : ''} (${req})${id}${uniq}${rel}${def}`);
        }
        return;
      }

      // 3. Check Enums
      if (catalog.enums[query]) {
        const enumData = catalog.enums[query];
        console.log(`\n### Enum: ${enumData.name}`);
        console.log(`Allowed values:`);
        for (const val of enumData.values) {
          console.log(`  • ${val}`);
        }
        return;
      }

      // 4. Check Endpoints
      const matchingEndpoints = catalog.endpoints.filter(e => 
        e.fullPath.toLowerCase().includes(query.toLowerCase()) || 
        e.controllerName.toLowerCase().includes(query.toLowerCase()) ||
        e.methodName.toLowerCase().includes(query.toLowerCase())
      );

      if (matchingEndpoints.length > 0) {
        console.log(`\n### Matching Endpoints (${matchingEndpoints.length}):\n`);
        for (const ep of matchingEndpoints) {
          console.log(`[${ep.method}] ${ep.fullPath} (Surface: ${ep.surface})`);
          console.log(`  Handler: ${ep.controllerName}.${ep.methodName}() in ${ep.filePath}`);
          if (ep.bodyDto) console.log(`  Body DTO: ${ep.bodyDto}`);
          if (ep.queryDto) console.log(`  Query DTO: ${ep.queryDto}`);
          if (ep.roles.length > 0) console.log(`  Roles: ${ep.roles.join(', ')}`);
          if (ep.permissions.length > 0) console.log(`  Permissions: ${ep.permissions.join(', ')}`);
          if (ep.summary) console.log(`  Summary: ${ep.summary}`);
          console.log('');
        }
        return;
      }

      console.log(`❌ No matching type, model, enum, or endpoint found for: "${query}"`);
      console.log(`Try: node crtx/dist/cli/context.js search ${query}`);
      break;
    }

    case 'search': {
      if (!query) {
        console.error('Error: Please provide a search query.');
        process.exit(1);
      }
      const catalog = getOrLoadCatalog(projectRoot);
      const q = query.toLowerCase();

      const matchedModels = Object.keys(catalog.models).filter(m => m.toLowerCase().includes(q));
      const matchedDtos = Object.keys(catalog.dtos).filter(d => d.toLowerCase().includes(q));
      const matchedEnums = Object.keys(catalog.enums).filter(e => e.toLowerCase().includes(q));
      const matchedEndpoints = catalog.endpoints.filter(e => 
        e.fullPath.toLowerCase().includes(q) || 
        (e.summary && e.summary.toLowerCase().includes(q))
      );

      console.log(`\n🔍 Search Results for "${query}":`);
      if (matchedModels.length > 0) {
        console.log(`\n📦 Models (${matchedModels.length}): ${matchedModels.join(', ')}`);
      }
      if (matchedDtos.length > 0) {
        console.log(`\n📄 DTOs (${matchedDtos.length}): ${matchedDtos.join(', ')}`);
      }
      if (matchedEnums.length > 0) {
        console.log(`\n🏷️ Enums (${matchedEnums.length}): ${matchedEnums.join(', ')}`);
      }
      if (matchedEndpoints.length > 0) {
        console.log(`\n🌐 Endpoints (${matchedEndpoints.length}):`);
        for (const ep of matchedEndpoints.slice(0, 10)) {
          console.log(`  • [${ep.method}] ${ep.fullPath} (${ep.surface})`);
        }
        if (matchedEndpoints.length > 10) console.log(`  ... and ${matchedEndpoints.length - 10} more`);
      }
      break;
    }

    case 'list': {
      const catalog = getOrLoadCatalog(projectRoot);
      const target = (query || 'models').toLowerCase();

      if (target === 'models') {
        console.log(`Models (${catalog.stats.modelCount}):\n` + Object.keys(catalog.models).sort().join('\n'));
      } else if (target === 'dtos') {
        console.log(`DTOs (${catalog.stats.dtoCount}):\n` + Object.keys(catalog.dtos).sort().join('\n'));
      } else if (target === 'enums') {
        console.log(`Enums (${catalog.stats.enumCount}):\n` + Object.keys(catalog.enums).sort().join('\n'));
      } else if (target === 'endpoints') {
        console.log(`Endpoints (${catalog.stats.endpointCount}):\n` + catalog.endpoints.map(e => `[${e.method}] ${e.fullPath} (${e.surface})`).sort().join('\n'));
      } else {
        console.log(`Unknown list category. Options: models, dtos, enums, endpoints`);
      }
      break;
    }

    case 'stats':
    default: {
      const catalog = getOrLoadCatalog(projectRoot);
      console.log(`\n📊 TINIQ Codebase Context Statistics`);
      console.log(`-----------------------------------`);
      console.log(`Prisma Models:     ${catalog.stats.modelCount}`);
      console.log(`Prisma Enums:      ${catalog.stats.enumCount}`);
      console.log(`TypeScript DTOs:   ${catalog.stats.dtoCount}`);
      console.log(`API Endpoints:     ${catalog.stats.endpointCount}`);
      console.log(`Socket.io Events:  ${catalog.stats.socketEventCount}`);
      console.log(`Last Synced:       ${catalog.generatedAt || 'Never'}`);
      console.log(`-----------------------------------`);
      console.log(`Commands:`);
      console.log(`  node crtx/dist/cli/context.js docs <name>    -> Inspect specific type or model`);
      console.log(`  node crtx/dist/cli/context.js search <term>  -> Search types, models, routes`);
      console.log(`  node crtx/dist/cli/context.js list <type>    -> List models/dtos/enums/endpoints`);
      console.log(`  node crtx/dist/cli/context.js sync           -> Update all living documents\n`);
      break;
    }
  }
}

main().catch(err => {
  console.error('Context CLI Error:', err);
  process.exit(1);
});
