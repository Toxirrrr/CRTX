import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { ApiEndpoint, ApiParameter, SurfaceType } from './types';

const HTTP_METHOD_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'All']);

function cleanStringLiteral(raw: string): string {
  return raw.replace(/^['"`]|['"`]$/g, '').trim();
}

function resolveSurface(tags: string[]): SurfaceType {
  const upper = tags.map(t => t.toUpperCase());
  if (upper.some(t => t.includes('SYSTEM'))) return 'SYSTEM';
  if (upper.some(t => t.includes('MOBILE'))) return 'MOBILE';
  if (upper.some(t => t.includes('PLATFORM'))) return 'PLATFORM';
  if (upper.some(t => t.includes('ORGANIZATION') || t.includes('ORG'))) return 'ORGANIZATION';
  return 'ORGANIZATION'; // Default surface for business controllers
}

export function parseControllerSourceFile(filePath: string, fileContent: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) && node.name) {
      const controllerName = node.name.text;
      let baseRoute = '';
      const controllerTags: string[] = [];
      const controllerRoles: string[] = [];
      const controllerPermissions: string[] = [];

      // Extract controller-level decorators
      const classModifiers = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
      if (classModifiers) {
        for (const dec of classModifiers) {
          const expr = dec.expression;
          if (ts.isCallExpression(expr)) {
            const decName = expr.expression.getText(sourceFile);
            if (decName === 'Controller') {
              if (expr.arguments.length > 0) {
                baseRoute = cleanStringLiteral(expr.arguments[0].getText(sourceFile));
              }
            } else if (decName === 'ApiTags' || decName === 'ApiSurfaces') {
              for (const arg of expr.arguments) {
                controllerTags.push(cleanStringLiteral(arg.getText(sourceFile)));
              }
            } else if (decName === 'Roles') {
              for (const arg of expr.arguments) {
                controllerRoles.push(cleanStringLiteral(arg.getText(sourceFile)));
              }
            } else if (decName === 'RequirePermissions') {
              for (const arg of expr.arguments) {
                controllerPermissions.push(cleanStringLiteral(arg.getText(sourceFile)));
              }
            }
          }
        }
      }

      // Check method declarations
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name) {
          const methodName = member.name.getText(sourceFile);
          let httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL' | null = null;
          let subPath = '';
          let summary: string | undefined;
          let methodDescription: string | undefined;
          const methodRoles = [...controllerRoles];
          const methodPermissions = [...controllerPermissions];
          const parameters: ApiParameter[] = [];
          let bodyDto: string | undefined;
          let queryDto: string | undefined;

          const methodModifiers = ts.canHaveDecorators(member) ? ts.getDecorators(member) : undefined;
          if (methodModifiers) {
            for (const dec of methodModifiers) {
              const expr = dec.expression;
              if (ts.isCallExpression(expr)) {
                const decName = expr.expression.getText(sourceFile);
                if (HTTP_METHOD_DECORATORS.has(decName)) {
                  httpMethod = decName.toUpperCase() as any;
                  if (expr.arguments.length > 0) {
                    subPath = cleanStringLiteral(expr.arguments[0].getText(sourceFile));
                  }
                } else if (decName === 'ApiOperation') {
                  if (expr.arguments.length > 0 && ts.isObjectLiteralExpression(expr.arguments[0])) {
                    const obj = expr.arguments[0];
                    for (const prop of obj.properties) {
                      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                        const key = prop.name.text;
                        if (key === 'summary') {
                          summary = cleanStringLiteral(prop.initializer.getText(sourceFile));
                        } else if (key === 'description') {
                          methodDescription = cleanStringLiteral(prop.initializer.getText(sourceFile));
                        }
                      }
                    }
                  }
                } else if (decName === 'Roles') {
                  for (const arg of expr.arguments) {
                    methodRoles.push(cleanStringLiteral(arg.getText(sourceFile)));
                  }
                } else if (decName === 'RequirePermissions') {
                  for (const arg of expr.arguments) {
                    methodPermissions.push(cleanStringLiteral(arg.getText(sourceFile)));
                  }
                }
              }
            }
          }

          // If this method is an HTTP handler
          if (httpMethod) {
            // Inspect method parameters
            for (const param of member.parameters) {
              const paramName = param.name.getText(sourceFile);
              const paramType = param.type ? param.type.getText(sourceFile) : 'any';
              const paramModifiers = ts.canHaveDecorators(param) ? ts.getDecorators(param) : undefined;

              if (paramModifiers) {
                for (const dec of paramModifiers) {
                  const expr = dec.expression;
                  if (ts.isCallExpression(expr)) {
                    const decName = expr.expression.getText(sourceFile);
                    if (decName === 'Body') {
                      bodyDto = paramType;
                      parameters.push({
                        name: paramName,
                        in: 'body',
                        type: paramType,
                        isRequired: true
                      });
                    } else if (decName === 'Query') {
                      queryDto = paramType;
                      parameters.push({
                        name: paramName,
                        in: 'query',
                        type: paramType,
                        isRequired: false
                      });
                    } else if (decName === 'Param') {
                      const paramKey = expr.arguments.length > 0 ? cleanStringLiteral(expr.arguments[0].getText(sourceFile)) : paramName;
                      parameters.push({
                        name: paramKey,
                        in: 'param',
                        type: paramType,
                        isRequired: true
                      });
                    }
                  }
                }
              }
            }

            // Construct normalized full path
            const cleanBase = baseRoute.replace(/^\/+|\/+$/g, '');
            const cleanSub = subPath.replace(/^\/+|\/+$/g, '');
            const combined = [cleanBase, cleanSub].filter(Boolean).join('/');
            const fullPath = `/api/v1/${combined}`.replace(/\/+/g, '/');

            const surface = resolveSurface(controllerTags);

            endpoints.push({
              method: httpMethod,
              path: subPath || '/',
              fullPath,
              surface,
              controllerName,
              methodName,
              filePath,
              parameters,
              bodyDto,
              queryDto,
              roles: Array.from(new Set(methodRoles)),
              permissions: Array.from(new Set(methodPermissions)),
              summary,
              description: methodDescription
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return endpoints;
}

export function scanControllersInDirectory(dirPath: string): ApiEndpoint[] {
  const allEndpoints: ApiEndpoint[] = [];

  function scan(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
          scan(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const endpoints = parseControllerSourceFile(fullPath, content);
          allEndpoints.push(...endpoints);
        } catch {
          // Ignore individual file syntax errors gracefully
        }
      }
    }
  }

  scan(dirPath);
  return allEndpoints;
}
