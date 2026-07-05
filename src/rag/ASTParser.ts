import * as ts from 'typescript';
import { IASTParser, GraphNode, GraphEdge } from '../orchestration/types';

/**
 * P2: AST Parser
 * Parses TypeScript files using the Compiler API to extract symbols (classes, functions, interfaces),
 * and infer DEFINES and CALLS/IMPLEMENTS edges.
 */
export class ASTParser implements IASTParser {
  
  parseFile(filePath: string, fileContent: string): { nodes: GraphNode[], edges: GraphEdge[] } {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Create a source file
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );

    // Track current file node
    nodes.push({ id: filePath, type: 'file' });

    // Traversal function
    const visit = (node: ts.Node) => {
      // 1. Detect Definitions (Classes, Functions, Interfaces)
      if (ts.isClassDeclaration(node) && node.name) {
        const symbolId = `${filePath}#${node.name.text}`;
        nodes.push({ id: symbolId, type: 'symbol', metadata: { kind: 'class', name: node.name.text } });
        edges.push({ sourceId: filePath, targetId: symbolId, relation: 'DEFINES' });

        // Check implements
        if (node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
              for (const type of clause.types) {
                if (ts.isIdentifier(type.expression)) {
                  edges.push({
                    sourceId: symbolId,
                    targetId: `${filePath}#${type.expression.text}`, // Simplification for same-file
                    relation: 'IMPLEMENTS'
                  });
                }
              }
            }
          }
        }
      }

      if (ts.isFunctionDeclaration(node) && node.name) {
        const symbolId = `${filePath}#${node.name.text}`;
        nodes.push({ id: symbolId, type: 'symbol', metadata: { kind: 'function', name: node.name.text } });
        edges.push({ sourceId: filePath, targetId: symbolId, relation: 'DEFINES' });
      }

      if (ts.isInterfaceDeclaration(node)) {
        const symbolId = `${filePath}#${node.name.text}`;
        nodes.push({ id: symbolId, type: 'symbol', metadata: { kind: 'interface', name: node.name.text } });
        edges.push({ sourceId: filePath, targetId: symbolId, relation: 'DEFINES' });
      }

      // 2. Detect Call Expressions
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isIdentifier(expr)) {
          // Extremely simplified: assuming function name matches symbol exactly 
          // (Full implementation requires TypeChecker to resolve symbol origin)
          const targetSymbolId = `${filePath}#${expr.text}`;
          // Find closest parent symbol to act as caller
          const caller = this.findEnclosingSymbol(node, filePath);
          if (caller) {
            edges.push({ sourceId: caller, targetId: targetSymbolId, relation: 'CALLS' });
          }
        } else if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
          const caller = this.findEnclosingSymbol(node, filePath);
          if (caller) {
            // Assume method call
            edges.push({ sourceId: caller, targetId: `unknown#${expr.name.text}`, relation: 'CALLS' });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return { nodes, edges };
  }

  private findEnclosingSymbol(node: ts.Node, filePath: string): string | null {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isFunctionDeclaration(current) && current.name) return `${filePath}#${current.name.text}`;
      if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) return `${filePath}#${current.name.text}`;
      if (ts.isClassDeclaration(current) && current.name) return `${filePath}#${current.name.text}`;
      current = current.parent;
    }
    return null; // Root level call
  }
}
