const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const polls = new Map();

function createPoll({ title, questions }) {
  const id = nanoid(8);
  const poll = {
    id,
    title,
    questions: questions.map((q) => ({
      id: nanoid(6),
      text: q.text,
      options: q.options.map((o) => ({ id: nanoid(6), text: o })),
      timeLimitSec: q.timeLimitSec || 60,
    })),
    currentQuestionIndex: null,
    activeQuestion: null, // { questionIndex, answers, counts, endsAt, _timeout }
    students: {}, // sessionId -> { name, connected }
    lastResult: null,
  };
  polls.set(id, poll);
  return poll;
}

/* ---------------- REST endpoints ---------------- */

// create poll
app.post("/api/polls", (req, res) => {
  const { title, questions } = req.body;
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "invalid" });
  }
  const poll = createPoll({ title, questions });
  res.json(poll);
});

// get poll
app.get("/api/polls/:id", (req, res) => {
  const poll = polls.get(req.params.id);
  if (!poll) return res.status(404).json({ error: "not_found" });
  res.json(poll);
});

// add a new question dynamically
app.post("/api/polls/:id/questions", (req, res) => {
  const poll = polls.get(req.params.id);
  if (!poll) return res.status(404).json({ error: "poll_not_found" });

  const { text, options, timeLimitSec } = req.body;
  if (!text || !options?.length) return res.status(400).json({ error: "invalid" });

  const q = {
    id: nanoid(6),
    text,
    options: options.map((o) => ({ id: nanoid(6), text: o })),
    timeLimitSec: timeLimitSec || 60,
  };

  poll.questions.push(q);
  res.json(q);
});

/* ---------------- Socket.io ---------------- */

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  // teacher join
  socket.on("teacher:join", ({ pollId }, cb) => {
    const poll = polls.get(pollId);
    if (!poll) return cb && cb({ error: "poll_not_found" });
    socket.join(pollId);
    socket.data = { pollId, role: "teacher" };
    cb && cb({ ok: true, poll });
  });

  // student join
  socket.on("student:join", ({ pollId, name, sessionId }, cb) => {
    const poll = polls.get(pollId);
    if (!poll) return cb && cb({ error: "poll_not_found" });

    const sid = sessionId || nanoid();
    poll.students[sid] = { name, connected: true };

    socket.join(pollId);
    socket.data = { pollId, role: "student", sessionId: sid };

    cb &&
      cb({
        ok: true,
        sessionId: sid,
        poll,
        lastResult: poll.lastResult,
      });
    io.to(pollId).emit("poll:students", { students: poll.students });
  });

  // teacher start question
  socket.on("teacher:start", ({ pollId, questionIndex }, cb) => {
    const poll = polls.get(pollId);
    if (!poll) return cb && cb({ error: "poll_not_found" });
    if (poll.activeQuestion) return cb && cb({ error: "active_question_exists" });

    const question = poll.questions[questionIndex];
    if (!question) return cb && cb({ error: "question_not_found" });

    const startedAt = Date.now();
    const endsAt = startedAt + question.timeLimitSec * 1000;

    const active = {
      questionIndex,
      answers: {},
      counts: Object.fromEntries(question.options.map((o) => [o.id, 0])),
      endsAt,
    };

    poll.activeQuestion = active;
    poll.currentQuestionIndex = questionIndex;
    poll.lastResult = null;

    // end after timeout
    active._timeout = setTimeout(() => {
      endQuestion(pollId);
    }, question.timeLimitSec * 1000);

    io.to(pollId).emit("question:started", { question, endsAt });
    cb && cb({ ok: true });
  });

  // student answer
  socket.on("student:answer", ({ pollId, sessionId, optionId }, cb) => {
    const poll = polls.get(pollId);
    if (!poll) return cb && cb({ error: "poll_not_found" });
    const active = poll.activeQuestion;
    if (!active) return cb && cb({ error: "no_active_question" });

    if (active.answers[sessionId]) return cb && cb({ error: "already_answered" });
    if (!Object.prototype.hasOwnProperty.call(active.counts, optionId)) {
      return cb && cb({ error: "invalid_option" });
    }

    active.answers[sessionId] = optionId;
    active.counts[optionId] += 1;

    io.to(pollId).emit("question:update", {
      counts: active.counts,
      totalAnswers: Object.keys(active.answers).length,
    });

    // if all connected students answered, end early
    const totalActiveStudents = Object.values(poll.students).filter(
      (s) => s.connected
    ).length;

    if (Object.keys(active.answers).length >= totalActiveStudents) {
      if (active._timeout) {
        clearTimeout(active._timeout);
        delete active._timeout;
      }
      endQuestion(pollId);
    }

    cb && cb({ ok: true });
  });

  // teacher removes student
  socket.on("teacher:remove_student", ({ pollId, sessionId }, cb) => {
    const poll = polls.get(pollId);
    if (!poll || !poll.students[sessionId])
      return cb && cb({ error: "student_not_found" });
    delete poll.students[sessionId];
    io.to(pollId).emit("poll:students", { students: poll.students });
    cb && cb({ ok: true });
  });

  socket.on("disconnect", () => {
    const d = socket.data;
    if (d?.pollId && d.role === "student") {
      const poll = polls.get(d.pollId);
      if (poll?.students?.[d.sessionId]) {
        poll.students[d.sessionId].connected = false;
        io.to(d.pollId).emit("poll:students", { students: poll.students });
      }
    }
  });

  /* ---------------- helper ---------------- */
  function endQuestion(pollId) {
    const poll = polls.get(pollId);
    if (!poll || !poll.activeQuestion) return;

    const active = poll.activeQuestion;
    const question = poll.questions[active.questionIndex];

    const result = {
      questionIndex: active.questionIndex,
      counts: active.counts,
      totalAnswers: Object.keys(active.answers || {}).length,
      totalStudents: Object.keys(poll.students).length,
      question,
    };

    poll.lastResult = result;

    if (active._timeout) {
      clearTimeout(active._timeout);
      delete active._timeout;
    }

    poll.activeQuestion = null;

    io.to(pollId).emit("question:ended", { result });
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));

