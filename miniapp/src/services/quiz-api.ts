import { Question, Answer } from '../store/quiz-store';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

/**
 * Fetch all quiz questions
 */
export async function fetchQuestions(): Promise<Question[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/quiz/questions`);
    if (!response.ok) {
      throw new Error('Failed to fetch questions');
    }
    const data = await response.json();
    return data.questions || data;
  } catch (error) {
    console.error('Error fetching questions:', error);
    // Return mock data for development
    return generateMockQuestions();
  }
}

/**
 * Save a single answer
 */
export async function saveAnswer(answer: Answer): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/quiz/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(answer),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save answer');
    }
  } catch (error) {
    console.error('Error saving answer:', error);
    // In development, we'll just log it
  }
}

/**
 * Save all answers at once (for completion)
 */
export async function submitAllAnswers(answers: Answer[]): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/quiz/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answers }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit answers');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error submitting answers:', error);
    throw error;
  }
}

/**
 * Get quiz results
 */
export async function getQuizResults(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/quiz/results`);
    if (!response.ok) {
      throw new Error('Failed to fetch results');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching results:', error);
    throw error;
  }
}

/**
 * Generate mock questions for development/testing
 * This creates 195 questions across different personality dimensions
 */
function generateMockQuestions(): Question[] {
  const dimensions = [
    'Openness',
    'Conscientiousness',
    'Extraversion',
    'Agreeableness',
    'Neuroticism'
  ];
  
  const questions: Question[] = [];
  
  for (let i = 1; i <= 195; i++) {
    const dimension = dimensions[(i - 1) % dimensions.length];
    questions.push({
      id: i,
      text: `Question ${i}: This is a sample question text for dimension ${dimension}. Rate how much you agree with this statement.`,
      dimension
    });
  }
  
  return questions;
}

/**
 * Auto-save answer with debounce
 */
export function createAutoSaveHandler() {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return async (questionId: number, value: number) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(async () => {
      await saveAnswer({ questionId, value });
    }, 500); // 500ms debounce
  };
}
