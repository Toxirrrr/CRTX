import { LearningRecommender } from '../../core/learning/recommender';

export function runLearn(args: string[]) {
  const incidentFile = args[0];
  if (!incidentFile) {
    console.error('Usage: npx tsx crtx/cli/index.ts learn <path-to-incident.json>');
    process.exit(1);
  }

  try {
    const recommender = new LearningRecommender();
    recommender.generateRecommendation(incidentFile);
  } catch (err: any) {
    console.error('[Learn] Error:', err.message);
    process.exit(1);
  }
}
