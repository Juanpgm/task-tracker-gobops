/**
 * Behavioral tests for Home.svelte's grouped action layout (design-system
 * pass: actions are grouped into "Captura" / "Gestión y análisis" sections
 * instead of a flat list of 6 arbitrarily-colored cards).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/svelte";

vi.mock("../api/auth", () => ({ logout: vi.fn() }));

// AppInfoPanel/ChangePassword pull in unrelated heavy dependencies (PWA
// state, password APIs) that are out of scope for Home's own layout —
// stubbed so this test stays focused.
vi.mock("./AppInfoPanel.svelte", async () => {
  const { default: Stub } = await import("./__test-stubs__/EmptyStub.svelte");
  return { default: Stub };
});
vi.mock("./ChangePassword.svelte", async () => {
  const { default: Stub } = await import("./__test-stubs__/EmptyStub.svelte");
  return { default: Stub };
});

const navigationMocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("../stores/navigationStore", () => ({
  navigationStore: { navigate: navigationMocks.navigate },
}));

import Home from "./Home.svelte";

describe("Home", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("groups actions under 'Captura' and 'Gestión y análisis' headings instead of one flat list", () => {
    render(Home);

    expect(screen.getByText("Captura")).toBeInTheDocument();
    expect(screen.getByText("Gestión y análisis")).toBeInTheDocument();
  });

  it("puts capture-oriented actions under Captura and analysis actions under Gestión y análisis", () => {
    render(Home);

    const captura = screen.getByText("Captura").closest(".action-group")!;
    expect(captura).toHaveTextContent("Programar Visita");
    expect(captura).toHaveTextContent("Avanzadas");

    const gestion = screen.getByText("Gestión y análisis").closest(".action-group")!;
    expect(gestion).toHaveTextContent("Gestión Requerimientos");
    expect(gestion).toHaveTextContent("Reportes");
  });

  it("keeps the app identity intact", () => {
    render(Home);
    expect(screen.getByText("GobOps")).toBeInTheDocument();
    expect(screen.getByText("Seguimiento de Requerimientos")).toBeInTheDocument();
  });

  it("navigates to the right view when an action card is clicked", async () => {
    render(Home);
    await fireEvent.click(screen.getByText("Avanzadas").closest("button")!);
    expect(navigationMocks.navigate).toHaveBeenCalledWith("avanzadas");
  });

  it("renders all 4 actions across both groups, none dropped by the regrouping", () => {
    render(Home);
    const cards = document.querySelectorAll(".action-card");
    expect(cards).toHaveLength(4);
  });
});
