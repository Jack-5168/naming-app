/**
 * Persona-Lab Server v2.1
 * PostgreSQL + Pure pg (no Prisma dependency hell)
 */

const { Pool } = require('pg');
const express = require('express');

const app = express();
app.use(express.json());

// Create pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://persona_lab:persona_pass_2026@localhost:5432/persona_lab'
});

// Test on startup
pool.query('SELECT 1').then(() => console.log('[INFO] DB connected')).catch(e=>console.error('[DB]',e));

// ============================================
// NEO-FFI Questions (25 items, 5 per dimension)
// Simplified IPIP-NEO-120 Short Form
// ============================================
const Q = [
  // Openness (O)
  {id:1,dim:'O',txt:"I have a vivid imagination"},
  {id:2,dim:'O',txt:"I have original ideas"},
  {id:3,dim:'O',txt:"I value artistic experiences"},
  {id:4,dim:'O',txt:"I enjoy exploring new ideas"},
  {id:5,dim:'O',txt:"I am curious about many things"},
  
  // Conscientiousness (C)
  {id:6,dim:'C',txt:"I am always prepared"},
  {id:7,dim:'C',txt:"I pay attention to details"},
  {id:8,dim:'C',txt:"I follow through on my commitments"},
  {id:9,dim:'C',txt:"I like order and structure"},
  {id:10,dim:'C',txt:"I set goals and work toward them"},
  
  // Extraversion (E)
  {id:11,dim:'E',txt:"I am talkative"},
  {id:12,dim:'E',txt:"I feel energized around others"},
  {id:13,dim:'E',txt:"I enjoy social gatherings"},
  {id:14,dim:'E',txt:"I start conversations easily"},
  {id:15,dim:'E',txt:"I am outgoing and friendly"},
  
  // Agreeableness (A)
  {id:16,dim:'A',txt:"I trust what others say"},
  {id:17,dim:'A',txt:"I am considerate of others"},
  {id:18,dim:'A',txt:"I am willing to help others"},
  {id:19,dim:'A',txt:"I believe the best about people"},
  {id:20,dim:'A',txt:"I am easy to get along with"},
  
  // Neuroticism (N) - inverted scoring
  {id:21,dim:'N',txt:"I feel anxious often",inv:true},
  {id:22,dim:'N',txt:"I worry about things",inv:true},
  {id:23,dim:'N',txt:"I am emotionally unstable",inv:true},
  {id:24,dim:'N',txt:"I feel overwhelmed by stress",inv:true},
  {id:25,dim:'N',txt:"I get nervous easily",inv:true}
];

// O -> option text
const OPS = ['Strongly Agree','Agree','Neutral','Disagree','Strongly Disagree'];
const OVS = [4,3,2,1,0]; // Note: N questions invert this

// ============================================
// Routes
// ============================================

app.get('/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT 1');
    res.json({status:'ok',db:'connected',questions:Q.length});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
});

app.post('/sessions', async (req, res) => {
  try {
    const {userId} = req.body || {};
    const id = 's' + Date.now().toString(36);
    
    await pool.query(
      `INSERT INTO sessions (id, user_id, state, answers, current_question, started_at)
       VALUES ($1, $2, 'in_progress', $3, 0, NOW())`,
      [id, userId || null, JSON.stringify([])]
    );
    
    res.json({sessionId:id});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
});

app.get('/sessions/:id/next', async (req, res) => {
  try {
    const {id} = req.params;
    const r = await pool.query(`SELECT * FROM sessions WHERE id=$1`,[id]);
    const s = r.rows[0];
    
    if (!s) {
      return res.json({question:Q[0],progress:{current:1,total:25},note:'new'});
    }
    
    if (s.state==='completed') {
      return res.json({done:true,result:calcScore(s.answers)});
    }
    
    const cur = (s.current_question || 0) + 1;
    if (cur > 25) {
      await pool.query(`UPDATE sessions SET state='completed',completed_at=NOW() WHERE id=$1`,[id]);
      return res.json({done:true,result:calcScore(s.answers)});
    }
    
    await pool.query(`UPDATE sessions SET current_question=$1 WHERE id=$2`,[cur,id]);
    
    const q = Q[cur-1];
    res.json({
      question: {id:q.id,dim:q.dim,text:q.txt,opts:OPS.slice()},
      progress:{current:cur,total:25}
    });
  } catch(e) {
    res.status(500).json({error:e.message});
  }
});

app.post('/sessions/:id/answer', async (req, res) => {
  try {
    const {id} = req.params;
    const body = req.body || {}; const opt = req.body?.opt || req.body?.opt; const qid = req.body?.qid || req.body?.q || req.body?.qid;
    
    const r = await pool.query(`SELECT * FROM sessions WHERE id=$1`,[id]);
    const s = r.rows[0];
    if (!s) return res.status(404).json({error:'Session not found'});
    
    // Calculate score
    const qIdx = (qid||s.current_question||0)-1;
    const q = Q[qIdx];
    const ansIdx = OPS.indexOf(opt);
    let score = OVS[ansIdx] || 2;
    if (q.inv) score = 4 - score; // Invert
    
    // Update answers
    const answers = [...(s.answers||[]), {q:q.id,d:q.dim,s:score}];
    const cur = (s.current_question || 0) + 1;
    
    if (cur >= 25) {
      await pool.query(
        `UPDATE sessions SET answers=$1,current_question=$2,state='completed',completed_at=NOW() WHERE id=$3`,
        [JSON.stringify(answers),cur,id]
      );
      return res.json({done:true,result:calcScore(answers)});
    }
    
    await pool.query(
      `UPDATE sessions SET answers=$1,current_question=$2 WHERE id=$3`,
      [JSON.stringify(answers),cur,id]
    );
    
    // Next question
    const nextQ = Q[cur];
    res.json({
      question: {id:nextQ.id,dim:nextQ.dim,text:nextQ.txt,opts:OPS.slice()},
      progress:{current:cur+1,total:25}
    });
  } catch(e) {
    res.status(500).json({error:e.message});
  }
});

// ============================================
// Results Calculation
// ============================================

function calcScore(answers) {
  const scores = {O:0,C:0,E:0,A:0,N:0};
  const cnt = {O:0,C:0,E:0,A:0,N:0};
  
  (answers||[]).forEach(a=>{
    if (scores[a.d]!==undefined) {
      scores[a.d] = (scores[a.d]||0) + (a.s||0);
      cnt[a.d] = (cnt[a.d]||0) + 1;
    }
  });
  
  // Raw average (0-4) to percentage
  const pct = {};
  for (const k in cnt) {
    pct[k] = Math.round(((scores[k]||0)/(cnt[k]||1))/4*100);
  }
  
  // MBTI-style derivation
  let mbti = '';
  mbti += pct.E>=50?'E':'I';
  mbti += pct.O>=50?'N':'S';  // using O as intuitive
  mbti += pct.C>=50?'J':'P';
  mbti += pct.A>=50?'F':'T';
  
  const names = {
    O:'Creative',C:'Organized',E:'Energetic',A:'Warm',N:'Emotional'
  };
  const tops = Object.entries(pct).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>names[x[0]]).join(', ');
  
  return {
    mbti,
    scores:pct,
    summary:`Your strengths: ${tops}`,
    interpretation:`O:${pct.O}% C:${pct.C}% E:${pct.E}% A:${pct.A}% N:${pct.N}%`
  };
}

// ============================================
// Server
// ============================================

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`[INFO] Persona-Lab v2.1 on ${PORT}`));