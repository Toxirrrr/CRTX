import { IMiniKnowledgeGraph } from '../orchestration/types';
import path from 'node:path';

/**
 * Node definition for P1 Mini Knowledge Graph
 */
interface GraphNode {
  id: string;
  type: 'file' | 'module' | 'task';
}

/**
 * P1: Mini Knowledge Graph
 * Tracks the relationship between Tasks, Files, and Modules
 * so DAGEngine can infer implicit dependencies or lock contention.
 */
export class MiniKnowledgeGraph implements IMiniKnowledgeGraph {
  // nodes: id -> GraphNode
  private nodes = new Map<string, GraphNode>();
  
  // edges: sourceId -> targetId[]
  private edges = new Map<string, Set<string>>();

  /**
   * Helper to add a node safely
   */
  private addNode(id: string, type: 'file' | 'module' | 'task') {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, type });
    }
  }

  /**
   * Helper to add a directed edge
   */
  private addEdge(sourceId: string, targetId: string) {
    if (!this.edges.has(sourceId)) {
      this.edges.set(sourceId, new Set<string>());
    }
    this.edges.get(sourceId)!.add(targetId);
  }

  /**
   * Called whenever a task modifies a file.
   * Auto-infers the module from the file path.
   */
  recordTaskFileModification(taskId: string, filePath: string): void {
    // 1. Add Task Node
    this.addNode(taskId, 'task');

    // 2. Add File Node
    this.addNode(filePath, 'file');
    this.addEdge(taskId, filePath); // TASK MODIFIES FILE

    // 3. Infer Module Node (e.g. src/modules/auth/... -> auth)
    const segments = filePath.split(path.sep).join('/').split('/');
    const modulesIndex = segments.indexOf('modules');
    
    if (modulesIndex !== -1 && modulesIndex + 1 < segments.length) {
      const moduleName = segments[modulesIndex + 1];
      this.addNode(moduleName, 'module');
      this.addEdge(moduleName, filePath); // MODULE CONTAINS FILE
      this.addEdge(taskId, moduleName);   // TASK AFFECTS MODULE
    }
  }

  /**
   * Given a task ID, returns all modules it affects based on recorded files.
   * Used by DAG or routing to prevent concurrent execution on the same module.
   */
  getModuleDependencies(taskId: string): string[] {
    const modules: string[] = [];
    const targets = this.edges.get(taskId) || new Set();
    
    for (const targetId of targets) {
      const node = this.nodes.get(targetId);
      if (node && node.type === 'module') {
        modules.push(node.id);
      }
    }
    
    return modules;
  }
}
