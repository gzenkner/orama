#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;

const DEFAULT_PLANNING_MODEL: &str = "gemma3:12b";
const OLLAMA_WARMUP_PROMPT: &str = "Planning assistant warmup. Reply only with READY.";
static WARMUP_IN_FLIGHT: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
static CANCELED_COACH_REQUESTS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WarmupResponse {
  model: String,
  status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelListResponse {
  models: Vec<String>,
  default_model: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MonthlyWizardRequest {
  model: String,
  context: String,
  months: Vec<WizardTarget>,
  extra_context: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutcomeCoachRequest {
  request_id: String,
  model: String,
  outcome: OutcomeCoachTarget,
  current_draft: Option<String>,
  messages: Vec<OutcomeCoachTurnMessage>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutcomeCoachTarget {
  title: String,
  notes: String,
  start_date: String,
  end_date: String,
  days_of_week: Vec<u8>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutcomeCoachTurnMessage {
  role: String,
  content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OutcomeCoachResponse {
  model: String,
  reply: String,
  draft_description: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutcomeCoachPayload {
  reply: String,
  draft_description: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MonthlyWizardMilestone {
  id: String,
  title: String,
  rationale: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MonthlyWizardResponse {
  model: String,
  summary: String,
  milestones: Vec<MonthlyWizardMilestone>,
  log_path: Option<String>,
  log_warning: Option<String>,
}

#[derive(Deserialize)]
struct MonthlyWizardMilestonePayload {
  id: String,
  title: Option<String>,
  rationale: Option<String>,
}

#[derive(Deserialize)]
struct MonthlyWizardPayload {
  summary: String,
  milestones: Vec<MonthlyWizardMilestonePayload>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WizardLogResponse {
  path: Option<String>,
  status: String,
  warning: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WizardPromptRequest {
  model: String,
  mode: String,
  scope_label: String,
  context: String,
  targets: Vec<WizardTarget>,
  answers: Option<Vec<WizardAnswer>>,
  extra_context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WizardTarget {
  id: String,
  label: String,
  current_value: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WizardAnswer {
  question: String,
  answer: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WizardQuestionResponse {
  model: String,
  guidance: String,
  questions: Vec<String>,
}

#[derive(Deserialize)]
struct WizardQuestionPayload {
  guidance: String,
  questions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WizardPlanItem {
  id: String,
  title: Option<String>,
  items: Option<Vec<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WizardPlanResponse {
  model: String,
  summary: String,
  assumptions: Vec<String>,
  items: Vec<WizardPlanItem>,
}

#[derive(Deserialize)]
struct WizardPlanPayload {
  summary: String,
  assumptions: Vec<String>,
  items: Vec<WizardPlanItem>,
}

#[derive(Serialize)]
struct OllamaChatRequest<'a> {
  model: &'a str,
  stream: bool,
  keep_alive: &'a str,
  format: Value,
  options: Value,
  messages: Vec<OllamaMessage<'a>>,
}

#[derive(Serialize)]
struct OllamaMessage<'a> {
  role: &'a str,
  content: String,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
  model: String,
  message: OllamaChatMessage,
}

#[derive(Deserialize)]
struct OllamaChatMessage {
  content: String,
}

fn ollama_api_chat_url() -> String {
  let host = std::env::var("OLLAMA_HOST").unwrap_or_else(|_| "http://127.0.0.1:11434".to_string());
  format!("{}/api/chat", host.trim_end_matches('/'))
}

fn warmup_models() -> &'static Mutex<HashSet<String>> {
  WARMUP_IN_FLIGHT.get_or_init(|| Mutex::new(HashSet::new()))
}

fn canceled_coach_requests() -> &'static Mutex<HashSet<String>> {
  CANCELED_COACH_REQUESTS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn configured_model(model: &str) -> Result<&str, String> {
  let trimmed = model.trim();
  if trimmed.is_empty() {
    return Err("No Ollama model was selected.".to_string());
  }
  Ok(trimmed)
}

fn mode_description(mode: &str) -> Result<&'static str, String> {
  match mode {
    "outcome_to_month" => Ok("Break a full outcome into one strong focus for each month."),
    "month_to_week" => Ok("Break one month into a set of focused weeks."),
    "week_to_day" => Ok("Break one week into realistic daily commitments."),
    "day_to_task" => Ok("Break one day into a short task list that can actually be finished."),
    _ => Err(format!("Unsupported wizard mode: {mode}")),
  }
}

fn default_guidance(mode: &str) -> &'static str {
  match mode {
    "outcome_to_month" => "Answer briefly and the wizard will turn the outcome into month-sized focuses.",
    "month_to_week" => "Answer briefly and the wizard will split the month into weekly pushes.",
    "week_to_day" => "Answer briefly and the wizard will spread the weekly focus across active days.",
    "day_to_task" => "Answer briefly and the wizard will turn the day into an actionable task list.",
    _ => "Answer briefly and concretely.",
  }
}

fn question_schema() -> Value {
  json!({
    "type": "object",
    "additionalProperties": false,
    "required": ["guidance", "questions"],
    "properties": {
      "guidance": { "type": "string" },
      "questions": {
        "type": "array",
        "minItems": 2,
        "maxItems": 3,
        "items": { "type": "string" }
      }
    }
  })
}

fn plan_schema() -> Value {
  json!({
    "type": "object",
    "additionalProperties": false,
    "required": ["summary", "assumptions", "items"],
    "properties": {
      "summary": { "type": "string" },
      "assumptions": {
        "type": "array",
        "items": { "type": "string" }
      },
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["id"],
          "properties": {
            "id": { "type": "string" },
            "title": { "type": "string" },
            "items": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        }
      }
    }
  })
}

fn monthly_plan_schema() -> Value {
  json!({
    "type": "object",
    "additionalProperties": false,
    "required": ["summary", "milestones"],
    "properties": {
      "summary": { "type": "string" },
      "milestones": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["id", "title", "rationale"],
          "properties": {
            "id": { "type": "string" },
            "title": { "type": "string" },
            "rationale": { "type": "string" }
          }
        }
      }
    }
  })
}

fn outcome_coach_schema() -> Value {
  json!({
    "type": "object",
    "additionalProperties": false,
    "required": ["reply", "draftDescription"],
    "properties": {
      "reply": { "type": "string" },
      "draftDescription": { "type": "string" }
    }
  })
}

fn question_system_prompt(mode: &str) -> Result<String, String> {
  Ok(format!(
    concat!(
      "You are Orama's planning wizard.\n",
      "{}\n",
      "Ask only the highest-value clarifying questions.\n",
      "Keep questions short, practical, and non-overlapping.\n",
      "Do not ask for information already present in the context.\n",
      "Return valid JSON only."
    ),
    mode_description(mode)?
  ))
}

fn plan_system_prompt(mode: &str) -> Result<String, String> {
  let output_rules = match mode {
    "outcome_to_month" => "Return one concise monthly focus per target month. Each title should feel like the most important push for that month.",
    "month_to_week" => "Return one concise weekly focus per target week. Keep each week distinct and sequenced.",
    "week_to_day" => "Return one realistic day focus per target day. Make each day concrete enough to execute.",
    "day_to_task" => {
      "Return 3 to 6 tasks for the single day target. Each task should start with a verb and stay concise."
    }
    _ => return Err(format!("Unsupported wizard mode: {mode}")),
  };

  Ok(format!(
    concat!(
      "You are Orama's planning wizard.\n",
      "{}\n",
      "{}\n",
      "Respect the provided targets exactly and keep their IDs unchanged.\n",
      "Use direct, action-oriented wording.\n",
      "Avoid filler, fluff, and generic productivity language.\n",
      "Return valid JSON only."
    ),
    mode_description(mode)?,
    output_rules
  ))
}

fn monthly_plan_system_prompt() -> String {
  concat!(
    "You are Orama's monthly milestone planner.\n",
    "Break one outcome into one strong milestone for each target month.\n",
    "Sequence the milestones so earlier months set up later months and the final month points at the finish line.\n",
    "Keep milestone titles short, concrete, and distinct.\n",
    "Avoid vague filler like 'make progress', 'stay consistent', or 'maintain momentum' unless the milestone names the real work.\n",
    "Respect the provided month IDs exactly and keep their order.\n",
    "Return valid JSON only."
  )
  .to_string()
}

fn outcome_coach_system_prompt() -> String {
  concat!(
    "You are Orama's outcome coach.\n",
    "Talk like a direct teammate in a real chat.\n",
    "Use short sentences.\n",
    "Keep replies concise.\n",
    "Do not flatter the user.\n",
    "Do not hype them up.\n",
    "Do not say things like wow, amazing, or great experience.\n",
    "Do not use bullets in the chat unless the user asks for them.\n",
    "Do not sound like a framework or a questionnaire.\n",
    "Ask one focused follow-up at a time when needed.\n",
    "Do not rush to summarize after one or two answers.\n",
    "Do not ask 'does that feel right' too early.\n",
    "Keep guiding until you have enough detail to build a useful planning brief.\n",
    "Adapt immediately when the user asks for simpler, shorter, or more direct language.\n",
    "Read short or fragmentary answers in context.\n",
    "If the user says things like 'location wise', 'comp wise', or 'team wise', treat that as a constraint on the previous point, not as a brand new topic.\n",
    "If the user's meaning is directionally clear, make the reasonable interpretation and move forward.\n",
    "Do not get stuck on pedantic clarifications.\n",
    "Say the interpretation plainly, then ask the next useful question.\n",
    "Your job is not just to polish one sentence.\n",
    "Your job is to help the user turn an outcome into a comprehensive goal brief they can later break into months, weeks, and days.\n",
    "Pull out the finish line, why it matters, constraints, non-negotiables, strengths to lean on, gaps to close, proof to build, and the main goals that need to happen before the deadline.\n",
    "When the user is talking about a career move, role search, or project, help define the actual goals and proof needed to land it.\n",
    "For career outcomes, usually cover the target role, location or time-zone limits, compensation, company or work preferences, strengths to lean on, gaps to close, proof to build, and the search or interview goals.\n",
    "Once role and location are roughly clear, move quickly into proof, gaps, and the major goals needed to land the role.\n",
    "Example: if the user says 'I want a remote data engineer role, location wise' and then 'UTC +/- 2 hours', interpret that as a remote role with working-hours overlap close to UTC and move on.\n",
    "Maintain a working draft that gets richer as the conversation gets richer.\n",
    "The draftDescription should be something the user can save as the outcome description and later use for planning.\n",
    "The draftDescription should be more than a slogan. It should read like a practical goal brief.\n",
    "Use short labeled sections in the draftDescription when helpful.\n",
    "Return valid JSON only."
  )
  .to_string()
}

fn build_user_prompt(request: &WizardPromptRequest) -> Result<String, String> {
  let targets_json = serde_json::to_string_pretty(&request.targets).map_err(|err| format!("Could not serialize targets: {err}"))?;

  let answers = request
    .answers
    .as_ref()
    .map(|items| {
      items
        .iter()
        .filter(|item| !item.answer.trim().is_empty())
        .map(|item| format!("- {} => {}", item.question.trim(), item.answer.trim()))
        .collect::<Vec<_>>()
    })
    .unwrap_or_default();

  let extra_context = request.extra_context.as_deref().unwrap_or("").trim();

  let mut sections = vec![
    format!("Mode: {}", request.mode),
    format!("Scope label: {}", request.scope_label),
    "Planning context:".to_string(),
    request.context.trim().to_string(),
    "Targets:".to_string(),
    targets_json,
  ];

  if !answers.is_empty() {
    sections.push("Question answers:".to_string());
    sections.push(answers.join("\n"));
  }

  if !extra_context.is_empty() {
    sections.push("Extra context:".to_string());
    sections.push(extra_context.to_string());
  }

  Ok(sections.join("\n\n"))
}

fn build_monthly_user_prompt(request: &MonthlyWizardRequest) -> Result<String, String> {
  let targets_json =
    serde_json::to_string_pretty(&request.months).map_err(|err| format!("Could not serialize monthly targets: {err}"))?;

  let extra_context = request.extra_context.as_deref().unwrap_or("").trim();
  let mut sections = vec![
    "Planning context:".to_string(),
    request.context.trim().to_string(),
    "Target months:".to_string(),
    targets_json,
  ];

  if !extra_context.is_empty() {
    sections.push("Extra guidance:".to_string());
    sections.push(extra_context.to_string());
  }

  Ok(sections.join("\n\n"))
}

fn build_outcome_coach_prompt(request: &OutcomeCoachRequest) -> String {
  let transcript = request
    .messages
    .iter()
    .map(|message| {
      let speaker = if message.role.trim() == "assistant" { "Assistant" } else { "User" };
      format!("{speaker}: {}", message.content.trim())
    })
    .collect::<Vec<_>>()
    .join("\n\n");

  let mut sections = vec![
    "Outcome".to_string(),
    format!("Title: {}", request.outcome.title.trim()),
    format!(
      "Date range: {} - {}",
      request.outcome.start_date.trim(),
      request.outcome.end_date.trim()
    ),
    format!(
      "Active days: {}",
      request
        .outcome
        .days_of_week
        .iter()
        .map(|day| day.to_string())
        .collect::<Vec<_>>()
        .join(", ")
    ),
  ];

  if !request.outcome.notes.trim().is_empty() {
    sections.push(format!("Saved description:\n{}", request.outcome.notes.trim()));
  }

  if let Some(current_draft) = request.current_draft.as_deref() {
    if !current_draft.trim().is_empty() {
      sections.push(format!("Current working draft:\n{}", current_draft.trim()));
    }
  }

  sections.push("Interpretation notes".to_string());
  sections.push("User replies may be short fragments that modify the previous point.".to_string());
  sections.push("Prefer a reasonable interpretation over a pedantic clarification when the user's direction is clear.".to_string());
  sections.push("Conversation".to_string());
  sections.push(transcript);
  sections.join("\n\n")
}

fn extract_json_block(content: &str) -> Result<String, String> {
  let trimmed = content.trim();
  if serde_json::from_str::<Value>(trimmed).is_ok() {
    return Ok(trimmed.to_string());
  }

  for (open, close) in [('{', '}'), ('[', ']')] {
    if let Some(start) = trimmed.find(open) {
      let mut depth = 0usize;
      for (offset, ch) in trimmed[start..].char_indices() {
        if ch == open {
          depth += 1;
        } else if ch == close {
          depth = depth.saturating_sub(1);
          if depth == 0 {
            let candidate = &trimmed[start..start + offset + ch.len_utf8()];
            if serde_json::from_str::<Value>(candidate).is_ok() {
              return Ok(candidate.to_string());
            }
            break;
          }
        }
      }
    }
  }

  Err("The Ollama response was not valid JSON.".to_string())
}

fn start_warmup_if_needed(model: &str) -> bool {
  let model = model.to_string();
  let mut in_flight = warmup_models().lock().expect("warmup model set poisoned");
  if !in_flight.insert(model.clone()) {
    return false;
  }
  drop(in_flight);

  std::thread::spawn(move || {
    let _ = Command::new("ollama")
      .args(["run", &model, OLLAMA_WARMUP_PROMPT])
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .status();

    if let Ok(mut in_flight) = warmup_models().lock() {
      in_flight.remove(&model);
    }
  });

  true
}

fn mark_coach_request_canceled(request_id: &str) {
  if let Ok(mut canceled) = canceled_coach_requests().lock() {
    canceled.insert(request_id.to_string());
  }
}

fn take_canceled_coach_request(request_id: &str) -> bool {
  canceled_coach_requests()
    .lock()
    .map(|mut canceled| canceled.remove(request_id))
    .unwrap_or(false)
}

fn ollama_installed() -> bool {
  Command::new("ollama")
    .arg("--version")
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .status()
    .map(|status| status.success())
    .unwrap_or(false)
}

fn call_ollama_chat(
  model: &str,
  system_prompt: String,
  user_prompt: String,
  schema: Value,
  temperature: f32,
  cancel_request_id: Option<&str>,
) -> Result<(String, String), String> {
  let request = OllamaChatRequest {
    model,
    stream: false,
    keep_alive: "1h",
    format: schema,
    options: json!({
      "temperature": temperature
    }),
    messages: vec![
      OllamaMessage {
        role: "system",
        content: system_prompt,
      },
      OllamaMessage {
        role: "user",
        content: user_prompt,
      },
    ],
  };

  let body = serde_json::to_string(&request).map_err(|err| format!("Could not serialize Ollama request: {err}"))?;
  let mut last_error = String::new();

  for attempt in 0..10 {
    if let Some(request_id) = cancel_request_id {
      if take_canceled_coach_request(request_id) {
        return Err("Stopped.".to_string());
      }
    }

    match post_ollama_json(&body, cancel_request_id) {
      Ok(raw) => {
        let parsed: OllamaChatResponse =
          serde_json::from_str(&raw).map_err(|err| format!("Could not parse Ollama response: {err}"))?;
        let json_block = extract_json_block(&parsed.message.content)?;
        return Ok((parsed.model, json_block));
      }
      Err(err) => {
        last_error = err;
        if attempt == 0 && ollama_installed() {
          let _ = start_warmup_if_needed(model);
        }
        std::thread::sleep(Duration::from_secs(2));
      }
    }
  }

  Err(format!("Could not reach the local Ollama API after repeated retries. {last_error}"))
}

fn post_ollama_json(body: &str, cancel_request_id: Option<&str>) -> Result<String, String> {
  let url = ollama_api_chat_url();
  let mut child = Command::new("curl")
    .args([
      "-sS",
      "-f",
      "--connect-timeout",
      "5",
      "--max-time",
      "240",
      "-H",
      "Content-Type: application/json",
      &url,
      "--data-binary",
      "@-",
    ])
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|err| format!("Could not start curl for the Ollama request: {err}"))?;

  if let Some(stdin) = child.stdin.as_mut() {
    stdin
      .write_all(body.as_bytes())
      .map_err(|err| format!("Could not send the Ollama request body: {err}"))?;
  }

  loop {
    if let Some(request_id) = cancel_request_id {
      if take_canceled_coach_request(request_id) {
        let _ = child.kill();
        let _ = child.wait();
        return Err("Stopped.".to_string());
      }
    }

    match child.try_wait() {
      Ok(Some(_)) => break,
      Ok(None) => std::thread::sleep(Duration::from_millis(100)),
      Err(err) => return Err(format!("Could not wait for the Ollama response: {err}")),
    }
  }

  let output = child
    .wait_with_output()
    .map_err(|err| format!("Could not wait for the Ollama response: {err}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    return Err(if stderr.is_empty() {
      format!("curl exited with {}", output.status)
    } else {
      stderr
    });
  }

  String::from_utf8(output.stdout).map_err(|err| format!("The Ollama response was not UTF-8: {err}"))
}

fn normalize_questions(payload: WizardQuestionPayload, mode: &str) -> Result<WizardQuestionPayload, String> {
  let questions = payload
    .questions
    .into_iter()
    .map(|question| question.trim().to_string())
    .filter(|question| !question.is_empty())
    .take(3)
    .collect::<Vec<_>>();

  if questions.len() < 2 {
    return Err("The model did not return enough clarifying questions.".to_string());
  }

  let guidance = if payload.guidance.trim().is_empty() {
    default_guidance(mode).to_string()
  } else {
    payload.guidance.trim().to_string()
  };

  Ok(WizardQuestionPayload { guidance, questions })
}

fn normalize_plan_items(mut payload: WizardPlanPayload, request: &WizardPromptRequest) -> WizardPlanPayload {
  let order = request
    .targets
    .iter()
    .enumerate()
    .map(|(index, target)| (target.id.as_str(), index))
    .collect::<HashMap<_, _>>();

  payload.summary = payload.summary.trim().to_string();
  payload.assumptions = payload
    .assumptions
    .into_iter()
    .map(|assumption| assumption.trim().to_string())
    .filter(|assumption| !assumption.is_empty())
    .collect();

  let mut items = payload
    .items
    .into_iter()
    .filter_map(|mut item| {
      if !order.contains_key(item.id.as_str()) {
        return None;
      }

      item.title = item
        .title
        .take()
        .map(|title| title.trim().to_string())
        .filter(|title| !title.is_empty());

      item.items = item.items.take().map(|items| {
        items
          .into_iter()
          .map(|entry| entry.trim().to_string())
          .filter(|entry| !entry.is_empty())
          .collect::<Vec<_>>()
      });

      if request.mode == "day_to_task" && item.items.as_ref().map_or(true, |items| items.is_empty()) {
        if let Some(title) = item.title.take() {
          item.items = Some(vec![title]);
        }
      }

      if item.title.is_none() && item.items.as_ref().map_or(true, |items| items.is_empty()) {
        return None;
      }

      Some(item)
    })
    .collect::<Vec<_>>();

  items.sort_by_key(|item| order.get(item.id.as_str()).copied().unwrap_or(usize::MAX));
  payload.items = items;
  payload
}

fn normalize_monthly_payload(payload: MonthlyWizardPayload, request: &MonthlyWizardRequest) -> Vec<MonthlyWizardMilestone> {
  let order = request
    .months
    .iter()
    .enumerate()
    .map(|(index, target)| (target.id.as_str(), index))
    .collect::<HashMap<_, _>>();

  let mut items = payload
    .milestones
    .into_iter()
    .filter_map(|item| {
      if !order.contains_key(item.id.as_str()) {
        return None;
      }

      let title = item.title.unwrap_or_default().trim().to_string();
      if title.is_empty() {
        return None;
      }

      let rationale = item.rationale.unwrap_or_default().trim().to_string();
      Some(MonthlyWizardMilestone {
        id: item.id,
        title,
        rationale,
      })
    })
    .collect::<Vec<_>>();

  items.sort_by_key(|item| order.get(item.id.as_str()).copied().unwrap_or(usize::MAX));
  items
}

fn unix_timestamp() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs()
}

fn append_wizard_log_entry<R: tauri::Runtime>(app: &tauri::AppHandle<R>, kind: &str, content: &str) -> Result<String, String> {
  let log_dir = app
    .path()
    .app_log_dir()
    .map_err(|err| format!("Could not resolve the Orama log directory: {err}"))?;

  fs::create_dir_all(&log_dir).map_err(|err| format!("Could not create the Orama log directory: {err}"))?;

  let path = log_dir.join("monthly-wizard.log");
  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&path)
    .map_err(|err| format!("Could not open the monthly wizard log file: {err}"))?;

  writeln!(
    file,
    "[ts_unix={} kind={}]\n{}\n",
    unix_timestamp(),
    kind.trim(),
    content.trim()
  )
  .map_err(|err| format!("Could not write to the monthly wizard log file: {err}"))?;

  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn list_ollama_models() -> Result<ModelListResponse, String> {
  if !ollama_installed() {
    return Err("`ollama` is not available on this machine, so the wizard cannot inspect local models.".to_string());
  }

  let output = Command::new("ollama")
    .arg("list")
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .output()
    .map_err(|err| format!("Could not run `ollama list`: {err}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    return Err(if stderr.is_empty() {
      format!("`ollama list` exited with {}", output.status)
    } else {
      stderr
    });
  }

  let stdout = String::from_utf8(output.stdout).map_err(|err| format!("`ollama list` returned non UTF-8 output: {err}"))?;
  let models = stdout
    .lines()
    .skip(1)
    .filter_map(|line| {
      let trimmed = line.trim();
      if trimmed.is_empty() {
        return None;
      }
      trimmed
        .split_whitespace()
        .next()
        .filter(|name| *name != "NAME")
        .map(|name| name.to_string())
    })
    .collect::<Vec<_>>();

  if models.is_empty() {
    return Err("`ollama list` completed, but it did not return any installed models.".to_string());
  }

  let default_model = if models.iter().any(|model| model == DEFAULT_PLANNING_MODEL) {
    DEFAULT_PLANNING_MODEL.to_string()
  } else {
    models[0].clone()
  };

  Ok(ModelListResponse { models, default_model })
}

#[tauri::command]
fn warm_planning_model(model: String) -> Result<WarmupResponse, String> {
  if !ollama_installed() {
    return Err("`ollama` is not available on this machine, so the wizard cannot start the planning model.".to_string());
  }

  let model = configured_model(&model)?;
  let started = start_warmup_if_needed(model);

  Ok(WarmupResponse {
    model: model.to_string(),
    status: if started { "starting" } else { "alreadyRunning" }.to_string(),
  })
}

#[tauri::command]
fn wizard_monthly_plan(app: tauri::AppHandle, request: MonthlyWizardRequest) -> Result<MonthlyWizardResponse, String> {
  if request.months.is_empty() {
    return Err("There are no target months for the selected outcome.".to_string());
  }

  let model = configured_model(&request.model)?;
  let user_prompt = build_monthly_user_prompt(&request)?;
  let (model, raw_payload) = call_ollama_chat(model, monthly_plan_system_prompt(), user_prompt, monthly_plan_schema(), 0.2, None)?;
  let payload: MonthlyWizardPayload =
    serde_json::from_str(&raw_payload).map_err(|err| format!("Could not parse the monthly planning payload: {err}"))?;
  let summary = payload.summary.trim().to_string();
  let milestones = normalize_monthly_payload(payload, &request);

  if milestones.is_empty() {
    return Err("The model responded, but it did not return any usable monthly milestones.".to_string());
  }

  let log_body = format!(
    concat!(
      "model: {}\n",
      "summary: {}\n\n",
      "context:\n{}\n\n",
      "extra guidance:\n{}\n\n",
      "milestones:\n{}"
    ),
    model,
    if summary.is_empty() {
      "The wizard generated a new monthly planning pass."
    } else {
      summary.as_str()
    },
    request.context.trim(),
    request.extra_context.as_deref().unwrap_or("").trim(),
    milestones
      .iter()
      .map(|item| {
        if item.rationale.is_empty() {
          format!("- {}: {}", item.id, item.title)
        } else {
          format!("- {}: {} | {}", item.id, item.title, item.rationale)
        }
      })
      .collect::<Vec<_>>()
      .join("\n")
  );

  let (log_path, log_warning) = match append_wizard_log_entry(&app, "monthly_generate", &log_body) {
    Ok(path) => (Some(path), None),
    Err(err) => (None, Some(err)),
  };

  Ok(MonthlyWizardResponse {
    model,
    summary: if summary.is_empty() {
      "The wizard generated a new monthly planning pass.".to_string()
    } else {
      summary
    },
    milestones,
    log_path,
    log_warning,
  })
}

#[tauri::command]
fn append_wizard_log(app: tauri::AppHandle, kind: String, content: String) -> Result<WizardLogResponse, String> {
  if kind.trim().is_empty() {
    return Err("The log entry kind cannot be empty.".to_string());
  }
  if content.trim().is_empty() {
    return Err("The log entry content cannot be empty.".to_string());
  }

  match append_wizard_log_entry(&app, &kind, &content) {
    Ok(path) => Ok(WizardLogResponse {
      path: Some(path),
      status: "written".to_string(),
      warning: None,
    }),
    Err(err) => Ok(WizardLogResponse {
      path: None,
      status: "notWritten".to_string(),
      warning: Some(err),
    }),
  }
}

#[tauri::command]
fn wizard_questions(request: WizardPromptRequest) -> Result<WizardQuestionResponse, String> {
  if request.targets.is_empty() {
    return Err("There are no targets to populate for the selected wizard scope.".to_string());
  }

  let model = configured_model(&request.model)?;
  let user_prompt = build_user_prompt(&request)?;
  let (model, raw_payload) = call_ollama_chat(model, question_system_prompt(&request.mode)?, user_prompt, question_schema(), 0.2, None)?;
  let payload: WizardQuestionPayload =
    serde_json::from_str(&raw_payload).map_err(|err| format!("Could not parse the question payload: {err}"))?;
  let payload = normalize_questions(payload, &request.mode)?;

  Ok(WizardQuestionResponse {
    model,
    guidance: payload.guidance,
    questions: payload.questions,
  })
}

#[tauri::command]
fn wizard_plan(request: WizardPromptRequest) -> Result<WizardPlanResponse, String> {
  if request.targets.is_empty() {
    return Err("There are no targets to populate for the selected wizard scope.".to_string());
  }

  let model = configured_model(&request.model)?;
  let user_prompt = build_user_prompt(&request)?;
  let (model, raw_payload) = call_ollama_chat(model, plan_system_prompt(&request.mode)?, user_prompt, plan_schema(), 0.35, None)?;
  let payload: WizardPlanPayload =
    serde_json::from_str(&raw_payload).map_err(|err| format!("Could not parse the planning payload: {err}"))?;
  let payload = normalize_plan_items(payload, &request);

  if payload.items.is_empty() {
    return Err("The model responded, but it did not return any usable planning items.".to_string());
  }

  Ok(WizardPlanResponse {
    model,
    summary: if payload.summary.is_empty() {
      "The wizard generated a new planning pass.".to_string()
    } else {
      payload.summary
    },
    assumptions: payload.assumptions,
    items: payload.items,
  })
}

#[tauri::command]
fn coach_outcome_chat(request: OutcomeCoachRequest) -> Result<OutcomeCoachResponse, String> {
  if request.messages.is_empty() {
    return Err("There is no conversation history for this coach turn.".to_string());
  }

  let model = configured_model(&request.model)?;
  let user_prompt = build_outcome_coach_prompt(&request);
  let (model, raw_payload) = call_ollama_chat(
    model,
    outcome_coach_system_prompt(),
    user_prompt,
    outcome_coach_schema(),
    0.35,
    Some(request.request_id.as_str()),
  )?;
  let payload: OutcomeCoachPayload =
    serde_json::from_str(&raw_payload).map_err(|err| format!("Could not parse the coach payload: {err}"))?;

  let reply = payload.reply.trim().to_string();
  if reply.is_empty() {
    return Err("The model responded, but it did not return a usable reply.".to_string());
  }

  let draft_description = payload.draft_description.trim().to_string();
  if draft_description.is_empty() {
    return Err("The model responded, but it did not return a usable outcome description.".to_string());
  }

  Ok(OutcomeCoachResponse {
    model,
    reply,
    draft_description,
  })
}

#[tauri::command]
fn cancel_coach_outcome_chat(request_id: String) -> Result<String, String> {
  let trimmed = request_id.trim();
  if trimmed.is_empty() {
    return Err("The coach request id cannot be empty.".to_string());
  }

  mark_coach_request_canceled(trimmed);
  Ok("stopping".to_string())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      list_ollama_models,
      warm_planning_model,
      wizard_monthly_plan,
      append_wizard_log,
      wizard_questions,
      wizard_plan,
      coach_outcome_chat,
      cancel_coach_outcome_chat
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
