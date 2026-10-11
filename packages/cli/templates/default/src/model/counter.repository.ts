// Model: data and business rules. Knows nothing about React or the screen.
const KEY = "counter";

export class CounterRepository {
  load(): number {
    return Number(localStorage.getItem(KEY) ?? 0);
  }

  save(value: number): void {
    localStorage.setItem(KEY, String(value));
  }
}
