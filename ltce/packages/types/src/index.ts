// ==========================================
// Domain Entities (Knowledge Fabric)
// ==========================================

export interface KnowledgeNode {
  id: string;
  tenantId: string;
  namespace: string;
  type: string;
  name: string;
  createdAt: Date;
}

export interface KnowledgeVersion {
  versionId: string;
  nodeId: string;
  contentHash: string;
  confidence: number;
  coverage: number;
  properties: Record<string, any>;
  createdAt: Date;
}

export interface KnowledgeEdge {
  id: string;
  tenantId: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
  createdAt: Date;
}

export interface Provenance {
  versionId: string;
  resolverVersion: string;
  commitSha: string;
  filePath: string;
  generatedAt: Date;
}

// ==========================================
// Semantic Chunks
// ==========================================

export interface SemanticChunk {
  id: string;
  nodeId: string;
  knowledgeVersion: string;
  chunkType: string;
  content: string;
}

// ==========================================
// Plugin & Core Enums
// ==========================================

export type Capability = 
  | "ParseAST" 
  | "ResolveSemantic" 
  | "RetrieveDense" 
  | "RetrieveSparse" 
  | "RetrieveGraph" 
  | "Snapshot" 
  | "Metrics" 
  | "Cache" 
  | "Planning";

export type RetrievalMode = "Dense" | "Sparse" | "Hybrid" | "Graph" | "Keyword";

// ==========================================
// Context Generation DTOs
// ==========================================

export interface ContextRequest {
  intent: string;
  role: string;
  tokenBudget: number;
  tenantId: string;
  namespace: string;
}

export interface Plan {
  planId: string;
  searchQueries: string[];
  capsules: string[];
  graphTraversals: GraphQuery[];
}

export interface GraphQuery {
  startNodeId?: string;
  edgeTypes?: string[];
  maxDepth?: number;
}
