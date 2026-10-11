import { TodoListView } from "./todo-list.view";

export function AppView() {
  return (
    <main className="app">
      <header className="app-header">
        <span className="brand">▲ triad</span>
        <h1>Tasks</h1>
        <p className="layers">
          <span>View</span> → <span>ViewModel</span> → <span>Model</span>
        </p>
      </header>
      <TodoListView />
    </main>
  );
}
