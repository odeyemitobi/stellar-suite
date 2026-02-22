import * as assert from "assert";
import { MockMemento } from "./mocks/mockMemento";

describe("Workspace State Persistence", () => {
  let state: MockMemento;

  beforeEach(() => {
    state = new MockMemento();
  });

  it("persists and retrieves state", async () => {
    await state.update("key", { foo: "bar" });
    assert.deepStrictEqual(state.get("key"), { foo: "bar" });
  });

  it("returns default when missing", () => {
    assert.strictEqual(state.get("missing", "default"), "default");
  });

  it("overwrites existing state", async () => {
    await state.update("key", 1);
    await state.update("key", 2);
    assert.strictEqual(state.get("key"), 2);
  });
});
