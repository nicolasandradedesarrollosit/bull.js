// The ViewModel is tested as a plain class: no React, no DOM, with an in-memory repository.
import { describe, expect, it } from "vitest";
import { TodoRepository, type KeyValueStorage } from "../model/todo.repository";
import { TodoListViewModel } from "./todo-list.viewmodel";

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function setup() {
  const repo = new TodoRepository(memoryStorage(), 0);
  return { repo, vm: new TodoListViewModel(repo) };
}

describe("TodoListViewModel", () => {
  it("adds a valid task and clears the draft", async () => {
    const { vm, repo } = setup();
    vm.editDraft.execute("  Buy bread ");
    vm.add.execute();
    expect(vm.visible.value.map((t) => t.title)).toEqual(["Buy bread"]);
    expect(vm.draft.value).toBe("");
    expect(await repo.list()).toHaveLength(1);
  });

  it("rejects invalid titles and explains why", () => {
    const { vm } = setup();
    vm.add.execute();
    expect(vm.isEmpty.value).toBe(true);
    expect(vm.draftError.value).toBe("Write something to add.");
  });

  it("filters and counts active tasks", () => {
    const { vm } = setup();
    for (const title of ["a", "b", "c"]) {
      vm.editDraft.execute(title);
      vm.add.execute();
    }
    vm.toggle.execute(vm.visible.value[0]!.id);
    expect(vm.remaining.value).toBe(2);
    vm.setFilter.execute("done");
    expect(vm.visible.value.map((t) => t.title)).toEqual(["c"]);
    vm.clearCompleted.execute();
    expect(vm.visible.value).toEqual([]);
    expect(vm.clearCompleted.canExecute.value).toBe(false);
  });

  it("loads from the repository", async () => {
    const { vm, repo } = setup();
    await repo.save([{ id: "1", title: "persisted", done: false, createdAt: 0 }]);
    await vm.load.execute();
    expect(vm.visible.value[0]?.title).toBe("persisted");
  });
});
