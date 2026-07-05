import { DAGNode, ITaskDAGEngine } from './types';

/**
 * P1: Task DAG Engine
 * Handles dependency resolution, topological execution, and cycle detection.
 */
export class TaskDAGEngine implements ITaskDAGEngine {
  
  buildGraph(tasks: any[]): Record<string, DAGNode> {
    const graph: Record<string, DAGNode> = {};

    // First pass: create nodes
    for (const task of tasks) {
      graph[task.id] = {
        taskId: task.id,
        status: task.status,
        dependsOn: task.dependsOn || [],
        dependents: [],
        depthLevel: 0
      };
    }

    // Second pass: wire dependents and validate missing dependencies
    for (const task of tasks) {
      const dependsOn = task.dependsOn || [];
      for (const parentId of dependsOn) {
        if (graph[parentId]) {
          graph[parentId].dependents.push(task.id);
        } else {
          // If a task depends on something that doesn't exist, log warning
          console.warn(`[DAG] Task ${task.id} depends on unknown task ${parentId}`);
        }
      }
    }

    // Third pass: calculate depth
    for (const nodeId of Object.keys(graph)) {
      this.calculateDepth(nodeId, graph);
    }

    return graph;
  }

  private calculateDepth(nodeId: string, graph: Record<string, DAGNode>, visited = new Set<string>()): number {
    const node = graph[nodeId];
    if (visited.has(nodeId)) {
      // Cycle detected, will be caught properly by detectCycles
      return -1; 
    }
    
    if (node.dependsOn.length === 0) {
      node.depthLevel = 0;
      return 0;
    }

    visited.add(nodeId);
    let maxParentDepth = 0;
    for (const parentId of node.dependsOn) {
      if (graph[parentId]) {
        const parentDepth = this.calculateDepth(parentId, graph, new Set(visited));
        maxParentDepth = Math.max(maxParentDepth, parentDepth);
      }
    }
    
    node.depthLevel = maxParentDepth + 1;
    return node.depthLevel;
  }

  detectCycles(graph: Record<string, DAGNode>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = graph[nodeId];
      if (node) {
        for (const childId of node.dependents) {
          if (!visited.has(childId) && dfs(childId)) {
            return true;
          } else if (recursionStack.has(childId)) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of Object.keys(graph)) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  }

  getExecutableTasks(graph: Record<string, DAGNode>): string[] {
    const executable: string[] = [];
    
    for (const [nodeId, node] of Object.entries(graph)) {
      // Task must be pending or assigned
      if (node.status === 'pending') {
        let allParentsDone = true;
        for (const parentId of node.dependsOn) {
          const parent = graph[parentId];
          if (parent && parent.status !== 'done') {
            allParentsDone = false;
            break;
          }
        }
        if (allParentsDone) executable.push(nodeId);
      }
    }
    
    return executable;
  }

  propagateBlockingState(taskId: string, failed: boolean, graph: Record<string, DAGNode>): void {
    const node = graph[taskId];
    if (!node) return;

    if (failed || node.status === 'blocked' || node.status === 'failed') {
      const queue = [...node.dependents];
      while (queue.length > 0) {
        const childId = queue.shift()!;
        const child = graph[childId];
        if (child && child.status !== 'done' && child.status !== 'cascading_blocked') {
          child.status = 'cascading_blocked';
          queue.push(...child.dependents);
        }
      }
    }
  }
}
