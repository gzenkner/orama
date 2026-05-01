import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { loadRemoteStateIntoStore } from "./app/loadRemoteState";
import { initializeRemoteStateSync } from "./app/remoteStateSync";
import "./styles.css";

function BootScreen() {
  return (
    <div className="app-shell h-full w-full" data-app-theme="white" aria-busy="true">
      <main className="app-boot-shell">
        <div className="app-boot-spinner" role="status" aria-label="Loading" />
      </main>
    </div>
  );
}

async function main() {
  const container = document.getElementById("root")!;
  const root = ReactDOM.createRoot(container);
  const renderBoot = () => {
    root.render(
      <React.StrictMode>
        <BootScreen />
      </React.StrictMode>
    );
  };

  renderBoot();

  try {
    await loadRemoteStateIntoStore(() => {
      renderBoot();
    });
  } catch (error) {
    console.warn("Could not load remote Orama state.", error);
    renderBoot();
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  initializeRemoteStateSync();
}

void main();
