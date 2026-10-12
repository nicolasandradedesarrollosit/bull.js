import type { Todo } from "../viewmodel/todo-list.viewmodel";

interface TodoItemProps {
  todo: Todo;
  onToggle: () => void;
  onRemove: () => void;
}

/** Purely presentational View: receives data and callbacks, has no state. */
export function TodoItemView({ todo, onToggle, onRemove }: TodoItemProps) {
  return (
    <li className={todo.done ? "item done" : "item"}>
      <label>
        <input type="checkbox" checked={todo.done} onChange={onToggle} />
        <span>{todo.title}</span>
      </label>
      <button type="button" className="remove" onClick={onRemove} aria-label={`Delete "${todo.title}"`}>
        ×
      </button>
    </li>
  );
}
