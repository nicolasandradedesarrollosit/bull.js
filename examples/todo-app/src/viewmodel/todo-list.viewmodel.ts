import { ViewModel } from "@bull/runtime";
import { createTodo, matchesFilter, validateTitle, type Todo, type TodoFilter } from "../model/todo.entity";
import type { TodoRepository } from "../model/todo.repository";

// The View uses these types but cannot import them from the Model: the ViewModel re-exports them.
export type { Todo, TodoFilter } from "../model/todo.entity";

export class TodoListViewModel extends ViewModel {
  // Private state: only this ViewModel writes it.
  readonly #todos = this.state<Todo[]>([]);
  readonly #draft = this.state("");
  readonly #filter = this.state<TodoFilter>("all");
  readonly #touched = this.state(false);

  // What the View sees: reads, never writes.
  readonly draft = this.#draft.readonly;
  readonly filter = this.#filter.readonly;
  readonly draftError = this.computed(() => (this.#touched.value ? validateTitle(this.#draft.value) : null));
  readonly visible = this.computed(() => this.#todos.value.filter((t) => matchesFilter(t, this.#filter.value)));
  readonly remaining = this.computed(() => this.#todos.value.filter((t) => !t.done).length);
  readonly hasCompleted = this.computed(() => this.#todos.value.some((t) => t.done));
  readonly isEmpty = this.computed(() => this.#todos.value.length === 0);

  // What the View can do: commands.
  readonly load = this.command(async () => this.#todos.set(await this.repo.list()));

  readonly editDraft = this.command((text: string) => {
    this.#draft.set(text);
    this.#touched.set(text.length > 0);
  });

  readonly add = this.command(
    () => {
      this.#touched.set(true);
      if (validateTitle(this.#draft.value)) return;
      this.#commit([createTodo(this.#draft.value), ...this.#todos.value]);
      this.#draft.set("");
      this.#touched.set(false);
    },
    { canExecute: () => !this.load.isRunning.value },
  );

  readonly toggle = this.command((id: string) =>
    this.#commit(this.#todos.value.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
  );

  readonly remove = this.command((id: string) => this.#commit(this.#todos.value.filter((t) => t.id !== id)));

  readonly clearCompleted = this.command(() => this.#commit(this.#todos.value.filter((t) => !t.done)), {
    canExecute: () => this.hasCompleted.value,
  });

  readonly setFilter = this.command((filter: TodoFilter) => this.#filter.set(filter));

  constructor(private readonly repo: TodoRepository) {
    super();
  }

  protected override onActivate() {
    void this.load.execute();
  }

  #commit(todos: Todo[]): void {
    this.#todos.set(todos);
    void this.repo.save(todos);
  }
}
