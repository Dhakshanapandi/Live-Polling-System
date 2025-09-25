// src/pages/StudentView.jsx
import React, { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { useDispatch, useSelector } from "react-redux";
import { setPoll, setActiveQuestion, setCounts, setSessionId, setLastResult } from "../pollSlice";
import axios from "axios";
import { nanoid } from "nanoid";

export default function StudentView({ pollId }) {
  const dispatch = useDispatch();
  const poll = useSelector(s => s.poll.poll);
  const activeQuestion = useSelector(s => s.poll.activeQuestion);
  const counts = useSelector(s => s.poll.counts);
  const lastResult = useSelector(s => s.poll.lastResult);
  const [name, setName] = useState(sessionStorage.getItem(`poll_${pollId}_name`) || "");
  const [sessionId, setSid] = useState(sessionStorage.getItem(`poll_${pollId}_sessionId`) || null);
  const [answer, setAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/polls/${pollId}`);
        dispatch(setPoll(res.data));
      } catch (err) {
        console.error(err);
        alert("Poll not found");
      }
    }
    load();
  }, [pollId, dispatch]);

  useEffect(() => {
    socket.on("question:started", ({ question, endsAt }) => {
      dispatch(setActiveQuestion(question));
      dispatch(setCounts({}));
      setAnswer(null);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const tick = () => {
        const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        setTimeLeft(left);
        if (left <= 0 && timerRef.current) {
          clearInterval(timerRef.current); timerRef.current = null;
        }
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
    });

    socket.on("question:update", ({ counts }) => {
      dispatch(setCounts(counts));
    });

    socket.on("question:ended", ({ result }) => {
      dispatch(setActiveQuestion(null));
      dispatch(setCounts(result.counts));
      dispatch(setLastResult(result));
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTimeLeft(null);
      setAnswer(null); // clear answer to allow viewing results in a fresh state
    });

    return () => {
      socket.off("question:started");
      socket.off("question:update");
      socket.off("question:ended");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dispatch]);

  function joinPoll() {
    const sid = sessionId || nanoid();
    socket.connect();
    socket.emit("student:join", { pollId, name: name.trim(), sessionId: sid }, (resp) => {
      if (resp?.error) {
        alert(resp.error);
        return;
      }
      sessionStorage.setItem(`poll_${pollId}_sessionId`, resp.sessionId);
      sessionStorage.setItem(`poll_${pollId}_name`, name);
      setSid(resp.sessionId);
      dispatch(setSessionId(resp.sessionId));
      if (resp.lastResult) dispatch(setLastResult(resp.lastResult));
      if (resp.poll) dispatch(setPoll(resp.poll));
    });
  }

  function submitAnswer(optionId) {
    if (!sessionId) return alert("Join first");
    socket.emit("student:answer", { pollId, sessionId, optionId }, (resp) => {
      if (resp?.error) return alert(resp.error);
      setAnswer(optionId);
    });
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Join Poll</h2>
          <input className="w-full border p-2 mb-3 rounded" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          <button onClick={joinPoll} disabled={!name.trim()} className="w-full bg-green-600 text-white py-2 rounded">Join</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow p-6 w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-3">{poll?.title || "Poll"}</h2>
        {!activeQuestion && !lastResult && <div className="p-4 bg-gray-50 border rounded text-center text-gray-600">Waiting for teacher to start a question...</div>}

        {activeQuestion && (
          <div className="p-4 bg-gray-50 border rounded">
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold">{activeQuestion.text}</div>
              <div className="text-sm text-gray-600">⏱ {timeLeft ?? "-" }s</div>
            </div>

            <div className="space-y-2">
              {activeQuestion.options.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => submitAnswer(opt.id)}
                  disabled={!!answer}
                  className={`w-full text-left p-3 border rounded ${answer === opt.id ? "bg-blue-100 border-blue-400" : "bg-white"}`}
                >
                  <div className="flex justify-between">
                    <div>{opt.text}</div>
                    <div className="text-gray-600">{counts?.[opt.id] ?? 0}</div>
                  </div>
                </button>
              ))}
            </div>

            {answer && <div className="mt-3 text-green-600">Answer submitted — waiting for results...</div>}
          </div>
        )}

        {!activeQuestion && lastResult && (
          <div className="mt-4 p-4 border rounded bg-gray-50">
            <h3 className="font-semibold mb-2">Results</h3>
            {lastResult.question.options.map(opt => (
              <div key={opt.id} className="flex justify-between py-1">
                <span>{opt.text}</span>
                <span className="font-semibold">{lastResult.counts[opt.id] ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
