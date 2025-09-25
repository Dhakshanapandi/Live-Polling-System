// src/pages/TeacherView.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { socket } from "../socket";
import { useDispatch, useSelector } from "react-redux";
import {
  setPoll,
  setActiveQuestion,
  setCounts,
  setStudents,
  setLastResult,
} from "../pollSlice";

export default function TeacherView() {
  const dispatch = useDispatch();
  const poll = useSelector((s) => s.poll.poll);
  const activeQuestion = useSelector((s) => s.poll.activeQuestion);
  const counts = useSelector((s) => s.poll.counts);
  const students = useSelector((s) => s.poll.students);
  const lastResult = useSelector((s) => s.poll.lastResult);

  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([{ text: "", options: ["", ""] }]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [newQ, setNewQ] = useState({ text: "", options: ["", ""] });
  const timerRef = useRef(null);

  useEffect(() => {
    socket.on("poll:students", ({ students }) =>
      dispatch(setStudents(students))
    );

    socket.on("question:started", ({ question, endsAt }) => {
      dispatch(setActiveQuestion(question));
      dispatch(setCounts({}));
      if (timerRef.current) clearInterval(timerRef.current);
      const tick = () => {
        const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        setTimeLeft(left);
        if (left <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
    });

    socket.on("question:update", ({ counts }) => dispatch(setCounts(counts)));

    socket.on("question:ended", ({ result }) => {
      dispatch(setActiveQuestion(null));
      dispatch(setCounts(result.counts));
      dispatch(setLastResult(result));
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(null);
    });

    return () => {
      socket.offAny();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dispatch]);

  async function createPoll() {
    const res = await axios.post(
      `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/polls`,
      { title, questions }
    );
    dispatch(setPoll(res.data));
    socket.connect();
    socket.emit("teacher:join", { pollId: res.data.id });
  }

  function startQuestion(idx) {
    socket.emit(
      "teacher:start",
      { pollId: poll.id, questionIndex: idx },
      (resp) => {
        if (resp?.error) alert(resp.error);
      }
    );
  }

  async function addNewQuestion() {
    if (!newQ.text.trim() || newQ.options.some((o) => !o.trim())) {
      alert("Fill all fields");
      return;
    }
    const res = await axios.post(
      `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/polls/${poll.id}/questions`,
      newQ
    );
    dispatch(
      setPoll({
        ...poll,
        questions: [...poll.questions, res.data],
      })
    );
    setNewQ({ text: "", options: ["", ""] });
  }

  if (!poll) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Create Poll</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 mb-3 w-full"
          placeholder="Poll title"
        />
        {questions.map((q, i) => (
          <div key={i} className="mb-3">
            <input
              value={q.text}
              onChange={(e) => {
                const copy = [...questions];
                copy[i].text = e.target.value;
                setQuestions(copy);
              }}
              className="border p-2 mb-2 w-full"
              placeholder="Question"
            />
            {q.options.map((o, j) => (
              <input
                key={j}
                value={o}
                onChange={(e) => {
                  const copy = [...questions];
                  copy[i].options[j] = e.target.value;
                  setQuestions(copy);
                }}
                className="border p-2 mb-1 w-full"
                placeholder={`Option ${j + 1}`}
              />
            ))}
            <button
              onClick={() => {
                const copy = [...questions];
                copy[i].options.push("");
                setQuestions(copy);
              }}
              className="bg-gray-200 px-2 py-1"
            >
              + Option
            </button>
          </div>
        ))}
        <button
          onClick={createPoll}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{poll.title}</h1>
      <p className="mb-4">Poll ID: {poll.id}</p>

      <h3 className="font-semibold">Students:</h3>
      <ul>
        {Object.values(students).map((s, i) => (
          <li key={i}>
            {s.name} {s.connected ? "🟢" : "🔴"}
          </li>
        ))}
      </ul>

      {timeLeft !== null && <p className="mt-4">⏱ {timeLeft}s left</p>}

      <h3 className="mt-6 mb-2 font-semibold">Questions</h3>
      {poll.questions.map((q, i) => (
        <div
          key={q.id}
          className="border p-3 my-2 flex justify-between items-center"
        >
          {q.text}
          <button
            disabled={!!activeQuestion}
            onClick={() => startQuestion(i)}
            className="bg-blue-500 text-white px-3 py-1 rounded disabled:bg-gray-300"
          >
            Start
          </button>
        </div>
      ))}

      {/* Add new question */}
      <div className="mt-6 border-t pt-4">
        <h3 className="font-semibold mb-2">Add New Question</h3>
        <input
          value={newQ.text}
          onChange={(e) => setNewQ({ ...newQ, text: e.target.value })}
          className="border p-2 w-full mb-2"
          placeholder="Question text"
        />
        {newQ.options.map((o, i) => (
          <input
            key={i}
            value={o}
            onChange={(e) => {
              const opts = [...newQ.options];
              opts[i] = e.target.value;
              setNewQ({ ...newQ, options: opts });
            }}
            className="border p-2 w-full mb-2"
            placeholder={`Option ${i + 1}`}
          />
        ))}
        <button
          onClick={() =>
            setNewQ({ ...newQ, options: [...newQ.options, ""] })
          }
          className="text-blue-600 text-sm mb-2"
        >
          + Add Option
        </button>
        <button
          onClick={addNewQuestion}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          Save Question
        </button>
      </div>

      {/* Results */}
      {lastResult && (
        <div className="mt-6">
          <h3 className="font-bold">Results</h3>
          {lastResult.question.options.map((o) => (
            <div key={o.id} className="flex justify-between py-1">
              <span>{o.text}</span>
              <span>{lastResult.counts[o.id] || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
