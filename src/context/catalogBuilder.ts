import * as path from 'path';
import * as fs from 'fs';
import { parsePrismaFile } from './prismaParser';
import { scanDtosInDirectory } from './astDtoParser';
import { scanControllersInDirectory } from './astControllerParser';
import { ContextCatalog, SocketEvent } from './types';

export interface BuildCatalogOptions {
  projectRoot: string;
  prismaSchemaPath?: string;
  serverSrcPath?: string;
  clientTypesPath?: string;
}

export function buildContextCatalog(options: BuildCatalogOptions): ContextCatalog {
  const root = options.projectRoot;
  const prismaPath = options.prismaSchemaPath || path.join(root, 'server', 'prisma', 'schema.prisma');
  const serverSrc = options.serverSrcPath || path.join(root, 'server', 'src');
  const clientTypes = options.clientTypesPath || path.join(root, 'client', 'types');

  // 1. Parse Prisma Models & Enums
  let models = {};
  let enums = {};
  if (fs.existsSync(prismaPath)) {
    const prismaResult = parsePrismaFile(prismaPath);
    models = prismaResult.models;
    enums = prismaResult.enums;
  }

  // 2. Parse DTOs and Interfaces from server/src
  const serverDtos = scanDtosInDirectory(serverSrc);

  // Parse client types if existing
  const clientDtos = fs.existsSync(clientTypes) ? scanDtosInDirectory(clientTypes) : {};
  const allDtos = { ...serverDtos, ...clientDtos };

  // 3. Parse Controllers & Endpoints
  const endpoints = scanControllersInDirectory(serverSrc);

  // 4. Socket Events (Static/AST baseline for Socket.io gateways)
  const socketEvents: SocketEvent[] = [
    {
      namespace: '/tracking',
      event: 'agent:location:update',
      direction: 'in',
      payloadType: 'GpsPointBatchDto',
      description: 'Ingest batched GPS coordinates from field agents (max 100 points)',
      filePath: 'server/src/realtime/tracking.gateway.ts'
    },
    {
      namespace: '/tracking',
      event: 'agent:location:broadcast',
      direction: 'out',
      payloadType: 'AgentLocationBroadcastDto',
      description: 'Realtime throttled location updates emitted to tenant room',
      filePath: 'server/src/realtime/tracking.gateway.ts'
    },
    {
      namespace: '/tasks',
      event: 'task:status:changed',
      direction: 'out',
      payloadType: 'TaskStatusChangeEvent',
      description: 'Emitted when a field task is started, visited, completed, or cancelled',
      filePath: 'server/src/realtime/tasks.gateway.ts'
    },
    {
      namespace: '/inventory',
      event: 'stock:low_alert',
      direction: 'out',
      payloadType: 'StockAlertEvent',
      description: 'Emitted when stock level drops below configured replenishment threshold',
      filePath: 'server/src/realtime/inventory.gateway.ts'
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      modelCount: Object.keys(models).length,
      enumCount: Object.keys(enums).length,
      dtoCount: Object.keys(allDtos).length,
      endpointCount: endpoints.length,
      socketEventCount: socketEvents.length
    },
    models,
    enums,
    dtos: allDtos,
    endpoints,
    socketEvents
  };
}
