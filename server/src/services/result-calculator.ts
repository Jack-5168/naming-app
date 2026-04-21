/**
 * Result Calculator - MBTI Type Calculation from CAT Ability Estimates
 * Phase 2 Integration
 */

import { MBTIResult, TestResult } from '../types';

/**
 * Convert theta (ability estimate) to 0-100 score
 */
function thetaToScore(theta: number): number {
  // Map theta (-3 to 3) to score (0 to 100)
  // theta = 0 maps to score = 50
  return Math.max(0, Math.min(100, Math.round(50 + theta * (100 / 6))));
}

/**
 * Get label based on score
 */
function getLabel(dimension: string, score: number): string {
  const labels: { [key: string]: { positive: string; negative: string } } = {
    E: { positive: 'Extraverted', negative: 'Introverted' },
    N: { positive: 'Intuitive', negative: 'Sensing' },
    T: { positive: 'Thinking', negative: 'Feeling' },
    J: { positive: 'Judging', negative: 'Perceiving' }
  };
  
  const dimLabels = labels[dimension];
  if (!dimLabels) return 'Unknown';
  
  return score >= 50 ? dimLabels.positive : dimLabels.negative;
}

/**
 * Calculate confidence based on ability estimates
 */
function calculateConfidence(ability: number[]): number {
  // Confidence based on distance from neutral (50)
  const distances = ability.map(theta => Math.abs(thetaToScore(theta) - 50));
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  
  // Map average distance to confidence (0-100)
  return Math.min(100, Math.round(avgDistance * 2));
}

/**
 * Calculate MBTI type from ability estimates
 * Phase 2 Integration: Uses CAT ability estimates instead of raw scores
 */
export function calculateMBTIType(ability: number[]): MBTIResult {
  const [eScore, nScore, tScore, jScore] = ability.map(theta => thetaToScore(theta));
  
  const type = 
    (eScore >= 50 ? 'E' : 'I') +
    (nScore >= 50 ? 'N' : 'S') +
    (tScore >= 50 ? 'T' : 'F') +
    (jScore >= 50 ? 'J' : 'P');
  
  return {
    type,
    dimensions: {
      E: { score: eScore, label: getLabel('E', eScore) },
      N: { score: nScore, label: getLabel('N', nScore) },
      T: { score: tScore, label: getLabel('T', tScore) },
      J: { score: jScore, label: getLabel('J', jScore) }
    },
    confidence: calculateConfidence(ability)
  };
}

/**
 * Calculate complete test result
 */
export function calculateResult(ability: number[]): TestResult {
  const mbti = calculateMBTIType(ability);
  
  return {
    mbtiType: mbti.type,
    dimensionScores: {
      E: mbti.dimensions.E.score,
      N: mbti.dimensions.N.score,
      T: mbti.dimensions.T.score,
      J: mbti.dimensions.J.score
    },
    confidence: mbti.confidence,
    completedAt: Date.now()
  };
}
