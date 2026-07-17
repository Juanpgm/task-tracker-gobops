/**
 * Behavioral tests for ColumnasMensuales.svelte — a single-metric column
 * chart (small multiple), used twice by the dashboard: once for avanzadas
 * per month, once for requerimientos per month — each on its own scale.
 * This test file only verifies ONE instance's behavior in isolation.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, fireEvent, within } from "@testing-library/svelte";
import ColumnasMensuales from "./ColumnasMensuales.svelte";

const items = [
  { mes: "2026-04", value: 2 },
  { mes: "2026-05", value: 0 },
  { mes: "2026-06", value: 5 },
  { mes: "2026-07", value: 3 },
];

describe("ColumnasMensuales", () => {
  it("renders the title and one column per month", () => {
    const { getByText, getAllByTestId } = render(ColumnasMensuales, {
      props: { title: "Avanzadas por mes", items },
    });
    expect(getByText("Avanzadas por mes")).toBeInTheDocument();
    expect(getAllByTestId("column-bar")).toHaveLength(4);
  });

  it("uses the same fill color for every column (one hue)", () => {
    const { getAllByTestId } = render(ColumnasMensuales, { props: { title: "t", items } });
    const bars = getAllByTestId("column-bar");
    const colors = new Set(bars.map((el) => el.style.backgroundColor));
    expect(colors.size).toBe(1);
    expect([...colors][0]).toBe("var(--series)");
  });

  it("does not crash and renders flat columns when every value is zero", () => {
    const { getAllByTestId } = render(ColumnasMensuales, {
      props: { title: "t", items: [{ mes: "2026-01", value: 0 }, { mes: "2026-02", value: 0 }] },
    });
    const bars = getAllByTestId("column-bar");
    expect(bars).toHaveLength(2);
  });

  it("shows a tooltip with month and value on hover, and on focus", async () => {
    const { getAllByTestId, queryByRole } = render(ColumnasMensuales, { props: { title: "t", items } });
    const col = getAllByTestId("column-hit")[2]; // 2026-06, value 5

    await fireEvent.mouseEnter(col);
    expect(queryByRole("tooltip")).toHaveTextContent("5");

    await fireEvent.mouseLeave(col);
    expect(queryByRole("tooltip")).not.toBeInTheDocument();

    await fireEvent.focus(col);
    expect(queryByRole("tooltip")).toBeInTheDocument();
    await fireEvent.blur(col);
    expect(queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("toggles to an accessible table view with month + value columns", async () => {
    const { getByRole, queryByRole } = render(ColumnasMensuales, {
      props: { title: "Avanzadas por mes", items },
    });
    const toggle = getByRole("button", { name: /ver tabla/i });
    await fireEvent.click(toggle);

    const table = getByRole("table");
    expect(within(table).getByText("2026-06")).toBeInTheDocument();
    expect(within(table).getByText("5")).toBeInTheDocument();
  });

  it("shows an empty message and no columns when items is empty", () => {
    const { getByText, queryAllByTestId } = render(ColumnasMensuales, {
      props: { title: "t", items: [], emptyMessage: "Sin datos en el periodo." },
    });
    expect(getByText("Sin datos en el periodo.")).toBeInTheDocument();
    expect(queryAllByTestId("column-bar")).toHaveLength(0);
  });
});
