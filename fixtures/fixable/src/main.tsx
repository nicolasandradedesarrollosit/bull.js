import { createTriadApp } from "@triad/runtime/react";
import { CounterApi } from "./model/CounterApi";
import { CounterView } from "./view/counter.view";
import { CounterViewModel } from "./viewmodel/counter.viewmodel";

createTriadApp({
  root: CounterView,
  register: (c) => {
    c.model(CounterApi, () => new CounterApi());
    c.viewModel(CounterViewModel, (c) => new CounterViewModel(c.get(CounterApi)));
  },
});
