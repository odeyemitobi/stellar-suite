export class MockMemento {
  private store = new Map<string, any>();

  get<T>(key: string, defaultValue?: T): T {
    if (this.store.has(key)) {
      return this.store.get(key);
    }
    return defaultValue as T;
  }

  async update(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  keys(): readonly string[] {
    return Array.from(this.store.keys());
  }
}
