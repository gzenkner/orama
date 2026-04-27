import React from "react";
import type { Outcome, WeekStartsOn } from "../types";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { cn } from "../ui/cn";
import CoachView from "./CoachView";
import WizardView from "./WizardView";

type AssistantPane = "coach" | "milestones";

export default function PlanningAssistantView({ outcome, weekStartsOn }: { outcome: Outcome; weekStartsOn: WeekStartsOn }) {
  const [pane, setPane] = React.useState<AssistantPane>("coach");

  React.useEffect(() => {
    setPane("coach");
  }, [outcome.id]);

  return (
    <div className="grid gap-4">
      <Card className="app-card-soft rounded-[0.95rem] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="app-kicker">Planning Assistant</div>
            <div className="mt-2 text-lg font-semibold">Use one assistant for shaping the outcome and its monthly milestones.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={pane === "coach" ? "secondary" : "ghost"} size="sm" onClick={() => setPane("coach")}>
              Outcome chat
            </Button>
            <Button variant={pane === "milestones" ? "secondary" : "ghost"} size="sm" onClick={() => setPane("milestones")}>
              Monthly milestones
            </Button>
          </div>
        </div>
      </Card>

      <div className={cn("min-w-0", pane === "coach" ? "" : "overflow-hidden rounded-[1rem] border border-[color:var(--app-border)]")}>
        {pane === "coach" ? <CoachView outcome={outcome} /> : <WizardView outcome={outcome} weekStartsOn={weekStartsOn} />}
      </div>
    </div>
  );
}
