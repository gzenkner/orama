import Card from "../ui/Card";
import Button from "../ui/Button";

type TemplatePlaceholder = {
  title: string;
  horizon: string;
  prompt: string;
};

const TEMPLATE_PLACEHOLDERS: TemplatePlaceholder[] = [
  {
    title: "Buy house",
    horizon: "Medium",
    prompt: "Deposit, mortgage readiness, location shortlist, and move-in timing."
  },
  {
    title: "Retire early",
    horizon: "Long",
    prompt: "Financial independence number, savings rate, investments, and exit runway."
  },
  {
    title: "Buy car",
    horizon: "Short",
    prompt: "Budget, savings plan, insurance, running costs, and purchase date."
  },
  {
    title: "Invest",
    horizon: "Medium",
    prompt: "Emergency fund, account setup, contribution rhythm, and portfolio rules."
  },
  {
    title: "Education",
    horizon: "Medium",
    prompt: "Course choice, funding, weekly study rhythm, assignments, and completion date."
  },
  {
    title: "Emergency fund",
    horizon: "Short",
    prompt: "Target balance, monthly contribution, spending cuts, and cash location."
  },
  {
    title: "Start business",
    horizon: "Medium",
    prompt: "Problem, first offer, customer validation, launch plan, and revenue target."
  },
  {
    title: "Career switch",
    horizon: "Medium",
    prompt: "Target role, skill gaps, portfolio proof, applications, and interview rhythm."
  },
  {
    title: "Travel fund",
    horizon: "Short",
    prompt: "Destination, total budget, savings cadence, booking windows, and itinerary."
  },
  {
    title: "Get fit",
    horizon: "Short",
    prompt: "Training days, nutrition basics, progress metric, and recovery routine."
  }
];

export default function TemplatesView() {
  return (
    <div className="app-settings-view grid gap-4">
      <Card className="app-settings-hero app-card-soft rounded-[0.95rem] p-5">
        <div className="app-kicker">Templates</div>
        <div className="font-display mt-2 text-lg font-semibold">Start from a proven shape.</div>
        <div className="mt-2 max-w-3xl text-sm leading-6 app-muted">
          Placeholder goal templates for common outcomes. Each template will eventually prefill the outcome, schedule, and first planning prompts.
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATE_PLACEHOLDERS.map((template) => (
          <Card key={template.title} className="app-card-soft flex min-h-[10rem] flex-col justify-between rounded-[0.9rem] p-4">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-[1.15rem] font-semibold leading-tight text-[color:var(--app-text)]">{template.title}</div>
                  <div className="mt-2 text-sm leading-6 app-muted">{template.prompt}</div>
                </div>
                <span className="shrink-0 rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] app-subtle">
                  {template.horizon}
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] app-subtle">Placeholder</span>
              <Button variant="secondary" size="sm" className="h-8 rounded-[0.55rem] px-3 text-[12px]" disabled>
                Use soon
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
