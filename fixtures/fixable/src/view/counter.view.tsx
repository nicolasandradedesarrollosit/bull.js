import { useBinding, useViewModel } from "@bull/runtime/react";
import type { Count } from "../model/counter.model";
import { CounterViewModel } from "../viewmodel/counter.viewmodel";

export function CounterView(props: { initial?: Count }) {
  const vm = useViewModel(CounterViewModel);
  const count = useBinding(vm.count);
  return (
    <button onClick={vm.increment.execute}>
      {vm.label}: {count} {props.initial?.value}
    </button>
  );
}
