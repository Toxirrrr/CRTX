import * as fs from 'fs';
import { PrismaModel, PrismaField, PrismaEnum } from './types';

const PRISMA_SCALARS = new Set([
  'String',
  'Int',
  'Float',
  'Boolean',
  'DateTime',
  'Json',
  'Bytes',
  'Decimal',
  'BigInt',
  'Unsupported'
]);

export interface PrismaParseResult {
  models: Record<string, PrismaModel>;
  enums: Record<string, PrismaEnum>;
}

export function parsePrismaSchema(schemaContent: string): PrismaParseResult {
  const models: Record<string, PrismaModel> = {};
  const enums: Record<string, PrismaEnum> = {};

  const lines = schemaContent.split(/\r?\n/);
  let currentBlockType: 'model' | 'enum' | null = null;
  let currentBlockName = '';
  let currentFields: PrismaField[] = [];
  let currentEnumValues: string[] = [];
  let currentDocComments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Collect documentation comments
    if (trimmed.startsWith('///') || trimmed.startsWith('//')) {
      const comment = trimmed.replace(/^\/{2,3}\s?/, '');
      currentDocComments.push(comment);
      continue;
    }

    if (!trimmed) {
      continue;
    }

    // Check block start
    const modelMatch = trimmed.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
    if (modelMatch) {
      currentBlockType = 'model';
      currentBlockName = modelMatch[1];
      currentFields = [];
      currentDocComments = [];
      continue;
    }

    const enumMatch = trimmed.match(/^enum\s+([A-Za-z0-9_]+)\s*\{/);
    if (enumMatch) {
      currentBlockType = 'enum';
      currentBlockName = enumMatch[1];
      currentEnumValues = [];
      currentDocComments = [];
      continue;
    }

    // Check block end
    if (trimmed === '}') {
      if (currentBlockType === 'model' && currentBlockName) {
        models[currentBlockName] = {
          name: currentBlockName,
          fields: currentFields,
          documentation: currentDocComments.length > 0 ? currentDocComments.join(' ') : undefined
        };
      } else if (currentBlockType === 'enum' && currentBlockName) {
        enums[currentBlockName] = {
          name: currentBlockName,
          values: currentEnumValues
        };
      }
      currentBlockType = null;
      currentBlockName = '';
      currentFields = [];
      currentEnumValues = [];
      currentDocComments = [];
      continue;
    }

    // Inside block parsing
    if (currentBlockType === 'model') {
      // Ignore block-level attributes like @@index, @@unique, @@map
      if (trimmed.startsWith('@@')) {
        continue;
      }

      // Field format: name type modifiers attributes
      // e.g. "id String @id @default(cuid()) @map("id")"
      // e.g. "workSchedule Json? @map("work_schedule")"
      // e.g. "accessRoles AccessRole[]"
      const fieldParts = trimmed.split(/\s+/);
      if (fieldParts.length >= 2) {
        const fieldName = fieldParts[0];
        const rawType = fieldParts[1];

        const isList = rawType.endsWith('[]');
        const isOptional = rawType.endsWith('?');
        const cleanType = rawType.replace(/(\[\]|\?)$/, '');

        const isId = trimmed.includes('@id');
        const isUnique = trimmed.includes('@unique');
        const isRelation = !PRISMA_SCALARS.has(cleanType);

        // Extract default
        let defaultValue: string | undefined;
        const defaultMatch = trimmed.match(/@default\(([^)]+)\)/);
        if (defaultMatch) {
          defaultValue = defaultMatch[1];
        }

        // Extract map
        let mapName: string | undefined;
        const mapMatch = trimmed.match(/@map\("([^"]+)"\)/);
        if (mapMatch) {
          mapName = mapMatch[1];
        }

        // Extract relation name if present
        let relationName: string | undefined;
        let relationTarget: string | undefined;
        if (isRelation) {
          relationTarget = cleanType;
          const relationMatch = trimmed.match(/@relation\("([^"]+)"/);
          if (relationMatch) {
            relationName = relationMatch[1];
          }
        }

        currentFields.push({
          name: fieldName,
          type: cleanType,
          isRequired: !isOptional && !isList,
          isList,
          isId,
          isUnique,
          isRelation,
          relationTarget,
          relationName,
          defaultValue,
          mapName,
          documentation: currentDocComments.length > 0 ? currentDocComments.join(' ') : undefined
        });
        currentDocComments = [];
      }
    } else if (currentBlockType === 'enum') {
      // In enum, each line is an enum member
      const enumVal = trimmed.split(/\s+/)[0];
      if (enumVal && !enumVal.startsWith('//')) {
        currentEnumValues.push(enumVal);
      }
    }
  }

  return { models, enums };
}

export function parsePrismaFile(filePath: string): PrismaParseResult {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Prisma schema not found at ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return parsePrismaSchema(content);
}
