import type { TaskStatus, TaskType } from "@/lib/db/types";

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "Not started yet" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "On hold" },
  { value: "done", label: "Done" },
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Not started yet",
  in_progress: "In progress",
  blocked: "On hold",
  done: "Done",
};

export const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "client_mom", label: "Client / MOM" },
];

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  weekly: "Weekly",
  client_mom: "Client / MOM",
};
