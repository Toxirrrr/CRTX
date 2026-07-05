import { IHybridSearch, IFullKnowledgeGraph, GraphNode } from '../orchestration/types';
import { MemoryStore } from './memoryStore';

/**
 * P2: Hybrid Search
 * Combines semantic vector search (MemoryStore/RAG) with strict graph resolution (FullKnowledgeGraph).
 */
export class HybridSearch implements IHybridSearch {
  private memoryStore: MemoryStore;
  private graph: IFullKnowledgeGraph;

  constructor(memoryStore: MemoryStore, graph: IFullKnowledgeGraph) {
    this.memoryStore = memoryStore;
    this.graph = graph;
  }

  async search(query: string, topK = 5): Promise<{ semanticResults: any[], graphResults: GraphNode[] }> {
    // 1. Semantic Search
    const semanticResults = await this.memoryStore.recall(query, topK);

    // 2. Graph Search (Heuristic mapping from semantic result to graph node)
    const graphResults = new Map<string, GraphNode>();
    
    for (const result of semanticResults) {
      // If the memory item is associated with a file path or symbol ID
      const nodeId = result.metadata?.nodeId as string | undefined;
      
      if (nodeId) {
        // Find 1st-degree connections in the graph to enrich context
        const connections = this.graph.queryGraph(nodeId, 1, ['DEFINES', 'CALLS', 'IMPLEMENTS']);
        for (const conn of connections) {
          graphResults.set(conn.id, conn);
        }
      }
    }

    return {
      semanticResults,
      graphResults: Array.from(graphResults.values())
    };
  }
}
