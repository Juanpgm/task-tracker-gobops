/**
 * Behavioral coverage for the view registry: every AppView the app can
 * navigate to (per navigationStore's ALL_APP_VIEWS, the single source of
 * truth) must resolve to a component in viewComponents, and vice versa —
 * no orphaned map entries for views that no longer exist. This is what
 * lets App.svelte use a plain lookup instead of an {#if}/{:else if} chain
 * without silently rotting when someone adds/removes an AppView.
 */
import { describe, it, expect } from "vitest";
import { ALL_APP_VIEWS } from "../stores/navigationStore";
import { viewComponents } from "./viewRegistry";
import RegistrarAvanzada from "../components/avanzadas/RegistrarAvanzada.svelte";

describe("viewRegistry", () => {
  it("has a defined component for every valid AppView", () => {
    for (const view of ALL_APP_VIEWS) {
      expect(viewComponents[view]).toBeDefined();
    }
  });

  it("maps 'programar-avanzada' to the RegistrarAvanzada component, consolidating the legacy programar-visita/registrar-avanzada split", () => {
    expect(viewComponents["programar-avanzada"]).toBe(RegistrarAvanzada);
  });

  it("maps 'editar-avanzada' to the same RegistrarAvanzada component (edit mode is detected internally via params.client_id)", () => {
    expect(viewComponents["editar-avanzada"]).toBe(RegistrarAvanzada);
  });

  it("has no extra keys that aren't valid AppViews", () => {
    const registeredViews = Object.keys(viewComponents);
    for (const view of registeredViews) {
      expect(ALL_APP_VIEWS).toContain(view);
    }
  });

  it("maps exactly the same set of views as ALL_APP_VIEWS, one-to-one", () => {
    const registeredViews = Object.keys(viewComponents).sort();
    const expectedViews = [...ALL_APP_VIEWS].sort();
    expect(registeredViews).toEqual(expectedViews);
  });
});
