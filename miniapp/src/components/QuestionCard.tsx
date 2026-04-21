import { View, Text } from '@tarojs/components';
import './QuestionCard.css';

interface QuestionCardProps {
  question: {
    id: string;
    text: string;
    options: Array<{
      id: string;
      code: string;
      text: string;
    }>;
  };
  questionNumber: number;
  onAnswer: (optionId: string) => void;
  disabled?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionNumber,
  onAnswer,
  disabled = false,
}) => {
  return (
    <View className="question-card">
      <View className="question-header">
        <Text className="question-number">第 {questionNumber} 题</Text>
      </View>
      
      <View className="question-content">
        <Text className="question-text">{question.text}</Text>
      </View>

      <View className="options-list">
        {question.options.map((option) => (
          <View
            key={option.id}
            className={`option-item ${disabled ? 'disabled' : ''}`}
            onClick={() => !disabled && onAnswer(option.id)}
          >
            <View className="option-code">{option.code}</View>
            <Text className="option-text">{option.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default QuestionCard;
