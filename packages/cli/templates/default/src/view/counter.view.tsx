// View: only binds and draws. Reads with useBinding, acts with commands.
import { useBinding, useViewModel } from "@triad/runtime/react";
import { CounterViewModel } from "../viewmodel/counter.viewmodel";
import { BullLogoView } from "./bull-logo.view";

export function CounterView() {
  const vm = useViewModel(CounterViewModel);
  const count = useBinding(vm.count);
  const canReset = useBinding(vm.reset.canExecute);

  return (
    <main className="counter">
      <BullLogoView size={56} />
      <p className="layers">View → ViewModel → Model</p>
      <h1>{count}</h1>
      <div className="actions">
        <button onClick={vm.increment.execute}>+1</button>
        <button onClick={vm.reset.execute} disabled={!canReset}>
          Reset
        </button>
      </div>
    </main>
  );
}
