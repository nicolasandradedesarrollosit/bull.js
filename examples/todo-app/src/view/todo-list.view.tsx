import { useBinding, useViewModel } from "@triad/runtime/react";
import { TodoListViewModel, type TodoFilter } from "../viewmodel/todo-list.viewmodel";
import { TodoItemView } from "./todo-item.view";

const FILTERS: Array<{ value: TodoFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "done", label: "Done" },
];

export function TodoListView() {
  const vm = useViewModel(TodoListViewModel);
  const draft = useBinding(vm.draft);
  const draftError = useBinding(vm.draftError);
  const visible = useBinding(vm.visible);
  const remaining = useBinding(vm.remaining);
  const filter = useBinding(vm.filter);
  const isEmpty = useBinding(vm.isEmpty);
  const loading = useBinding(vm.load.isRunning);
  const canClear = useBinding(vm.clearCompleted.canExecute);

  return (
    <section className="card">
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          vm.add.execute();
        }}
      >
        <input
          value={draft}
          onChange={(event) => vm.editDraft.execute(event.target.value)}
          placeholder="What needs to be done?"
          aria-invalid={draftError !== null}
          autoFocus
        />
        <button type="submit">Add</button>
      </form>
      {draftError && <p className="error">{draftError}</p>}

      <nav className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={f.value === filter ? "active" : undefined}
            onClick={() => vm.setFilter.execute(f.value)}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="empty">Loading…</p>
      ) : isEmpty ? (
        <p className="empty">No tasks yet. Add the first one.</p>
      ) : (
        <ul className="list">
          {visible.map((todo) => (
            <TodoItemView
              key={todo.id}
              todo={todo}
              onToggle={() => vm.toggle.execute(todo.id)}
              onRemove={() => vm.remove.execute(todo.id)}
            />
          ))}
        </ul>
      )}

      <footer className="footer">
        <span>
          {remaining} {remaining === 1 ? "item left" : "items left"}
        </span>
        <button className="link" disabled={!canClear} onClick={vm.clearCompleted.execute}>
          Clear completed
        </button>
      </footer>
    </section>
  );
}
