import { Worker } from "@notionhq/workers";
import * as Builder from "@notionhq/workers/builder";
import * as Schema from "@notionhq/workers/schema";

// PrimeOS (Supabase) `tasks` → Notion. One-way: PrimeOS is the source of truth.
// Secrets (set with `ntn workers env set`, never in code or Notion):
//   SUPABASE_URL               e.g. https://<project-id>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  (or a narrower read-only key, see notes)

const worker = new Worker();
export default worker;

type PrimeOSTask = {
  id: string;
  title: string | null;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null; // date or timestamptz
  priority: string | null; // low | medium | high | urgent
  status: string | null; // open | in_progress | completed | done | cancelled
  created_at: string;
  updated_at: string;
};

const STATUS = {
  pending: "Pendente",
  inProgress: "Em Andamento",
  done: "Concluído",
  cancelled: "Cancelado",
} as const;

const PRIORITY = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
} as const;

// Same database key and primary key as the deployed starter, so the existing
// "Issues" database is reused instead of a new one being created.
const issues = worker.database("issues", {
  type: "managed",
  initialTitle: "Issues",
  primaryKeyProperty: "Issue ID",
  schema: {
    properties: {
      Name: Schema.title(),
      Status: Schema.select([
        { name: STATUS.pending, color: "gray" },
        { name: STATUS.inProgress, color: "yellow" },
        { name: STATUS.done, color: "green" },
        { name: STATUS.cancelled, color: "red" },
      ]),
      Priority: Schema.select([
        { name: PRIORITY.low, color: "gray" },
        { name: PRIORITY.medium, color: "blue" },
        { name: PRIORITY.high, color: "orange" },
        { name: PRIORITY.urgent, color: "red" },
      ]),
      "Due Date": Schema.date(),
      "Assigned To": Schema.richText(),
      Description: Schema.richText(),
      "Updated At": Schema.date(),
      "Created At": Schema.date(),
      "Issue ID": Schema.richText(), // = PrimeOS tasks.id (UUID)
    },
  },
});

const supabasePacer = worker.pacer("supabase", {
  allowedRequests: 5,
  intervalMs: 1000,
});

const PAGE_SIZE = 100;
type PageState = { offset: number };

function mapStatus(status?: string | null): string {
  switch (status?.toLowerCase()) {
    case "done":
    case "completed":
      return STATUS.done;
    case "in_progress":
      return STATUS.inProgress;
    case "cancelled":
    case "canceled":
      return STATUS.cancelled;
    default:
      return STATUS.pending;
  }
}

function mapPriority(priority?: string | null): string {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return PRIORITY.urgent;
    case "high":
      return PRIORITY.high;
    case "low":
      return PRIORITY.low;
    default:
      return PRIORITY.medium;
  }
}

// Date-only values ("2026-10-11") stay dates; timestamps keep their time.
function toDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Builder.date(value)
    : Builder.dateTime(value);
}

async function fetchTasks(offset: number): Promise<PrimeOSTask[]> {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them with `ntn workers env set`."
    );
  }

  const params = new URLSearchParams({
    select:
      "id,title,description,assigned_to,due_date,priority,status,created_at,updated_at",
    order: "id.asc", // stable order for offset pagination
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });

  await supabasePacer.wait();
  const res = await fetch(`${baseUrl}/rest/v1/tasks?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    // Body only, never headers — keeps the key out of logs.
    throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  return (await res.json()) as PrimeOSTask[];
}

// Replace mode: each cycle reads every task; tasks deleted in PrimeOS are
// removed from Notion automatically at the end of the cycle.
worker.sync("issuesSync", {
  database: issues,
  mode: "replace",
  schedule: "15m",
  execute: async (state: PageState | undefined) => {
    const offset = state?.offset ?? 0;
    const tasks = await fetchTasks(offset);
    const hasMore = tasks.length === PAGE_SIZE;

    return {
      changes: tasks.map((task) => ({
        type: "upsert" as const,
        key: task.id,
        properties: {
          Name: Builder.title(task.title?.trim() || "Sem título"),
          Status: Builder.select(mapStatus(task.status)),
          Priority: Builder.select(mapPriority(task.priority)),
          ...(task.due_date ? { "Due Date": toDate(task.due_date) } : {}),
          ...(task.assigned_to
            ? { "Assigned To": Builder.richText(task.assigned_to) }
            : {}),
          ...(task.description
            ? { Description: Builder.richText(task.description.slice(0, 2000)) }
            : {}),
          "Updated At": Builder.dateTime(task.updated_at),
          "Created At": Builder.dateTime(task.created_at),
          "Issue ID": Builder.richText(task.id),
        },
        ...(task.description ? { pageContentMarkdown: task.description } : {}),
      })),
      hasMore,
      nextState: hasMore ? { offset: offset + PAGE_SIZE } : undefined,
    };
  },
});
