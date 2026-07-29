import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/svelte";
import { pwaStore } from "../stores/pwaStore";
import UpdateBanner from "./UpdateBanner.svelte";

describe("UpdateBanner", () => {
  afterEach(() => {
    cleanup();
    pwaStore.setNeedRefresh(false);
  });

  it("renders nothing when no update is available", () => {
    pwaStore.setNeedRefresh(false);
    render(UpdateBanner);
    expect(screen.queryByText("Actualizar ahora")).not.toBeInTheDocument();
  });

  it("shows the banner and calls updateSW(true) when the user confirms", async () => {
    const updateSW = vi.fn().mockResolvedValue(undefined);
    pwaStore.setUpdateSW(updateSW);
    pwaStore.setNeedRefresh(true);

    render(UpdateBanner);
    expect(screen.getByText(/versión nueva/)).toBeInTheDocument();

    await fireEvent.click(screen.getByText("Actualizar ahora"));

    expect(updateSW).toHaveBeenCalledWith(true);
  });
});
