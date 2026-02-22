import * as assert from "assert";
import { MockMemento } from "./mocks/mockMemento";
import { WorkspaceStateService } from "../services/workspaceStateService";

function ctx(state: MockMemento) {
  return { workspaceState: state } as any;
}

describe("WorkspaceStateService", () => {

  it("persists and retrieves values", async () => {
    const state = new MockMemento();
    const service = new WorkspaceStateService(ctx(state));

    await service.set("key", 42);

    const value = service.get<number>("key");

    assert.strictEqual(value, 42);
  });

  it("returns default when key missing", () => {
    const service = new WorkspaceStateService(ctx(new MockMemento()));

    const value = service.get("missing", "default");

    assert.strictEqual(value, "default");
  });

  it("removes values", async () => {
    const state = new MockMemento();
    const service = new WorkspaceStateService(ctx(state));

    await service.set("temp", 1);
    await service.delete("temp");

    assert.strictEqual(service.get("temp"), undefined);
  });

  it("handles corrupted JSON safely", async () => {
    const state = new MockMemento();
    await state.update("corrupt", "{bad json");

    const service = new WorkspaceStateService(ctx(state));

    const value = service.get("corrupt");

    assert.strictEqual(value, undefined);
  });

});
