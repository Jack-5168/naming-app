/**
 * Persona-Lab H5 Server v2.0
 * Phase 1-2: PostgreSQL Storage + Proper Architecture
 */

const { PrismaClient } = require('@prisma/client');
const express = require('express');

const app = express();
app.use(express.json());

const prisma = new PrismaClient();

// ============================================
// CONFIG
// ============================================
const QUESTIONS = [
  // Openness (O) - 5 questions
  {
    id: 1, dim: 'O', text: '我喜欢尝试 new experiences', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 2, dim: 'O', text: 'I have an active imagination', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 3, dim: 'O', text: 'I value artistic/aesthetic experiences', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 4, dim: 'O', text: 'I enjoy thinking about abstract concepts', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 5, dim: 'O', text: 'I am open to new ideas', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },

  // Conscientiousness (C) - 5 questions
  {
    id: 6, dim: 'C', text: 'I am always prepared', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 7, dim: 'C', text: 'I pay attention to details', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 8, dim: 'C', text: 'I like to follow a schedule', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 9, dim: 'C', text: 'I am dependable', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 10, dim: 'C', text: 'I work hard', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },

  // Extraversion (E) - 5 questions
  {
    id: 11, dim: 'E', text: 'I am talkative', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 12, dim: 'E', text: 'I am outgoing', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 13, dim: 'E', text: 'I enjoy being around people', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 14, dim: 'E', text: 'I start conversations easily', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 15, dim: 'E', text: 'I am energetic around others', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },

  // Agreeableness (A) - 5 questions
  {
    id: 16, dim: 'A', text: 'I trust others', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 17, dim: 'A', text: 'I am helpful', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 18, dim: 'A', text: 'I forgive easily', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 19, dim: 'A', text: 'I care about others', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 20, dim: 'A', text: 'I am sympathetic', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },

  // Neuroticism (N) - 5 questions
  {
    id: 21, dim: 'N', text: 'I get stressed easily', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 22, dim: 'N', text: 'I worry about things', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
  {
    id: 23, dim: 'N', text: 'I am emotionally stable (inverse)', opts: [{ t: 'Strongly agree', v: -1 }, { t: 'Agree', v: 0 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 2 }, { t: 'Strongly disagree', v: 3 }],
  },
  {
    id: 24, dim: 'N', text: 'I remain calm under pressure (inverse)', opts: [{ t: 'Strongly agree', v: -1 }, { t: 'Agree', v: 0 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 2 }, { t: 'Strongly disagree', v: 3 }],
  },
  {
    id: 25, dim: 'N', text: 'I feel anxious sometimes', opts: [{ t: 'Strongly agree', v: 3 }, { t: 'Agree', v: 2 }, { t: 'Neutral', v: 1 }, { t: 'Disagree', v: 0 }, { t: 'Strongly disagree', v: -1 }],
  },
];

// ============================================
// ROUTES
// ============================================

// Health
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', questions: QUESTIONS.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create session
app.post('/sessions', async (req, res) => {
  try {
    const { userId } = req.body || {};
    const id = 's' + Date.now() + Math.random().toString(36).slice(2, 8);

    const session = await prisma.session.create({
      data: {
        id,
        userId: userId || null,
        state: 'in_progress',
        answers: [],
        currentQuestion: 0,
      },
    });

    res.json({ sessionId: id, message: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get next question
app.get('/sessions/:id/next', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await prisma.session.findUnique({ where: { id } });

    if (!session) {
      return res.json({
        question: { id: 1, text: QUESTIONS[0].text, opts: QUESTIONS[0].opts },
        progress: { current: 1, total: 25 },
        note: 'starting fresh',
      });
    }

    if (session.state === 'completed') {
      return res.json({ done: true, result: { mbti: calculateResult(session) } });
    }

    const qIdx = session.currentQuestion % QUESTIONS.length;
    const q = QUESTIONS[qIdx];
    const cur = session.currentQuestion + 1;

    await prisma.session.update({
      where: { id },
      data: { currentQuestion: cur },
    });

    res.json({
      question: {
        id: q.id, text: q.text, dim: q.dim, opts: q.opts.map((o) => ({ id: v16_encode(o.t), text: o.t })),
      },
      progress: { current: cur, total: 25 },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit answer
app.post('/sessions/:id/answer', async (req, res) => {
  try {
    const { id } = req.params;
    const { optionId, questionId } = req.body;

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.state === 'completed') return res.json({ error: 'Already completed' });

    // Find question score
    const qIdx = QUESTIONS.findIndex((q) => q.id === (questionId || session.currentQuestion + 1));
    const q = QUESTIONS[qIdx];
    const optIdx = q.opts.findIndex((o) => v16_encode(o.t) === optionId);
    const score = q.opts[optIdx]?.v || 0;

    // Append answer
    const answers = [...(session.answers || []), { q: q.id, d: q.dim, s: score }];
    const cur = session.currentQuestion + 1;

    if (cur >= 25) {
      await prisma.session.update({
        where: { id },
        data: {
          answers, currentQuestion: cur, state: 'completed', completedAt: new Date(),
        },
      });
      return res.json({ done: true, result: { mbti: calculateResult({ answers }) } });
    }

    await prisma.session.update({
      where: { id },
      data: { answers, currentQuestion: cur },
    });

    // Next question
    const nextIdx = cur % QUESTIONS.length;
    const nextQ = QUESTIONS[nextIdx];

    res.json({
      question: {
        id: nextQ.id, text: nextQ.text, dim: nextQ.dim, opts: nextQ.opts.map((o) => ({ id: v16_encode(o.t), text: o.t })),
      },
      progress: { current: cur + 1, total: 25 },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// HELPERS
// ============================================

function v16_encode(s) {
  return btoa(s).slice(0, 8).replace(/[/+=]/g, 'x');
}

function calculateResult(session) {
  const scores = {
    O: 0, C: 0, E: 0, A: 0, N: 0,
  };
  const counts = {
    O: 0, C: 0, E: 0, A: 0, N: 0,
  };

  (session.answers || []).forEach((a) => {
    if (scores[a.d !== undefined]) { scores[a.d] += a.s; counts[a.d]++; }
  });

  // Average normalize to 0-100
  for (const k in scores) {
    scores[k] = Math.round(((scores[k] / (counts[k] || 1)) + 1.5) / 3 * 100);
    scores[k] = Math.max(0, Math.min(100, scores[k]));
  }

  // MBTI-like derived type
  let type = '';
  type += scores.E >= 50 ? 'E' : 'I';
  type += scores.O >= 50 ? 'N' : 'S';
  type += scores.C >= 50 ? 'J' : 'P';
  type += scores.A >= 50 ? 'F' : 'T';

  const names = {
    O: 'Open-minded', C: 'Organized', E: 'Outgoing', A: 'Cooperative', N: 'Sensitive',
  };

  const highDims = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => names[x[0]])
    .join(', ');

  return {
    mbti: type,
    scores,
    summary: `Your top traits: ${highDims}`,
    interpretation: `Openness: ${scores.O}%, Conscientiousness: ${scores.C}%, Extraversion: ${scores.E}%, Agreeableness: ${scores.A}%, Neuroticism: ${scores.N}%`,
  };
}

// Start
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`[INFO] Server v2 on ${PORT}`));

// Graceful shutdown
process.on('SIGTERM', () => prisma.$disconnect());
process.on('SIGINT', () => prisma.$disconnect());
