// src/pollSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initial = {
  poll: null,
  activeQuestion: null,
  counts: {},
  students: {},
  sessionId: null,
  lastResult: null,
};

const slice = createSlice({
  name: "poll",
  initialState: initial,
  reducers: {
    setPoll(state, action) { state.poll = action.payload; },
    setActiveQuestion(state, action) { state.activeQuestion = action.payload; },
    setCounts(state, action) { state.counts = action.payload; },
    setStudents(state, action) { state.students = action.payload; },
    setSessionId(state, action) { state.sessionId = action.payload; },
    setLastResult(state, action) { state.lastResult = action.payload; },
    reset(state) { Object.assign(state, initial); }
  }
});

export const {
  setPoll, setActiveQuestion, setCounts, setStudents, setSessionId, setLastResult, reset
} = slice.actions;
export default slice.reducer;
