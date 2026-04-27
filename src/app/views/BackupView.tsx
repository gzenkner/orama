import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { actions, useAppState } from "../store";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Textarea from "../ui/Textarea";

function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function buildBackupExport(state: unknown): string {
  const exportedAt = new Date().toISOString();
  const payload =
    state && typeof state === "object" && !Array.isArray(state)
      ? {
          ...(state as Record<string, unknown>),
          exportedAt,
          exportLabel: exportedAt.slice(0, 10)
        }
      : { state, exportedAt, exportLabel: exportedAt.slice(0, 10) };
  return JSON.stringify(payload, null, 2);
}

export default function BackupView() {
  const state = useAppState((s) => s);
  const [importRaw, setImportRaw] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [backupStatus, setBackupStatus] = React.useState<string | null>(null);
  const [backingUp, setBackingUp] = React.useState(false);
  const exportRaw = React.useMemo(() => buildBackupExport(state), [state]);

  return (
    <div className="grid gap-4">
      <Card className="app-card-soft rounded-[0.95rem] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="app-kicker">Backup</div>
            <div className="font-display mt-2 text-lg font-semibold">Export or restore your local data.</div>
            <div className="mt-2 text-sm leading-6 app-muted">Everything stays in local storage unless you manually copy it out.</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isTauriRuntime() ? (
              <Button
                variant="primary"
                disabled={backingUp}
                onClick={async () => {
                  setBackingUp(true);
                  setBackupStatus(null);
                  try {
                    const path = await invoke<string>("write_backup_to_desktop", { backupJson: buildBackupExport(state) });
                    setBackupStatus(`Backup written to ${path}.`);
                  } catch (e) {
                    setBackupStatus(e instanceof Error ? e.message : "Could not write the Desktop backup.");
                  } finally {
                    setBackingUp(false);
                  }
                }}
              >
                {backingUp ? "Backing up..." : "Backup to Desktop"}
              </Button>
            ) : null}
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(exportRaw);
              }}
            >
              Copy export
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const ok = confirm("Reset all data? This cannot be undone.");
                if (!ok) return;
                actions.resetAll();
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {backupStatus ? <div className="mt-3 text-sm app-muted">{backupStatus}</div> : null}
      </Card>

      <Card className="rounded-[0.85rem] p-5">
        <div className="app-kicker">Export</div>
        <div className="mt-3">
          <Textarea value={exportRaw} readOnly className="min-h-64 font-mono text-xs" />
        </div>
      </Card>

      <Card className="rounded-[0.85rem] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="app-kicker">Import</div>
            <div className="mt-2 text-sm leading-6 app-muted">Paste a previous JSON export to restore the workspace.</div>
          </div>

          <Button
            variant="primary"
            onClick={() => {
              setError(null);
              try {
                actions.importJSON(importRaw);
                setImportRaw("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Import failed.");
              }
            }}
            disabled={!importRaw.trim()}
          >
            Import
          </Button>
        </div>

        <div className="mt-3">
          <Textarea value={importRaw} onChange={(e) => setImportRaw(e.target.value)} placeholder="{ ... }" className="min-h-64 font-mono text-xs" />
        </div>

        {error ? <div className="mt-3 text-sm text-red-500">{error}</div> : null}
      </Card>
    </div>
  );
}
