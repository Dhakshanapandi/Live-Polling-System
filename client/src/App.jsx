// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";
import TeacherView from "./pages/TeacherView";
import StudentView from "./pages/StudentView";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleSelector />} />
        <Route path="/teacher" element={<TeacherView />} />
        <Route path="/student/:id" element={<StudentWrapper />} />
      </Routes>
    </BrowserRouter>
  );
}

function StudentWrapper() {
  const { id } = useParams();
  return <StudentView pollId={id} />;
}

function RoleSelector() {
  const navigate = useNavigate();
  const [pollId, setPollId] = React.useState("");

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-6">Intervue — Live Poll</h1>
        <div className="space-y-4">
          <button
            onClick={() => navigate("/teacher")}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
          >
            I'm a Teacher
          </button>

          <div className="flex gap-2 items-center">
            <input
              value={pollId}
              onChange={(e) => setPollId(e.target.value)}
              placeholder="Enter Poll ID"
              className="flex-1 border p-2 rounded"
            />
            <button
              onClick={() => pollId.trim() && navigate(`/student/${pollId.trim()}`)}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
