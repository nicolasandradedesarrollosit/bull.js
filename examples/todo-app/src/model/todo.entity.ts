export interface Todo {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
  readonly createdAt: number;
}

export type TodoFilter = "all" | "active" | "done";

export const MAX_TITLE_LENGTH = 80;

/** Business rule: returns why a title is invalid, or `null`. */
export function validateTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) return "Write something to add.";
  if (trimmed.length > MAX_TITLE_LENGTH) return `At most ${MAX_TITLE_LENGTH} characters.`;
  return null;
}

export function createTodo(title: string, now = Date.now()): Todo {
  const error = validateTitle(title);
  if (error) throw new Error(error);
  return { id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, title: title.trim(), done: false, createdAt: now };
}

export function matchesFilter(todo: Todo, filter: TodoFilter): boolean {
  return filter === "all" || (filter === "done") === todo.done;
}
