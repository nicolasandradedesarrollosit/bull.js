// Composition root: the only file that knows all three layers.
import "./styles/app.css";
import { createTriadApp } from "@triad/runtime/react";
import { TodoRepository } from "./model/todo.repository";
import { AppView } from "./view/app.view";
import { TodoListViewModel } from "./viewmodel/todo-list.viewmodel";

createTriadApp({
  root: AppView,
  register: (c) => {
    c.model(TodoRepository, () => new TodoRepository());
    c.viewModel(TodoListViewModel, (c) => new TodoListViewModel(c.get(TodoRepository)));
  },
});
