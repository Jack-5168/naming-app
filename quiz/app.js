// MBTI 人格测试 - 65 题完整版
const questions = [
  // E/I 维度 (1-17 题)
  { id: 1, dimension: 'EI', text: '在社交聚会上，你通常会？', a: '主动与很多人交谈', b: '只与几个熟悉的人交流', type: 'E' },
  { id: 2, dimension: 'EI', text: '周末你更喜欢？', a: '和朋友一起外出活动', b: '在家休息或做自己的事', type: 'E' },
  { id: 3, dimension: 'EI', text: '认识新朋友让你感到？', a: '兴奋和有活力', b: '有些疲惫需要独处恢复', type: 'E' },
  { id: 4, dimension: 'EI', text: '工作中你更喜欢？', a: '团队协作讨论', b: '独立完成任务', type: 'E' },
  { id: 5, dimension: 'EI', text: '你更擅长？', a: '边说边思考', b: '想清楚再说', type: 'E' },
  { id: 6, dimension: 'EI', text: '电话响起时你通常？', a: '立刻接听', b: '先看是谁再决定', type: 'E' },
  { id: 7, dimension: 'EI', text: '你更喜欢的学习方式是？', a: '小组讨论', b: '自己阅读', type: 'E' },
  { id: 8, dimension: 'EI', text: '在会议上你通常？', a: '积极发言', b: '倾听为主', type: 'E' },
  { id: 9, dimension: 'EI', text: '你的朋友圈？', a: '很大且多样化', b: '小而深', type: 'E' },
  { id: 10, dimension: 'EI', text: '遇到问题你更倾向？', a: '找人讨论', b: '自己思考', type: 'E' },
  { id: 11, dimension: 'EI', text: '你觉得自己是？', a: '外向的人', b: '内向的人', type: 'E' },
  { id: 12, dimension: 'EI', text: '聚会后你感到？', a: '更有精力', b: '需要休息', type: 'E' },
  { id: 13, dimension: 'EI', text: '你更喜欢的工作环境中？', a: '热闹开放', b: '安静私密', type: 'E' },
  { id: 14, dimension: 'EI', text: '表达情感时你？', a: '直接外露', b: '内敛含蓄', type: 'E' },
  { id: 15, dimension: 'EI', text: '旅行时你更喜欢？', a: '跟团或结伴', b: '独自或两人', type: 'E' },
  { id: 16, dimension: 'EI', text: '自我介绍时你？', a: '侃侃而谈', b: '简洁带过', type: 'E' },
  { id: 17, dimension: 'EI', text: '你更享受？', a: '成为焦点', b: '幕后支持', type: 'E' },
  
  // N/S 维度 (18-34 题)
  { id: 18, dimension: 'NS', text: '你更关注？', a: '整体和大方向', b: '细节和具体事实', type: 'N' },
  { id: 19, dimension: 'NS', text: '你更相信？', a: '直觉和灵感', b: '经验和证据', type: 'N' },
  { id: 20, dimension: 'NS', text: '学习时你更喜欢？', a: '理解概念原理', b: '掌握具体步骤', type: 'N' },
  { id: 21, dimension: 'NS', text: '你更擅长？', a: '想象未来', b: '把握现在', type: 'N' },
  { id: 22, dimension: 'NS', text: '描述事物时你倾向？', a: '用比喻和象征', b: '直接准确描述', type: 'N' },
  { id: 23, dimension: 'NS', text: '你更感兴趣？', a: '新想法和可能性', b: '实际应用和效果', type: 'N' },
  { id: 24, dimension: 'NS', text: '做决定时你更看重？', a: '长远影响', b: '当前情况', type: 'N' },
  { id: 25, dimension: 'NS', text: '你更喜欢？', a: '抽象理论', b: '具体案例', type: 'N' },
  { id: 26, dimension: 'NS', text: '别人觉得你？', a: '有想象力', b: '务实可靠', type: 'N' },
  { id: 27, dimension: 'NS', text: '你更关注？', a: '事物含义', b: '事物本身', type: 'N' },
  { id: 28, dimension: 'NS', text: '解决问题时你？', a: '寻找新方法', b: '使用已知方法', type: 'N' },
  { id: 29, dimension: 'NS', text: '你更喜欢的工作？', a: '有创造性', b: '有明确流程', type: 'N' },
  { id: 30, dimension: 'NS', text: '阅读时你更关注？', a: '主题思想', b: '具体细节', type: 'N' },
  { id: 31, dimension: 'NS', text: '你更倾向？', a: '改变和创新', b: '稳定和传统', type: 'N' },
  { id: 32, dimension: 'NS', text: '思考问题时你？', a: '跳跃性思维', b: '线性逻辑', type: 'N' },
  { id: 33, dimension: 'NS', text: '你更相信？', a: '第六感', b: '五感', type: 'N' },
  { id: 34, dimension: 'NS', text: '你更喜欢？', a: '未完成的挑战', b: '已完成的任务', type: 'N' },
  
  // T/F 维度 (35-50 题)
  { id: 35, dimension: 'TF', text: '做决定时你更看重？', a: '逻辑和原则', b: '感受和价值观', type: 'T' },
  { id: 36, dimension: 'TF', text: '你更重视？', a: '公平正义', b: '和谐关系', type: 'T' },
  { id: 37, dimension: 'TF', text: '别人难过时你首先？', a: '分析问题原因', b: '给予情感支持', type: 'T' },
  { id: 38, dimension: 'TF', text: '你更擅长？', a: '客观分析', b: '理解他人', type: 'T' },
  { id: 39, dimension: 'TF', text: '争论时你更关注？', a: '谁对谁错', b: '大家感受', type: 'T' },
  { id: 40, dimension: 'TF', text: '你觉得自己更？', a: '理性', b: '感性', type: 'T' },
  { id: 41, dimension: 'TF', text: '批评别人时你？', a: '直接指出问题', b: '委婉表达', type: 'T' },
  { id: 42, dimension: 'TF', text: '你更重视？', a: '能力', b: '态度', type: 'T' },
  { id: 43, dimension: 'TF', text: '面对冲突你倾向？', a: '据理力争', b: '寻求妥协', type: 'T' },
  { id: 44, dimension: 'TF', text: '你更相信？', a: '逻辑推理', b: '内心感受', type: 'T' },
  { id: 45, dimension: 'TF', text: '工作中你更看重？', a: '效率成果', b: '团队氛围', type: 'T' },
  { id: 46, dimension: 'TF', text: '做选择时你更听？', a: '大脑', b: '内心', type: 'T' },
  { id: 47, dimension: 'TF', text: '你更擅长？', a: '分析问题', b: '理解人心', type: 'T' },
  { id: 48, dimension: 'TF', text: '别人觉得你？', a: '冷静理性', b: '温暖体贴', type: 'T' },
  { id: 49, dimension: 'TF', text: '你更在意？', a: '事情对错', b: '人的感受', type: 'T' },
  { id: 50, dimension: 'TF', text: '表达关心时你？', a: '提供解决方案', b: '给予情感陪伴', type: 'T' },
  
  // J/P 维度 (51-65 题)
  { id: 51, dimension: 'JP', text: '你更喜欢？', a: '有计划的生活', b: '随性的生活', type: 'J' },
  { id: 52, dimension: 'JP', text: '截止日期前你通常？', a: '提前完成', b: '最后冲刺', type: 'J' },
  { id: 53, dimension: 'JP', text: '你的桌面通常？', a: '整洁有序', b: '有些凌乱', type: 'J' },
  { id: 54, dimension: 'JP', text: '做决定时你？', a: '快速决定', b: '继续收集信息', type: 'J' },
  { id: 55, dimension: 'JP', text: '旅行前你会？', a: '详细规划', b: '大概安排', type: 'J' },
  { id: 56, dimension: 'JP', text: '你更享受？', a: '完成任务', b: '开始新项目', type: 'J' },
  { id: 57, dimension: 'JP', text: '工作时你更喜欢？', a: '按部就班', b: '灵活调整', type: 'J' },
  { id: 58, dimension: 'JP', text: '你的待办清单？', a: '详细且执行', b: '有但不一定', type: 'J' },
  { id: 59, dimension: 'JP', text: '意外变化让你？', a: '不舒服', b: '无所谓', type: 'J' },
  { id: 60, dimension: 'JP', text: '你更喜欢？', a: '有结论', b: '保持开放', type: 'J' },
  { id: 61, dimension: 'JP', text: '生活中你更倾向？', a: '规律作息', b: '随心所欲', type: 'J' },
  { id: 62, dimension: 'JP', text: '购物时你？', a: '列好清单', b: '逛了再说', type: 'J' },
  { id: 63, dimension: 'JP', text: '你更擅长？', a: '执行计划', b: '应对变化', type: 'J' },
  { id: 64, dimension: 'JP', text: '别人觉得你？', a: '有条理', b: '随和', type: 'J' },
  { id: 65, dimension: 'JP', text: '你更重视？', a: '结果', b: '过程', type: 'J' }
];

let currentQuestion = 0;
let answers = [];

// 从 localStorage 加载进度
function loadProgress() {
  const saved = localStorage.getItem('mbti_answers');
  if (saved) {
    answers = JSON.parse(saved);
    currentQuestion = answers.length;
  }
}

// 保存进度
function saveProgress() {
  localStorage.setItem('mbti_answers', JSON.stringify(answers));
}

// 初始化
function init() {
  loadProgress();
  document.getElementById('total').textContent = questions.length;
  showQuestion();
}

// 显示题目
function showQuestion() {
  if (currentQuestion >= questions.length) {
    showResult();
    return;
  }
  
  const q = questions[currentQuestion];
  document.getElementById('current').textContent = currentQuestion + 1;
  document.getElementById('question-text').textContent = q.text;
  document.getElementById('option-a-text').textContent = q.a;
  document.getElementById('option-b-text').textContent = q.b;
  
  // 更新进度条
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  document.getElementById('progress').style.width = progress + '%';
  
  // 更新按钮状态
  document.getElementById('prev-btn').disabled = currentQuestion === 0;
  document.getElementById('next-btn').disabled = answers[currentQuestion] === undefined;
}

// 选择答案
function selectOption(option) {
  answers[currentQuestion] = option;
  saveProgress();
  document.getElementById('next-btn').disabled = false;
}

// 上一题
function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    showQuestion();
  }
}

// 下一题
function nextQuestion() {
  if (answers[currentQuestion]) {
    currentQuestion++;
    showQuestion();
  }
}

// 计算结果
function calculateResult() {
  const scores = { E: 0, I: 0, N: 0, S: 0, T: 0, F: 0, J: 0, P: 0 };
  
  questions.forEach((q, i) => {
    const answer = answers[i];
    if (answer === 'A') {
      scores[q.type]++;
    } else {
      // B 选项是相反类型
      const opposite = { E: 'I', I: 'E', N: 'S', S: 'N', T: 'F', F: 'T', J: 'P', P: 'J' }[q.type];
      scores[opposite]++;
    }
  });
  
  return {
    mbti: (scores.E >= scores.I ? 'E' : 'I') +
          (scores.N >= scores.S ? 'N' : 'S') +
          (scores.T >= scores.F ? 'T' : 'F') +
          (scores.J >= scores.P ? 'J' : 'P'),
    dimensions: {
      EI: { type: scores.E >= scores.I ? 'E' : 'I', score: scores.E, total: 17 },
      NS: { type: scores.N >= scores.S ? 'N' : 'S', score: scores.N, total: 17 },
      TF: { type: scores.T >= scores.F ? 'T' : 'F', score: scores.T, total: 16 },
      JP: { type: scores.J >= scores.P ? 'J' : 'P', score: scores.J, total: 15 }
    }
  };
}

// 显示结果
function showResult() {
  document.getElementById('quiz-container').style.display = 'none';
  document.getElementById('result-container').style.display = 'block';
  
  const result = calculateResult();
  document.getElementById('mbti-type').textContent = result.mbti;
  
  const dims = document.getElementById('dimensions');
  dims.innerHTML = `
    <div class="dimension">E/I: ${result.dimensions.EI.type} (${result.dimensions.EI.score}/${result.dimensions.EI.total})</div>
    <div class="dimension">N/S: ${result.dimensions.NS.type} (${result.dimensions.NS.score}/${result.dimensions.NS.total})</div>
    <div class="dimension">T/F: ${result.dimensions.TF.type} (${result.dimensions.TF.score}/${result.dimensions.TF.total})</div>
    <div class="dimension">J/P: ${result.dimensions.JP.type} (${result.dimensions.JP.score}/${result.dimensions.JP.total})</div>
  `;
  
  // 清除进度
  localStorage.removeItem('mbti_answers');
}

// 重新开始
function restartQuiz() {
  answers = [];
  currentQuestion = 0;
  localStorage.removeItem('mbti_answers');
  document.getElementById('quiz-container').style.display = 'block';
  document.getElementById('result-container').style.display = 'none';
  showQuestion();
}

// 启动
init();
