// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // tailwind imports should be here

import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import pollReducer from "./pollSlice";

const store = configureStore({ reducer: { poll: pollReducer } });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
