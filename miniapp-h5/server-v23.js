const {Pool}=require('pg');
const express=require('express');
const app=express();
app.use(express.json());

const pool = new Pool({
  connectionString: 'postgresql://persona_lab:persona_pass_2026@localhost:5432/persona_lab'
});

// Neo-FFI 25 items
const Q = [
  {id:1,d:'O',txt:'I have a vivid imagination'},
  {id:2,d:'O',txt:'I have original ideas'},
  {id:3,d:'O',txt:'I value artistic experiences'},
  {id:4,d:'O',txt:'I enjoy exploring new ideas'},
  {id:5,d:'O',txt:'I am curious about many things'},
  {id:6,d:'C',txt:'I am always prepared'},
  {id:7,d:'C',txt:'I pay attention to details'},
  {id:8,d:'C',txt:'I follow through on my commitments'},
  {id:9,d:'C',txt:'I like order and structure'},
  {id:10,d:'C',txt:'I set goals and work toward them'},
  {id:11,d:'E',txt:'I am talkative'},
  {id:12,d:'E',txt:'I feel energized around others'},
  {id:13,d:'E',txt:'I enjoy social gatherings'},
  {id:14,d:'E',txt:'I start conversations easily'},
  {id:15,d:'E',txt:'I am outgoing and friendly'},
  {id:16,d:'A',txt:'I trust what others say'},
  {id:17,d:'A',txt:'I am considerate of others'},
  {id:18,d:'A',txt:'I am willing to help others'},
  {id:19,d:'A',txt:'I believe the best about people'},
  {id:20,d:'A',txt:'I am easy to get along with'},
  {id:21,d:'N',txt:'I feel anxious often',inv:true},
  {id:22,d:'N',txt:'I worry about things',inv:true},
  {id:23,d:'N',txt:'I am emotionally unstable',inv:true},
  {id:24,d:'N',txt:'I feel overwhelmed by stress',inv:true},
  {id:25,d:'N',txt:'I get nervous easily',inv:true}
];

const OPS = ['Strongly Agree','Agree','Neutral','Disagree','Strongly Disagree'];
const SCORES = [4,3,2,1,0];

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ok: true, qs: 25});
  } catch (e) { res.status(500).json({e:e.message}); }
});

app.post('/sessions', async (req, res) => {
  try {
    const id = 's' + Date.now().toString(36);
    const body = req.body || {};
    await pool.query(
      `INSERT INTO sessions (id, user_id, state, answers, current_question, started_at) 
       VALUES ($1, $2, 'in_progress', '{}', 0, NOW())`,
      [id, body.userId || null]
    );
    res.json({sessionId: id});
  } catch(e) { res.status(500).json({e:e.message}); }
});

app.get('/sessions/:id/next', async (req, res) => {
  try {
    const {id} = req.params;
    const r = await pool.query(`SELECT * FROM sessions WHERE id = $1`, [id]);
    if (r.rows.length === 0) {
      return res.json({question:{id:1,dim:'O',text:Q[0].txt,options:OPS}, progress:{current:1,total:25}});
    }
    const s = r.rows[0];
    if (s.state === 'completed') {
      return res.json({done: true, result: calcResults(s.answers||[]))});
    }
    const cur = (s.current_question || 0) + 1;
    const q = Q[cur-1];
    res.json({
      question: {id: q.id, dim: q.d, text: q.txt, options: OPS},
      progress: {current: cur, total: 25}
    });
  } catch(e) { res.status(500).json({e:e.message}); }
});

app.post('/sessions/:id/answer', async (req, res) => {
  try {
    const {id} = req.params;
    const body = req.body || {};
    const optionId = body.optionId;
    const questionId = body.questionId;
    
    const r = await pool.query(`SELECT * FROM sessions WHERE id = $1`, [id]);
    if (r.rows.length === 0) return res.status(404).json({error:'Session not found'});
    if (r.rows[0].state === 'completed') return res.json({error:'Already completed'});
    
    const s = r.rows[0];
    const cur = (s.current_question || 0) + 1;
    const q = Q[cur-1];
    const optIdx = OPS.indexOf(optionId);
    let score = SCORES[optIdx] !== undefined ? SCORES[optIdx] : 2;
    if (q.inv) score = 4 - score;
    
    const answers = [...(s.answers||[]) || []), {q: q.id, d: q.d, s: score}];
    
    if (cur >= 25) {
      await pool.query(
        `UPDATE sessions SET answers = $1, current_question = $2, state = 'completed', completed_at = NOW() WHERE id = $3`,
        [JSON.stringify(answers), cur, id]
      );
      return res.json({done: true, result: calcResults(answers)});
    }
    
    await pool.query(
      `UPDATE sessions SET answers = $1, current_question = $2 WHERE id = $3`,
      [JSON.stringify(answers), cur, id]
    );
    
    const nextQ = Q[cur];
    res.json({
      question: {id: nextQ.id, dim: nextQ.d, text: nextQ.txt, options: OPS},
      progress: {current: cur+1, total: 25}
    });
  } catch(e) { res.status(500).json({e:e.message}); }
});

function calcResults(answers) {
  const scores = {O:0,C:0,E:0,A:0,N:0};
  const cnts = {O:0,C:0,E:0,A:0,N:0};
  (answers || []).forEach(a => {
    if (scores[a.d] !== undefined) {
      scores[a.d] += a.s;
      cnts[a.d]++;
    }
  });
  const percent = {};
  for (const k in cnts) {
    percent[k] = Math.round(((scores[k] / cnts[k]) / 4) * 100);
  }
  let mt = '';
  mt += percent.E >= 50 ? 'E' : 'I';
  mt += percent.O >= 50 ? 'N' : 'S';
  mt += percent.C >= 50 ? 'J' : 'P';
  mt += percent.A >= 50 ? 'F' : 'T';
  return {
    mbti: mt,
    scores: percent,
    summary: `Top traits: ${Object.entries(percent).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]).join(', ')}`
  };
}

app.listen(3002, () => console.log('[OK] Server v2.3 running on port 3002'));
