/**
 * Behavioral tests for BarraHorizontal.svelte — the reusable horizontal
 * bar chart used for por_entidad / por_categoria / por_comuna. Renders the
 * real component via @testing-library/svelte and asserts DOM output and
 * interactions, not source text.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, fireEvent, within } from "@testing-library/svelte";
import BarraHorizontal from "./BarraHorizontal.svelte";

const items = [
  { id: "DAGMA", label: "DAGMA", sublabel: "Depto. Administrativo de Gestión del Medio Ambiente", value: 90 },
  { id: "EMCALI", label: "EMCALI", sublabel: "Empresas Municipales de Cali", value: 40 },
  { id: "SECSALUD", label: "SECSALUD", sublabel: "Secretaría de Salud", value: 10 },
];

describe("BarraHorizontal", () => {
  it("renders the title and one bar per item with its value at the tip", () => {
    const { getByText, getAllByTestId } = render(BarraHorizontal, {
      props: { title: "Requerimientos por entidad", items },
    });

    expect(getByText("Requerimientos por entidad")).toBeInTheDocument();
    const bars = getAllByTestId("bar-row");
    expect(bars).toHaveLength(3);
    expect(getByText("90")).toBeInTheDocument();
    expect(getByText("40")).toBeInTheDocument();
    expect(getByText("10")).toBeInTheDocument();
  });

  it("uses the same fill color for every bar (one hue, no value ramp)", () => {
    const { getAllByTestId } = render(BarraHorizontal, { props: { title: "t", items } });
    const fills = getAllByTestId("bar-fill");
    const colors = new Set(fills.map((el) => el.style.backgroundColor));
    expect(colors.size).toBe(1);
    expect([...colors][0]).toBe("var(--series)");
  });

  it("shows a tooltip on hover and hides it on mouse leave", async () => {
    const { getAllByTestId, queryByRole } = render(BarraHorizontal, { props: { title: "t", items } });
    const bar = getAllByTestId("bar-hit")[0];

    expect(queryByRole("tooltip")).not.toBeInTheDocument();

    await fireEvent.mouseEnter(bar);
    const tooltip = queryByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("90");

    await fireEvent.mouseLeave(bar);
    expect(queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the same tooltip on keyboard focus and hides it on blur", async () => {
    const { getAllByTestId, queryByRole } = render(BarraHorizontal, { props: { title: "t", items } });
    const bar = getAllByTestId("bar-hit")[0];

    await fireEvent.focus(bar);
    expect(queryByRole("tooltip")).toBeInTheDocument();

    await fireEvent.blur(bar);
    expect(queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("toggles to an accessible table view with the same data, and back", async () => {
    const { getByRole, queryByRole } = render(BarraHorizontal, {
      props: { title: "Requerimientos por entidad", items },
    });

    expect(queryByRole("table")).not.toBeInTheDocument();
    const toggle = getByRole("button", { name: /ver tabla/i });

    await fireEvent.click(toggle);

    const table = getByRole("table");
    expect(within(table).getByText("DAGMA")).toBeInTheDocument();
    expect(within(table).getByText("90")).toBeInTheDocument();
    expect(within(table).getByText("EMCALI")).toBeInTheDocument();

    const toggleBack = getByRole("button", { name: /ver gráfico/i });
    await fireEvent.click(toggleBack);
    expect(queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an empty message and no bars when items is empty", () => {
    const { getByText, queryAllByTestId } = render(BarraHorizontal, {
      props: { title: "t", items: [], emptyMessage: "Sin datos disponibles." },
    });
    expect(getByText("Sin datos disponibles.")).toBeInTheDocument();
    expect(queryAllByTestId("bar-row")).toHaveLength(0);
  });
});
