import { IFullKnowledgeGraph, GraphNode, GraphEdge, IASTParser } from '../orchestration/types';
import fsp from 'node:fs/promises';

/**
 * P2: Full Knowledge Graph
 * Tracks Files, Modules, Tasks, Symbols, APIs and Agents.
 */
export class FullKnowledgeGraph implements IFullKnowledgeGraph {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[] = [];
  private astParser: IASTParser;

  constructor(astParser: IASTParser) {
    this.astParser = astParser;
  }

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdge): void {
    // Avoid exact duplicates
    const exists = this.edges.some(
      e => e.sourceId === edge.sourceId && e.targetId === edge.targetId && e.relation === edge.relation
    );
    if (!exists) {
      this.edges.push(edge);
    }
  }

  getImpactAnalysis(endpoint: string): GraphNode[] {
    // Example: find the API node, then traverse back IMPLEMENTS, then CALLS
    return this.queryGraph(endpoint, 3, ['IMPLEMENTS', 'CALLS']);
  }

  async ingestModifications(taskId: string, filesChanged: string[]): Promise<void> {
    for (const file of filesChanged) {
      try {
        const content = await fsp.readFile(file, 'utf8');
        const { nodes, edges } = this.astParser.parseFile(file, content);
        
        nodes.forEach(n => this.addNode(n));
        edges.forEach(e => this.addEdge(e));

        // Connect task to the file
        this.addNode({ id: taskId, type: 'task' });
        this.addEdge({ sourceId: taskId, targetId: file, relation: 'MODIFIES' });
        
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.warn(`[KnowledgeGraph] Failed to ingest ${file}: ${err.message}`);
        }
      }
    }
  }

  queryGraph(startNodeId: string, maxDepth: number, allowedRelations: string[]): GraphNode[] {
    const results = new Map<string, GraphNode>();
    const queue: { id: string, depth: number }[] = [{ id: startNodeId, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);

      const node = this.nodes.get(current.id);
      if (node) results.set(node.id, node);

      if (current.depth >= maxDepth) continue;

      // Find outbound
      const outbound = this.edges.filter(e => e.sourceId === current.id && allowedRelations.includes(e.relation));
      for (const edge of outbound) {
        queue.push({ id: edge.targetId, depth: current.depth + 1 });
      }

      // Find inbound (impact analysis is often reverse)
      const inbound = this.edges.filter(e => e.targetId === current.id && allowedRelations.includes(e.relation));
      for (const edge of inbound) {
        queue.push({ id: edge.sourceId, depth: current.depth + 1 });
      }
    }

    return Array.from(results.values());
  }
}
