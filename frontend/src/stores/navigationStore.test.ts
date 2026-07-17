import { describe, it, expect, beforeEach } from "vitest";
import { get as svelteGet } from "svelte/store";
import { navigationStore } from "./navigationStore";

describe("navigationStore", () => {
  beforeEach(() => {
    navigationStore.goHome();
  });

  it("starts at home with an empty history stack", () => {
    const state = svelteGet(navigationStore);
    expect(state.view).toBe("home");
    expect(state.params).toEqual({});
    expect(state.history).toEqual([]);
  });

  it("navigate() pushes the current view onto the history stack", () => {
    navigationStore.navigate("avanzadas");
    navigationStore.navigate("registrar-avanzada");

    const state = svelteGet(navigationStore);
    expect(state.view).toBe("registrar-avanzada");
    expect(state.history).toEqual([
      { view: "home", params: {} },
      { view: "avanzadas", params: {} },
    ]);
  });

  it("navigate() carries params, and getParams() reflects the current view's params", () => {
    navigationStore.navigate("detalle-avanzada", { client_id: "a1" });
    expect(navigationStore.getParams()).toEqual({ client_id: "a1" });
  });

  it("back() pops to the actual previous view, restoring its params", () => {
    navigationStore.navigate("avanzadas");
    navigationStore.navigate("detalle-avanzada", { client_id: "a1" });
    navigationStore.navigate("registrar-avanzada");

    navigationStore.back();
    let state = svelteGet(navigationStore);
    expect(state.view).toBe("detalle-avanzada");
    expect(state.params).toEqual({ client_id: "a1" });

    navigationStore.back();
    state = svelteGet(navigationStore);
    expect(state.view).toBe("avanzadas");
    expect(state.params).toEqual({});

    navigationStore.back();
    state = svelteGet(navigationStore);
    expect(state.view).toBe("home");
  });

  it("back() falls back to home when the history stack is empty", () => {
    // No navigate() calls — history is empty from the start.
    navigationStore.back();
    const state = svelteGet(navigationStore);
    expect(state.view).toBe("home");
    expect(state.params).toEqual({});
    expect(state.history).toEqual([]);
  });

  it("goHome() clears the history stack", () => {
    navigationStore.navigate("avanzadas");
    navigationStore.navigate("registrar-avanzada");

    navigationStore.goHome();
    const state = svelteGet(navigationStore);
    expect(state.view).toBe("home");
    expect(state.params).toEqual({});
    expect(state.history).toEqual([]);

    // Subsequent back() should fall back to home, proving history was cleared.
    navigationStore.back();
    expect(svelteGet(navigationStore).view).toBe("home");
  });
});
