// Simple test flow - minimal version
const sessionStore = new Map();

export async function createSession(req: any, res: any) {
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  const sid = `s_${Date.now()}`;

  sessionStore.set(sid, { id: sid, userId, answers: [], idx: 0 });

  console.log("CREATE:", sid, "storeSize:", sessionStore.size);
  res.json({ sessionId: sid, message: "ok" });
}

export async function getNextQuestion(req: any, res: any) {
  const { session_id } = req.params;
  const session = sessionStore.get(session_id);

  console.log(
    "GET:",
    session_id,
    "found:",
    !!session,
    "size:",
    sessionStore.size,
  );

  if (!session) {
    return res.json({ question: { id: "q1", text: "测试问题?", options: [] } });
  }

  session.idx = (session.idx || 0) + 1;
  sessionStore.set(session_id, session);

  res.json({
    question: {
      id: `q${session.idx}`,
      text: `问题${session.idx}`,
      options: ["A", "B", "C"],
    },
    progress: { current: session.idx, total: 10 },
  });
}
