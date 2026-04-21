/**
 * CAT Engine - Computerized Adaptive Testing Engine
 * Phase 2 Implementation
 */

import { Question, Answer, AbilityEstimate } from '../types';

export class CATEngine {
  private initialAbility: number[] = [0, 0, 0, 0]; // E, N, T, J dimensions
  
  /**
   * Select the next question based on current ability estimate
   * Uses Maximum Information criterion
   */
  selectNextQuestion(answers: Answer[]): Question {
    const ability = this.estimateAbility(answers);
    const answeredIds = new Set(answers.map(a => a.questionId));
    
    // In production, this would query a question bank
    // For now, return a mock question targeting the dimension with highest uncertainty
    const mockQuestion: Question = {
      id: `q_${Date.now()}`,
      dimension: this.getMostUncertainDimension(ability),
      difficulty: this.estimateOptimalDifficulty(ability),
      content: 'Sample question content',
      options: [
        { id: 'a', text: 'Strongly Disagree' },
        { id: 'b', text: 'Disagree' },
        { id: 'c', text: 'Neutral' },
        { id: 'd', text: 'Agree' },
        { id: 'e', text: 'Strongly Agree' }
      ]
    };
    
    return mockQuestion;
  }
  
  /**
   * Estimate ability using Maximum Likelihood Estimation (MLE)
   */
  estimateAbility(answers: Answer[]): number[] {
    if (answers.length === 0) {
      return this.initialAbility;
    }
    
    // Simplified MLE for demonstration
    // In production, this would use iterative optimization
    const dimensionScores = { E: 0, N: 0, T: 0, J: 0 };
    const dimensionCounts = { E: 0, N: 0, T: 0, J: 0 };
    
    answers.forEach(answer => {
      const score = this.scoreAnswer(answer);
      dimensionScores[answer.dimension] += score;
      dimensionCounts[answer.dimension] += 1;
    });
    
    return [
      dimensionCounts.E > 0 ? dimensionScores.E / dimensionCounts.E * 25 : 0,
      dimensionCounts.N > 0 ? dimensionScores.N / dimensionCounts.N * 25 : 0,
      dimensionCounts.T > 0 ? dimensionScores.T / dimensionCounts.T * 25 : 0,
      dimensionCounts.J > 0 ? dimensionScores.J / dimensionCounts.J * 25 : 0
    ];
  }
  
  /**
   * Calculate Standard Error of Measurement (SEM)
   */
  calculateSEM(answers: Answer[]): number {
    if (answers.length === 0) {
      return 1.0; // High uncertainty initially
    }
    
    // SEM decreases with more answers
    // Simplified formula: SEM = 1 / sqrt(n)
    return 1 / Math.sqrt(answers.length);
  }
  
  /**
   * Determine if test should terminate
   * Criteria: SEM < threshold OR max questions reached
   */
  shouldTerminate(answers: Answer[]): boolean {
    const SEM_THRESHOLD = 0.3;
    const MAX_QUESTIONS = 20;
    const MIN_QUESTIONS = 10;
    
    if (answers.length < MIN_QUESTIONS) {
      return false;
    }
    
    if (answers.length >= MAX_QUESTIONS) {
      return true;
    }
    
    const sem = this.calculateSEM(answers);
    return sem < SEM_THRESHOLD;
  }
  
  /**
   * Get the dimension with highest uncertainty
   */
  private getMostUncertainDimension(ability: number[]): 'E' | 'N' | 'T' | 'J' {
    const dimensions = ['E', 'N', 'T', 'J'] as const;
    // Return dimension with ability closest to 0 (neutral/uncertain)
    let minAbs = Math.abs(ability[0]);
    let uncertainDim = 'E';
    
    dimensions.forEach((dim, idx) => {
      const abs = Math.abs(ability[idx]);
      if (abs < minAbs) {
        minAbs = abs;
        uncertainDim = dim;
      }
    });
    
    return uncertainDim as 'E' | 'N' | 'T' | 'J';
  }
  
  /**
   * Estimate optimal difficulty for next question
   */
  private estimateOptimalDifficulty(ability: number[]): number {
    // Target difficulty matching current ability estimate
    const avgAbility = ability.reduce((a, b) => a + b, 0) / ability.length;
    return Math.max(-3, Math.min(3, avgAbility / 25));
  }
  
  /**
   * Score an individual answer
   */
  private scoreAnswer(answer: Answer): number {
    const scores: { [key: string]: number } = {
      'a': -2, 'b': -1, 'c': 0, 'd': 1, 'e': 2
    };
    return scores[answer.selectedOption] || 0;
  }
}
