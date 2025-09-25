import { configureStore } from "@reduxjs/toolkit";
import pollReducer from "./pollSlice";

export default configureStore({
  reducer: { poll: pollReducer },
});
