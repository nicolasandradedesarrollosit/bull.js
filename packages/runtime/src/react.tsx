import {
  StrictMode,
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { Container, type Token } from "./container";
import { ACTIVATE, DEACTIVATE } from "./lifecycle";
import type { Readable } from "./reactive";
import type { ViewModel } from "./ViewModel";

const ContainerContext = createContext<Container | null>(null);

export function TriadProvider(props: { container: Container; children?: ReactNode }) {
  return <ContainerContext.Provider value={props.container}>{props.children}</ContainerContext.Provider>;
}

/**
 * Connects a View with its ViewModel. Creates one instance per component,
 * activates it on mount and deactivates it on unmount.
 */
export function useViewModel<T extends ViewModel>(token: Token<T>): T {
  const container = useContext(ContainerContext);
  if (!container) {
    throw new Error(
      `[triad] useViewModel(${token.name}) was called outside a Triad app. ` +
        `Mount the app with createTriadApp() in src/main.tsx.`,
    );
  }
  const [vm] = useState(() => container.createViewModel(token));
  useLifecycle(vm);
  return vm;
}

/**
 * Activates a child ViewModel that a parent passed to a View through props
 * (for example, a `TodoItemViewModel` inside a list).
 */
export function useChildViewModel<T extends ViewModel>(vm: T): T {
  useLifecycle(vm);
  return vm;
}

function useLifecycle(vm: ViewModel): void {
  useEffect(() => {
    vm[ACTIVATE]();
    return () => vm[DEACTIVATE]();
  }, [vm]);
}

/** Reads an observable ViewModel value and re-renders when it changes. */
export function useBinding<T>(source: Readable<T>): T {
  const snapshot = () => source.peek();
  return useSyncExternalStore(source.subscribe, snapshot, snapshot);
}

export interface TriadAppOptions {
  /** The root View of the application. */
  root: ComponentType;
  /** Registers the Models and ViewModels. It is the app's dependency injection. */
  register?: (container: Container) => void;
  /** Element or selector where the app is mounted. Defaults to `#root`. */
  element?: Element | string;
  /** Wraps the app in `<StrictMode>`. Defaults to `true`. */
  strict?: boolean;
}

export interface TriadApp {
  container: Container;
  unmount(): void;
}

/** Mounts the application. Called once, from the composition root. */
export function createTriadApp(options: TriadAppOptions): TriadApp {
  const container = new Container();
  options.register?.(container);

  const target = options.element ?? "#root";
  const element = typeof target === "string" ? document.querySelector(target) : target;
  if (!element) throw new Error(`[triad] Element "${String(target)}" was not found in index.html.`);

  const Root = options.root;
  const tree = (
    <TriadProvider container={container}>
      <Root />
    </TriadProvider>
  );
  const root: Root = createRoot(element);
  root.render(options.strict === false ? tree : <StrictMode>{tree}</StrictMode>);
  return { container, unmount: () => root.unmount() };
}

export { Container };
