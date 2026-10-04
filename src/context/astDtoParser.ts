import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { DtoDefinition, DtoProperty } from './types';

export function parseDtoSourceFile(filePath: string, fileContent: string): Record<string, DtoDefinition> {
  const dtos: Record<string, DtoDefinition> = {};
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      let extendsClass: string | undefined;

      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length > 0) {
            extendsClass = clause.types[0].getText(sourceFile);
          }
        }
      }

      const properties: DtoProperty[] = [];

      for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) && member.name) {
          const propName = member.name.getText(sourceFile);
          const rawType = member.type ? member.type.getText(sourceFile) : 'unknown';
          const isArray = rawType.endsWith('[]') || rawType.startsWith('Array<');
          let isOptional = Boolean(member.questionToken);
          const validationRules: string[] = [];
          let description: string | undefined;
          let example: string | undefined;

          // Extract decorators
          const modifiers = ts.canHaveDecorators(member) ? ts.getDecorators(member) : undefined;
          if (modifiers) {
            for (const dec of modifiers) {
              const expr = dec.expression;
              if (ts.isCallExpression(expr)) {
                const decName = expr.expression.getText(sourceFile);

                if (decName === 'IsOptional') {
                  isOptional = true;
                  validationRules.push('@IsOptional()');
                } else if (decName.startsWith('Is') || decName === 'Min' || decName === 'Max' || decName === 'ValidateNested' || decName === 'ArrayNotEmpty') {
                  const args = expr.arguments.map(a => a.getText(sourceFile)).join(', ');
                  validationRules.push(`@${decName}(${args})`);
                } else if (decName === 'ApiProperty' || decName === 'ApiPropertyOptional') {
                  if (decName === 'ApiPropertyOptional') {
                    isOptional = true;
                  }
                  if (expr.arguments.length > 0 && ts.isObjectLiteralExpression(expr.arguments[0])) {
                    const obj = expr.arguments[0];
                    for (const prop of obj.properties) {
                      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                        const key = prop.name.text;
                        if (key === 'description') {
                          description = prop.initializer.getText(sourceFile).replace(/^['"`]|['"`]$/g, '');
                        } else if (key === 'example') {
                          example = prop.initializer.getText(sourceFile);
                        }
                      }
                    }
                  }
                }
              } else if (ts.isIdentifier(expr)) {
                const decName = expr.text;
                if (decName === 'IsOptional') {
                  isOptional = true;
                  validationRules.push('@IsOptional()');
                }
              }
            }
          }

          properties.push({
            name: propName,
            type: rawType,
            isOptional,
            isArray,
            validationRules,
            description,
            example
          });
        }
      }

      dtos[className] = {
        className,
        filePath,
        extendsClass,
        properties
      };
    } else if (ts.isInterfaceDeclaration(node) && node.name) {
      // Also capture TypeScript interfaces
      const interfaceName = node.name.text;
      const properties: DtoProperty[] = [];

      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) {
          const propName = member.name.getText(sourceFile);
          const rawType = member.type ? member.type.getText(sourceFile) : 'unknown';
          const isArray = rawType.endsWith('[]');
          const isOptional = Boolean(member.questionToken);

          properties.push({
            name: propName,
            type: rawType,
            isOptional,
            isArray,
            validationRules: []
          });
        }
      }

      dtos[interfaceName] = {
        className: interfaceName,
        filePath,
        properties
      };
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return dtos;
}

export function scanDtosInDirectory(dirPath: string): Record<string, DtoDefinition> {
  const allDtos: Record<string, DtoDefinition> = {};

  function scan(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
          scan(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.dto.ts') || entry.name.endsWith('.types.ts') || entry.name.endsWith('.interface.ts'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const dtos = parseDtoSourceFile(fullPath, content);
          for (const [key, val] of Object.entries(dtos)) {
            allDtos[key] = val;
          }
        } catch {
          // Ignore syntax errors in individual files gracefully
        }
      }
    }
  }

  scan(dirPath);
  return allDtos;
}
