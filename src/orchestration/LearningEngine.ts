import { ExecutionTelemetry, ILearningEngine, RoutingRecommendation } from './types';
import fsp from 'node:fs/promises';
import path from 'node:path';

/**
 * P1: Learning Engine
 * Stores extended telemetry for routing optimization.
 */
export class LearningEngine implements ILearningEngine {
  private readonly telemetryFilePath: string;
  private telemetryData: ExecutionTelemetry[] = [];

  constructor(storageDir: string) {
    this.telemetryFilePath = path.join(storageDir, 'learning-telemetry.json');
  }

  async init(): Promise<void> {
    try {
      const raw = await fsp.readFile(this.telemetryFilePath, 'utf8');
      this.telemetryData = JSON.parse(raw);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
      this.telemetryData = [];
    }
  }

  async recordOutcome(telemetry: ExecutionTelemetry): Promise<void> {
    this.telemetryData.push(telemetry);
    await fsp.writeFile(this.telemetryFilePath, JSON.stringify(this.telemetryData, null, 2), 'utf8');
  }

  async recommendRouting(capability: string, maxCostLimit?: number): Promise<RoutingRecommendation> {
    // Filter history for this capability
    const history = this.telemetryData.filter(t => t.capability === capability);
    
    // Default fallback if no history
    if (history.length === 0) {
      return {
        recommendedRuntime: 'local',
        recommendedModel: 'claude-3-5-sonnet-20241022',
        expectedCost: 0.01,
        historicalSuccessRate: 1.0,
        confidenceScore: 0.5
      };
    }

    // Group by model
    const statsByModel = new Map<string, { successCount: number, totalCount: number, totalCost: number }>();
    
    for (const record of history) {
      const current = statsByModel.get(record.model) || { successCount: 0, totalCount: 0, totalCost: 0 };
      current.totalCount++;
      if (record.success) current.successCount++;
      current.totalCost += record.costUsd;
      statsByModel.set(record.model, current);
    }

    let bestModel = '';
    let bestScore = -1;
    let bestStats = null;

    for (const [model, stats] of statsByModel.entries()) {
      const avgCost = stats.totalCost / stats.totalCount;
      if (maxCostLimit && avgCost > maxCostLimit) continue;

      const successRate = stats.successCount / stats.totalCount;
      // Simple P1 Score: SuccessRate weighted heavily, Cost penalty
      const score = (successRate * 100) - (avgCost * 10); 
      
      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
        bestStats = { successRate, avgCost };
      }
    }

    if (!bestModel || !bestStats) {
      // Fallback
      return {
        recommendedRuntime: 'local',
        recommendedModel: 'claude-3-5-sonnet-20241022',
        expectedCost: 0.01,
        historicalSuccessRate: 1.0,
        confidenceScore: 0.5
      };
    }

    return {
      recommendedRuntime: 'local', // Assuming local runtime adapter for P1
      recommendedModel: bestModel,
      expectedCost: bestStats.avgCost,
      historicalSuccessRate: bestStats.successRate,
      confidenceScore: bestScore > 80 ? 0.9 : 0.6
    };
  }
}
