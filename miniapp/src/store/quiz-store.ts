import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Question {
  id: number;
  text: string;
  dimension: string;
}

export interface Answer {
  questionId: number;
  value: number; // 1-5 Likert scale
}

interface QuizState {
  // State
  currentQuestionIndex: number;
  answers: Record<number, number>; // questionId -> value
  questions: Question[];
  isComplete: boolean;

  // Actions
  setCurrentQuestion: (index: number) => void;
  setAnswer: (questionId: number, value: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  loadQuestions: (questions: Question[]) => void;
  markComplete: () => void;
  resetQuiz: () => void;

  // Computed
  progress: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentQuestionIndex: 0,
      answers: {},
      questions: [],
      isComplete: false,

      // Actions
      setCurrentQuestion: (index) => {
        const questions = get().questions;
        if (index >= 0 && index < questions.length) {
          set({ currentQuestionIndex: index });
        }
      },

      setAnswer: (questionId, value) => {
        set((state) => ({
          answers: { ...state.answers, [questionId]: value },
        }));
      },

      nextQuestion: () => {
        const { currentQuestionIndex, questions } = get();
        if (currentQuestionIndex < questions.length - 1) {
          set({ currentQuestionIndex: currentQuestionIndex + 1 });
        }
      },

      previousQuestion: () => {
        const { currentQuestionIndex } = get();
        if (currentQuestionIndex > 0) {
          set({ currentQuestionIndex: currentQuestionIndex - 1 });
        }
      },

      loadQuestions: (questions) => {
        set({ questions, currentQuestionIndex: 0 });
      },

      markComplete: () => {
        set({ isComplete: true });
      },

      resetQuiz: () => {
        set({
          currentQuestionIndex: 0,
          answers: {},
          isComplete: false,
        });
      },

      // Computed values
      get progress() {
        const { currentQuestionIndex, questions } = get();
        if (questions.length === 0) return 0;
        return ((currentQuestionIndex + 1) / questions.length) * 100;
      },

      get canGoNext() {
        const { currentQuestionIndex, questions, answers } = get();
        const currentQuestion = questions[currentQuestionIndex];
        if (!currentQuestion) return false;
        return answers[currentQuestion.id] !== undefined;
      },

      get canGoPrevious() {
        const { currentQuestionIndex } = get();
        return currentQuestionIndex > 0;
      },
    }),
    {
      name: "quiz-storage", // localStorage key
      partialize: (state) => ({
        currentQuestionIndex: state.currentQuestionIndex,
        answers: state.answers,
        isComplete: state.isComplete,
      }),
    },
  ),
);
