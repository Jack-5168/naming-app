import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuizStore } from "../../store/quiz-store";
import {
  fetchQuestions,
  submitAllAnswers,
  createAutoSaveHandler,
} from "../../services/quiz-api";
import QuestionCard from "../../components/QuestionCard";
import ProgressBar from "../../components/ProgressBar";
import "./quiz.css";

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    currentQuestionIndex,
    answers,
    questions,
    isComplete,
    progress,
    canGoNext,
    canGoPrevious,
    setCurrentQuestion,
    setAnswer,
    nextQuestion,
    previousQuestion,
    loadQuestions,
    markComplete,
  } = useQuizStore();

  // Auto-save handler with debounce
  const autoSaveAnswer = React.useMemo(() => createAutoSaveHandler(), []);

  // Load questions on mount
  useEffect(() => {
    const loadQuizData = async () => {
      try {
        const fetchedQuestions = await fetchQuestions();
        loadQuestions(fetchedQuestions);
      } catch (error) {
        console.error("Failed to load quiz:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (questions.length === 0) {
      loadQuizData();
    } else {
      setIsLoading(false);
    }
  }, []);

  // Check if quiz is complete and redirect
  useEffect(() => {
    if (isComplete && questions.length > 0) {
      navigate("/quiz/results");
    }
  }, [isComplete, navigate, questions.length]);

  // Handle answer selection
  const handleSelectAnswer = (value: number) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion) {
      setAnswer(currentQuestion.id, value);
      autoSaveAnswer(currentQuestion.id, value);
    }
  };

  // Handle next button click
  const handleNext = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      nextQuestion();
    } else {
      // Last question - submit all answers
      await handleSubmit();
    }
  };

  // Submit all answers
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const answersArray = Object.entries(answers).map(
        ([questionId, value]) => ({
          questionId: Number(questionId),
          value,
        }),
      );

      await submitAllAnswers(answersArray);
      markComplete();
      navigate("/quiz/results");
    } catch (error) {
      console.error("Failed to submit quiz:", error);
      // Still mark as complete even if API fails
      markComplete();
      navigate("/quiz/results");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle previous button click
  const handlePrevious = () => {
    previousQuestion();
  };

  if (isLoading) {
    return (
      <div className="quiz-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>加载题目中...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="quiz-container">
        <div className="error-state">
          <p>暂无题目</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion?.id];

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h1 className="quiz-title">人格特质测试</h1>
        <p className="quiz-subtitle">请根据你的实际情况选择最符合的选项</p>
      </div>

      <div className="quiz-content">
        <ProgressBar
          progress={progress}
          current={currentQuestionIndex + 1}
          total={questions.length}
        />

        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            selectedValue={currentAnswer}
            onSelect={handleSelectAnswer}
          />
        )}

        <div className="quiz-navigation">
          <button
            className="nav-button previous"
            onClick={handlePrevious}
            disabled={!canGoPrevious}
          >
            ← 上一题
          </button>

          <button
            className="nav-button next"
            onClick={handleNext}
            disabled={!canGoNext || isSubmitting}
          >
            {isSubmitting
              ? "提交中..."
              : currentQuestionIndex === questions.length - 1
                ? "完成测试"
                : "下一题 →"}
          </button>
        </div>
      </div>

      <div className="quiz-footer">
        <p>共 {questions.length} 题 · 请耐心完成所有题目</p>
      </div>
    </div>
  );
};

export default Quiz;
