export class MockMemento {
  private store = new Map<string, any>();

  get<T>(key: string, defaultValue?: T): T {
    if (!this.store.has(key)) return defaultValue as T;
    return this.store.get(key);
  }

  async update(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  keys(): readonly string[] {
    return Array.from(this.store.keys());
  }

  clear() {
    this.store.clear();
  }
}
