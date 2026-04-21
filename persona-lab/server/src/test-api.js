// 简单测试 API - 用于快速部署演示
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 模拟题库
const questions = [
  { id: 1, text: "在社交场合中，你通常会？", dimension: "E", options: [
    { id: 1, text: "主动和陌生人交谈", score: 100 },
    { id: 2, text: "等待别人先说话", score: 0 },
    { id: 3, text: "看情况而定", score: 50 },
    { id: 4, text: "不太确定", score: 50 }
  ]},
  { id: 2, text: "你更喜欢？", dimension: "N", options: [
    { id: 1, text: "关注未来的可能性", score: 100 },
    { id: 2, text: "关注当下的现实", score: 0 },
    { id: 3, text: "两者兼顾", score: 50 },
    { id: 4, text: "不确定", score: 50 }
  ]},
  { id: 3, text: "做决定时，你更看重？", dimension: "T", options: [
    { id: 1, text: "逻辑和理性", score: 100 },
    { id: 2, text: "情感和他人感受", score: 0 },
    { id: 3, text: "两者平衡", score: 50 },
    { id: 4, text: "不确定", score: 50 }
  ]},
  { id: 4, text: "你的生活方式更倾向于？", dimension: "J", options: [
    { id: 1, text: "有计划有条理", score: 100 },
    { id: 2, text: "灵活随性", score: 0 },
    { id: 3, text: "介于两者之间", score: 50 },
    { id: 4, text: "不确定", score: 50 }
  ]}
];

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取题目
app.get('/api/v1/tests/questions', (req, res) => {
  res.json({
    code: 0,
    data: {
      questions: questions,
      total: questions.length
    }
  });
});

// 提交答案并获取结果
app.post('/api/v1/tests/submit', (req, res) => {
  const { answers } = req.body;
  
  // 简单计算维度分数
  const scores = { E: 50, N: 50, T: 50, J: 50 };
  
  if (answers) {
    answers.forEach(ans => {
      const q = questions.find(q => q.id === ans.questionId);
      if (q) {
        const option = q.options.find(o => o.id === ans.optionId);
        if (option) {
          scores[q.dimension] = option.score;
        }
      }
    });
  }
  
  // 计算 MBTI 类型
  const type = 
    (scores.E >= 50 ? 'E' : 'I') +
    (scores.N >= 50 ? 'N' : 'S') +
    (scores.T >= 50 ? 'T' : 'F') +
    (scores.J >= 50 ? 'J' : 'P');
  
  res.json({
    code: 0,
    data: {
      result: {
        mbtiType: type,
        dimensions: {
          E: { score: scores.E, label: scores.E >= 50 ? '外向型' : '内向型' },
          N: { score: scores.N, label: scores.N >= 50 ? '直觉型' : '实感型' },
          T: { score: scores.T, label: scores.T >= 50 ? '思维型' : '情感型' },
          J: { score: scores.J, label: scores.J >= 50 ? '判断型' : '知觉型' }
        },
        stabilityIndex: 0.75,
        stabilityProbability: 82
      }
    }
  });
});

// 获取会员产品
app.get('/api/v1/memberships/products', (req, res) => {
  res.json({
    code: 0,
    data: {
      products: [
        { id: 'basic', name: '基础解锁', price: 9.9, features: ['8 条核心特征', '职业建议'] },
        { id: 'pro', name: '完整报告', price: 29, features: ['16 页深度报告', '优势与盲点', '人际关系', '成长计划'] },
        { id: 'premium', name: '尊享解锁', price: 49, features: ['完整报告', '双人合测', '30 天重测'] }
      ]
    }
  });
});

// 生成报告
app.post('/api/v1/reports', (req, res) => {
  const { mbtiType } = req.body;
  
  res.json({
    code: 0,
    data: {
      report: {
        type: 'pro',
        mbtiType: mbtiType || 'INFJ',
        title: `${mbtiType || 'INFJ'} ${getTypeName(mbtiType || 'INFJ')} - 深度人格报告`,
        summary: '你是一个富有想象力和理想主义的人，对世界有独特的洞察力。',
        content: {
          dimensions: { title: '四维深度解析', sections: [] },
          career: { title: '职业发展指引', suggestions: ['心理咨询师', '作家', '艺术家', '研究员'] },
          relationship: { title: '人际关系图谱', analysis: [] },
          growth: { title: '个人成长计划', plans: [] }
        }
      }
    }
  });
});

function getTypeName(type) {
  const names = {
    'INFJ': '提倡者', 'INFP': '调停者', 'ENFJ': '主人公', 'ENFP': '竞选者',
    'INTJ': '建筑师', 'INTP': '逻辑学家', 'ENTJ': '指挥官', 'ENTP': '辩论家',
    'ISTJ': '物流师', 'ISFJ': '守卫者', 'ESTJ': '总经理', 'ESFJ': '执政官',
    'ISTP': '鉴赏家', 'ISFP': '探险家', 'ESTP': '企业家', 'ESFP': '表演者'
  };
  return names[type] || '探索者';
}

app.listen(PORT, () => {
  console.log(`🚀 Persona Lab API running on http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`📝 Test questions: http://localhost:${PORT}/api/v1/tests/questions`);
});
