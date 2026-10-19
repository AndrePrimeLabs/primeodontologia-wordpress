import { Worker } from "@notionhq/workers"
import * as Builder from "@notionhq/workers/builder"
import * as Schema from "@notionhq/workers/schema"
import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config()

const worker = new Worker()
export default worker

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

// Attached database declaration for Notion database
const issues = worker.database("issues", {
  type: "attached",
  initialTitle: "Issues",
  primaryKeyProperty: "Issue ID",
  schema: {
    properties: {
      Title: Schema.title(),
      "Issue ID": Schema.richText(),
      Status: Schema.status({
        groups: [
          {
            name: "To-do",
            options: [{ name: "Not Started", color: "default" }],
          },
          {
            name: "In progress",
            options: [{ name: "In Progress", color: "blue" }],
          },
          {
            name: "Complete",
            options: [
              { name: "Done", color: "green" },
              { name: "Cancelled", color: "gray" },
            ],
          },
        ],
      }),
      Priority: Schema.select([
        { name: "Urgent", color: "red" },
        { name: "High", color: "orange" },
        { name: "Medium", color: "yellow" },
        { name: "Low", color: "blue" },
      ]),
      "Due Date": Schema.date(),
      "Assigned To": Schema.richText(),
    },
  },
})

// Sync capability: fetches tasks from PrimeOS Supabase and syncs to Notion
worker.sync("issuesSync", {
  database: issues,
  execute: async () => {
    if (!supabaseUrl || !supabaseKey) {
      console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured. Returning empty changes.")
      return {
        changes: [],
        hasMore: false,
      }
    }

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*")
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Error querying tasks from Supabase:", error)
      throw new Error(`Supabase query failed: ${error.message}`)
    }

    return {
      changes: (tasks || []).map((task) => ({
        type: "upsert" as const,
        key: task.id,
        properties: {
          Title: Builder.title(task.title || "Sem título"),
          "Issue ID": Builder.richText(task.id),
          Status: Builder.status(mapStatus(task.status)),
          Priority: Builder.select(mapPriority(task.priority)),
          ...(task.due_date ? { "Due Date": Builder.date(task.due_date) } : {}),
          ...(task.assigned_to ? { "Assigned To": Builder.richText(task.assigned_to) } : {}),
        },
      })),
      hasMore: false,
    }
  },
})

function mapStatus(status?: string): string {
  switch (status?.toLowerCase()) {
    case "done":
    case "completed":
      return "Done"
    case "in_progress":
      return "In Progress"
    case "cancelled":
      return "Cancelled"
    default:
      return "Not Started"
  }
}

function mapPriority(priority?: string): string {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return "Urgent"
    case "high":
      return "High"
    case "low":
      return "Low"
    default:
      return "Medium"
  }
}
