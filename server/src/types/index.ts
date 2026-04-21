/**
 * Type Definitions for Persona Lab
 */

export interface Question {
  id: string;
  dimension: 'E' | 'N' | 'T' | 'J';
  difficulty: number;
  content: string;
  options: QuestionOption[];
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Answer {
  questionId: string;
  dimension: 'E' | 'N' | 'T' | 'J';
  selectedOption: string;
  timestamp: number;
}

export interface AbilityEstimate {
  E: number;
  N: number;
  T: number;
  J: number;
}

export interface TestSession {
  id: string;
  userId: string;
  answers: Answer[];
  startTime: number;
  endTime?: number;
  completed: boolean;
}

export interface MBTIResult {
  type: string;
  dimensions: {
    E: { score: number; label: string };
    N: { score: number; label: string };
    T: { score: number; label: string };
    J: { score: number; label: string };
  };
  confidence: number;
}

export interface TestResult {
  mbtiType: string;
  dimensionScores: {
    E: number;
    N: number;
    T: number;
    J: number;
  };
  confidence: number;
  completedAt: number;
}

export interface TestHistory {
  testId: string;
  mbtiType: string;
  dimensionScores?: {
    E: number;
    N: number;
    T: number;
    J: number;
  };
  completedAt: number;
}

export interface StabilityResult {
  stabilityIndex: number;
  stabilityProbability: number;
  status: 'stable' | 'moderate' | 'unstable' | 'new';
  confidenceBand: {
    lower: number;
    upper: number;
  };
  dimensionStability?: number;
}

export interface AnswerResponse {
  accepted: boolean;
  nextQuestion?: Question;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  ability?: {
    E: number;
    N: number;
    T: number;
    J: number;
  };
  sem?: number;
  completed: boolean;
  result?: TestResult;
  stability?: StabilityResult;
}
