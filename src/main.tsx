import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { loadRemoteStateIntoStore } from "./app/loadRemoteState";
import "./styles.css";

async function main() {
  try {
    await loadRemoteStateIntoStore();
  } catch (error) {
    console.warn("Could not load remote Orama state.", error);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void main();
