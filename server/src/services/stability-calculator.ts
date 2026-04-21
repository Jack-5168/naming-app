/**
 * Stability Calculator - MBTI Type Stability Index
 * Phase 2 Implementation
 */

import { StabilityResult, TestHistory } from '../types';

/**
 * Calculate stability index based on test history
 * @param userId - User identifier
 * @param testHistory - Historical test results
 */
export async function calculateStability(
  userId: string,
  testHistory: TestHistory[]
): Promise<StabilityResult> {
  if (testHistory.length === 0) {
    return {
      stabilityIndex: 0,
      stabilityProbability: 0.5,
      status: 'new',
      confidenceBand: { lower: 0, upper: 1 }
    };
  }
  
  // Extract types from history
  const types = testHistory.map(h => h.mbtiType);
  const latestType = types[types.length - 1];
  
  // Calculate consistency
  const typeCounts: { [key: string]: number } = {};
  types.forEach(type => {
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  
  const maxCount = Math.max(...Object.values(typeCounts));
  const consistency = maxCount / types.length;
  
  // Calculate dimension stability
  const dimensionStability = calculateDimensionStability(testHistory);
  
  // Calculate stability index (0-100)
  const stabilityIndex = Math.round(
    (consistency * 0.6 + dimensionStability * 0.4) * 100
  );
  
  // Calculate probability of same type on retest
  const stabilityProbability = 0.5 + (consistency * 0.4);
  
  // Determine status
  let status: 'stable' | 'moderate' | 'unstable' | 'new';
  if (testHistory.length === 1) {
    status = 'new';
  } else if (stabilityIndex >= 80) {
    status = 'stable';
  } else if (stabilityIndex >= 60) {
    status = 'moderate';
  } else {
    status = 'unstable';
  }
  
  // Calculate confidence band
  const confidenceBand = {
    lower: Math.max(0, stabilityIndex - 10),
    upper: Math.min(100, stabilityIndex + 10)
  };
  
  return {
    stabilityIndex,
    stabilityProbability: Math.round(stabilityProbability * 100) / 100,
    status,
    confidenceBand,
    dimensionStability
  };
}

/**
 * Calculate stability for each MBTI dimension
 */
function calculateDimensionStability(history: TestHistory[]): number {
  if (history.length < 2) {
    return 0.5;
  }
  
  const dimensions = ['E', 'N', 'T', 'J'];
  let totalStability = 0;
  
  dimensions.forEach(dim => {
    const scores = history.map(h => h.dimensionScores?.[dim as keyof typeof h.dimensionScores] || 50);
    const variance = calculateVariance(scores);
    // Lower variance = higher stability
    const dimStability = 1 / (1 + variance / 100);
    totalStability += dimStability;
  });
  
  return totalStability / dimensions.length;
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}
