const { Pool } = require('pg');
const express = require('express');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString:
    'postgresql://persona_lab:persona_pass_2026@localhost:5432/persona_lab',
});

const QUESTIONS = [
  { id: 1, d: 'O', t: 'I have a vivid imagination' },
  { id: 2, d: 'O', t: 'I have original ideas' },
  { id: 3, d: 'O', t: 'I value artistic experiences' },
  { id: 4, d: 'O', t: 'I enjoy exploring new ideas' },
  { id: 5, d: 'O', t: 'I am curious' },
  { id: 6, d: 'C', t: 'I am always prepared' },
  { id: 7, d: 'C', t: 'I pay attention to details' },
  { id: 8, d: 'C', t: 'I follow through' },
  { id: 9, d: 'C', t: 'I like structure' },
  { id: 10, d: 'C', t: 'I set goals' },
  { id: 11, d: 'E', t: 'I am talkative' },
  { id: 12, d: 'E', t: 'I feel energized' },
  { id: 13, d: 'E', t: 'I enjoy gatherings' },
  { id: 14, d: 'E', t: 'I start conversations' },
  { id: 15, d: 'E', t: 'I am outgoing' },
  { id: 16, d: 'A', t: 'I trust others' },
  { id: 17, d: 'A', t: 'I am considerate' },
  { id: 18, d: 'A', t: 'I help others' },
  { id: 19, d: 'A', t: 'I believe best' },
  { id: 20, d: 'A', t: 'I get along' },
  {
    id: 21, d: 'N', t: 'I feel anxious', inv: true,
  },
  {
    id: 22, d: 'N', t: 'I worry', inv: true,
  },
  {
    id: 23, d: 'N', t: 'I am unstable', inv: true,
  },
  {
    id: 24, d: 'N', t: 'I feel overwhelmed', inv: true,
  },
  {
    id: 25, d: 'N', t: 'I get nervous', inv: true,
  },
];

const OPTS = [
  'Strongly Agree',
  'Agree',
  'Neutral',
  'Disagree',
  'Strongly Disagree',
];
const VL = [4, 3, 2, 1, 0];

app.get('/health', async (req, res) => {
  res.json({ ok: 1 });
});

app.post('/sessions', async (req, res) => {
  const id = 's' + Date.now().toString(36);
  const uid = req.body?.userId || null;
  await pool.query('INSERT INTO sessions(id,user_id) VALUES($1,$2)', [id, uid]);
  res.json({ sessionId: id });
});

app.get('/sessions/:id/next', async (req, res) => {
  const r = await pool.query('SELECT * FROM sessions WHERE id=$1', [
    req.params.id,
  ]);
  const s = r.rows[0];
  if (!s) {
    return res.json({
      q: {
        id: 1, d: 'O', t: QUESTIONS[0].t, opts: OPTS,
      },
      p: { c: 1, t: 25 },
    });
  }
  if (s.state === 'done') return res.json({ done: true, res: calc(s.answers) });
  const cur = (s.current_question || 0) + 1;
  res.json({
    q: {
      id: QUESTIONS[cur - 1].id,
      d: QUESTIONS[cur - 1].d,
      t: QUESTIONS[cur - 1].t,
      opts: OPTS,
    },
    p: { c: cur, t: 25 },
  });
});

app.post('/sessions/:id/answer', async (req, res) => {
  const r = await pool.query('SELECT * FROM sessions WHERE id=$1', [
    req.params.id,
  ]);
  const s = r.rows[0];
  if (!s) return res.status(404).json({ e: 'nf' });
  const opt = req.body?.optionId;
  const cur = (s.current_question || 0) + 1;
  const qi = QUESTIONS[cur - 1];
  const vi = VL[OPTS.indexOf(opt)] || 2;
  const sc = qi.inv ? 4 - vi : vi;
  const ans = s.answers ? s.answers : [];
  ans.push({ d: qi.d, s: sc });
  if (cur >= 25) {
    await pool.query('UPDATE sessions SET state=done,answers=$1 WHERE id=$2', [
      JSON.stringify(ans),
      req.params.id,
    ]);
    return res.json({ done: true, res: calc(ans) });
  }
  await pool.query(
    'UPDATE sessions SET current_question=$1,answers=$2 WHERE id=$3',
    [cur, JSON.stringify(ans), req.params.id],
  );
  res.json({
    q: {
      id: QUESTIONS[cur].id,
      d: QUESTIONS[cur].d,
      t: QUESTIONS[cur].t,
      opts: OPTS,
    },
    p: { c: cur + 1, t: 25 },
  });
});

function calc(ans) {
  const sc = {
    O: 0, C: 0, E: 0, A: 0, N: 0,
  };
  const cn = {
    O: 0, C: 0, E: 0, A: 0, N: 0,
  };
  (ans || []).forEach((a) => {
    if (a.d && sc[a.d] != null) {
      sc[a.d] += a.s;
      cn[a.d]++;
    }
  });
  const pt = {};
  for (const k in cn) pt[k] = Math.round((sc[k] / cn[k] / 4) * 100);
  let mt = '';
  mt += pt.E >= 50 ? 'E' : 'I';
  mt += pt.O >= 50 ? 'N' : 'S';
  mt += pt.C >= 50 ? 'J' : 'P';
  mt += pt.A >= 50 ? 'F' : 'T';
  return { mbti: mt, scores: pt };
}

app.listen(3002, () => console.log('[OK]v2.5'));
