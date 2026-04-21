/**
 * Persona Lab - Type Definitions
 * Core types for CAT engine (IPIP-NEO 5 dimensions), stability calculation, and A/B testing
 */
export type Big5Dimension = 'O' | 'C' | 'E' | 'A' | 'N';
export interface CATConfig {
    maxQuestions: number;
    minQuestions: number;
    targetSEM: number;
    abilityRange: [number, number];
    dimensions: Big5Dimension[];
}
export interface Question {
    id: string;
    dimension: Big5Dimension;
    difficulty: number;
    discrimination: number;
    content: string;
    options: QuestionOption[];
    reverseScored?: boolean;
}
export interface QuestionOption {
    value: number;
    text: string;
}
export interface Answer {
    questionId: string;
    dimension: Big5Dimension;
    response: number;
    timestamp: number;
}
export interface AbilityEstimate {
    theta: number;
    sem: number;
    confidenceInterval: [number, number];
}
export interface Big5Scores {
    O: number;
    C: number;
    E: number;
    A: number;
    N: number;
}
export interface MBTIResult {
    type: string;
    dimensions: {
        E_I: 'E' | 'I' | 'balanced';
        N_S: 'N' | 'S' | 'balanced';
        T_F: 'T' | 'F' | 'balanced';
        J_P: 'J' | 'P' | 'balanced';
    };
    confidence: {
        overall: number;
        perDimension: {
            E_I: number;
            N_S: number;
            T_F: number;
            J_P: number;
        };
    };
    description: string;
}
export interface TestResult {
    testId: string;
    userId: number;
    completedAt: number;
    scores: Big5Scores;
    questionCount: number;
    testMode: 'CAT' | 'CLASSIC';
}
export interface StabilityResult {
    stabilityIndex: number;
    stabilityProbability: number;
    stabilityProbabilityDisplay: string;
    isRange: boolean;
    stabilityWarning: string | null;
    confidenceBand: [number, number];
    status: 'stable' | 'evolving' | 'unstable' | 'insufficient_data';
    perDimension: {
        O: {
            mean: number;
            std: number;
            cv: number;
        };
        C: {
            mean: number;
            std: number;
            cv: number;
        };
        E: {
            mean: number;
            std: number;
            cv: number;
        };
        A: {
            mean: number;
            std: number;
            cv: number;
        };
        N: {
            mean: number;
            std: number;
            cv: number;
        };
    };
}
export interface DimensionStability {
    mean: number;
    stdDev: number;
    range: number;
    stabilityIndex: number;
}
export interface StabilityConfig {
    monteCarloIterations: number;
    confidenceLevel: number;
    minTestsForStable: number;
    minTestsForEvolving: number;
}
export interface ABTestConfig {
    experimentId: string;
    name: string;
    description: string;
    trafficSplit: number;
    startDate: number;
    endDate?: number;
    status: 'draft' | 'running' | 'paused' | 'completed';
    variants: ABTestVariant[];
    metrics: ABTestMetric[];
}
export interface ABTestVariant {
    variantId: string;
    name: string;
    description: string;
    config: Record<string, any>;
}
export interface ABTestMetric {
    metricId: string;
    name: string;
    type: 'conversion' | 'continuous' | 'count';
    targetValue?: number;
}
export interface ABTestExposure {
    userId: string;
    experimentId: string;
    variantId: string;
    exposedAt: number;
}
export interface ABTestEvent {
    userId: string;
    experimentId: string;
    variantId: string;
    metricId: string;
    value: number;
    timestamp: number;
}
export interface ABTestResults {
    experimentId: string;
    variantResults: {
        variantId: string;
        sampleSize: number;
        metricResults: {
            [metricId: string]: {
                mean: number;
                stdDev: number;
                confidenceInterval: [number, number];
            };
        };
    }[];
    statisticalSignificance: {
        metricId: string;
        pValue: number;
        isSignificant: boolean;
        effectSize: number;
    }[];
    recommendation: string;
}
export interface DimensionSpectrumData {
    dimension: Big5Dimension;
    dimensionName: string;
    score: number;
    percentile?: number;
    label: string;
    confidenceInterval: [number, number];
    stabilityIndex: number;
    stabilityStatus: 'stable' | 'evolving' | 'unstable' | 'insufficient_data';
}
export interface PersonalityProfile {
    userId: number;
    dimensions: DimensionSpectrumData[];
    mbtiReference?: MBTIResult;
    overallStability: StabilityResult;
    lastUpdatedAt: number;
}
//# sourceMappingURL=index.d.ts.map