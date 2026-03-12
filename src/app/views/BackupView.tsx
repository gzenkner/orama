import React from "react";
import { actions, useAppState } from "../store";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Textarea from "../ui/Textarea";

export default function BackupView() {
  const state = useAppState((s) => s);
  const [importRaw, setImportRaw] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const exportRaw = React.useMemo(() => JSON.stringify(state, null, 2), [state]);

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
