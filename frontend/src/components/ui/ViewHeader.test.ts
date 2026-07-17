import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/svelte";
import { navigationStore } from "../../stores/navigationStore";
import ViewHeader from "./ViewHeader.svelte";
import ViewHeaderActionSlotStub from "./__test-stubs__/ViewHeaderActionSlotStub.svelte";

describe("ViewHeader", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the title, and an icon when provided", () => {
    render(ViewHeader, { title: "Avanzadas", icon: "flag" });
    expect(screen.getByText("Avanzadas")).toBeInTheDocument();
    // Icon.svelte renders an svg with aria-hidden — presence check via role absence is enough here.
    expect(document.querySelector("svg.icon")).toBeInTheDocument();
  });

  it("renders a subtitle when provided", () => {
    render(ViewHeader, { title: "Reportes", subtitle: "Últimos 30 días" });
    expect(screen.getByText("Últimos 30 días")).toBeInTheDocument();
  });

  it("omits the subtitle paragraph when none is provided", () => {
    render(ViewHeader, { title: "Reportes" });
    expect(document.querySelector(".view-header__subtitle")).not.toBeInTheDocument();
  });

  it("defaults the back label to 'Volver' and calls navigationStore.back() when clicked", async () => {
    const backSpy = vi.spyOn(navigationStore, "back").mockImplementation(() => {});
    render(ViewHeader, { title: "Detalle" });

    const backBtn = screen.getByText("← Volver").closest("button")!;
    await fireEvent.click(backBtn);

    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("uses a custom backLabel when provided", () => {
    render(ViewHeader, { title: "Avanzadas", backLabel: "Inicio" });
    expect(screen.getByText("← Inicio")).toBeInTheDocument();
    expect(screen.queryByText("← Volver")).not.toBeInTheDocument();
  });

  it("calls a custom onBack instead of navigationStore.back() when provided", async () => {
    const backSpy = vi.spyOn(navigationStore, "back").mockImplementation(() => {});
    const onBack = vi.fn();
    render(ViewHeader, { title: "Detalle", onBack });

    await fireEvent.click(screen.getByText("← Volver").closest("button")!);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("renders content passed to the action slot", () => {
    render(ViewHeaderActionSlotStub);
    expect(screen.getByText("+ Nueva avanzada")).toBeInTheDocument();
  });
});
