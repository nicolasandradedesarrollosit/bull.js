// Composition root: the only file that knows all three layers.
import "./styles/app.css";
import { createTriadApp } from "@triad/runtime/react";
import { CounterRepository } from "./model/counter.repository";
import { CounterView } from "./view/counter.view";
import { CounterViewModel } from "./viewmodel/counter.viewmodel";

createTriadApp({
  root: CounterView,
  register: (c) => {
    c.model(CounterRepository, () => new CounterRepository());
    c.viewModel(CounterViewModel, (c) => new CounterViewModel(c.get(CounterRepository)));
  },
});
