import type { Todo } from "./todo.entity";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = "bull.todos";

/** Data access. Today it is localStorage, tomorrow it can be an API: the ViewModel never notices. */
export class TodoRepository {
  constructor(
    private readonly storage: KeyValueStorage = localStorage,
    private readonly latencyMs = 350,
  ) {}

  async list(): Promise<Todo[]> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    const raw = this.storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Todo[]) : [];
  }

  async save(todos: readonly Todo[]): Promise<void> {
    this.storage.setItem(KEY, JSON.stringify(todos));
  }
}
