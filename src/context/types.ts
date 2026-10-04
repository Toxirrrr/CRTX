/**
 * TINIQ Living Context Engine & Dynamic Doc Writer — Core Type Definitions
 * 
 * Defines structured interfaces for Prisma models, TypeScript DTOs,
 * Controller endpoints, Surfaces, and Realtime events.
 */

export type SurfaceType = 'SYSTEM' | 'MOBILE' | 'PLATFORM' | 'ORGANIZATION' | 'UNKNOWN';

export interface PrismaField {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  isRelation: boolean;
  relationTarget?: string;
  relationName?: string;
  defaultValue?: string;
  mapName?: string;
  documentation?: string;
}

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
  documentation?: string;
  mapName?: string;
}

export interface PrismaEnum {
  name: string;
  values: string[];
}

export interface DtoProperty {
  name: string;
  type: string;
  isOptional: boolean;
  isArray: boolean;
  validationRules: string[];
  description?: string;
  example?: string;
}

export interface DtoDefinition {
  className: string;
  filePath: string;
  extendsClass?: string;
  properties: DtoProperty[];
  description?: string;
}

export interface ApiParameter {
  name: string;
  in: 'body' | 'query' | 'param' | 'header';
  type: string;
  isRequired: boolean;
  description?: string;
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL';
  path: string;
  fullPath: string;
  surface: SurfaceType;
  controllerName: string;
  methodName: string;
  filePath: string;
  parameters: ApiParameter[];
  bodyDto?: string;
  queryDto?: string;
  returnType?: string;
  roles: string[];
  permissions: string[];
  summary?: string;
  description?: string;
}

export interface SocketEvent {
  namespace: string;
  event: string;
  direction: 'in' | 'out' | 'bidirectional';
  payloadType?: string;
  description?: string;
  filePath: string;
}

export interface ContextCatalog {
  generatedAt: string;
  stats: {
    modelCount: number;
    enumCount: number;
    dtoCount: number;
    endpointCount: number;
    socketEventCount: number;
  };
  models: Record<string, PrismaModel>;
  enums: Record<string, PrismaEnum>;
  dtos: Record<string, DtoDefinition>;
  endpoints: ApiEndpoint[];
  socketEvents: SocketEvent[];
}
