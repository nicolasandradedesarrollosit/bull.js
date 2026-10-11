export class CounterApi {
  async save(value: number): Promise<void> {
    await fetch("/api/counter", { method: "PUT", body: String(value) });
  }
}
