import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { actions, useAppState } from "../store";
import { syncRemoteStateNow } from "../remoteStateSync";
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
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  async function applyImportedState(raw: string) {
    setError(null);
    setBackupStatus(null);

    try {
      actions.importJSON(raw);
      setImportRaw("");
      await syncRemoteStateNow();
      setBackupStatus("JSON imported and synced to Supabase.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    }
  }

  return (
    <div className="app-backup-view grid gap-4">
      <Card className="app-backup-hero app-card-soft rounded-[0.95rem] p-5">
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

      <Card className="app-backup-card rounded-[0.85rem] p-5">
        <div className="app-kicker">Export</div>
        <div className="mt-3">
          <Textarea value={exportRaw} readOnly className="app-backup-textarea min-h-64 font-mono text-xs" />
        </div>
      </Card>

      <Card className="app-backup-card rounded-[0.85rem] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="app-kicker">Import</div>
            <div className="mt-2 text-sm leading-6 app-muted">Upload or paste a previous JSON export to replace the workspace and sync it to Supabase.</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  const raw = await file.text();
                  await applyImportedState(raw);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not read the JSON file.");
                }
              }}
            />
            <Button onClick={() => fileInputRef.current?.click()}>Upload JSON</Button>
            <Button variant="primary" onClick={() => void applyImportedState(importRaw)} disabled={!importRaw.trim()}>
              Import
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <Textarea value={importRaw} onChange={(e) => setImportRaw(e.target.value)} placeholder="{ ... }" className="app-backup-textarea min-h-64 font-mono text-xs" />
        </div>

        {backupStatus ? <div className="mt-3 text-sm app-muted">{backupStatus}</div> : null}
        {error ? <div className="mt-3 text-sm text-red-500">{error}</div> : null}
      </Card>
    </div>
  );
}
