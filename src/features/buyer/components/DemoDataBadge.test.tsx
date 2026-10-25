import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DemoDataBadge } from "./DemoDataBadge";
import { areSyntheticRecords, isSyntheticRecord } from "./demoData";

afterEach(cleanup);

test("renders an accessible demonstration badge when explicitly requested", () => {
    render(<DemoDataBadge visible />);

    const badge = screen.getByRole("note");
    expect(badge.textContent).toBe("Dados de demonstração");
    expect(badge.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("does not render the badge for real or unidentified sources", () => {
    const { rerender } = render(<DemoDataBadge visible />);
    expect(screen.getByRole("note")).toBeTruthy();

    rerender(<DemoDataBadge visible={false} />);
    expect(screen.queryByText("Dados de demonstração")).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
});

test("recognizes only explicit and well-formed synthetic markers", () => {
    expect(isSyntheticRecord({ is_synthetic: true, demo_run_id: "run-1" })).toBe(true);
    expect(isSyntheticRecord({ is_synthetic: true })).toBe(true);
    expect(isSyntheticRecord({ is_synthetic: false, demo_run_id: "run-1" })).toBe(false);
    expect(isSyntheticRecord({ demo_run_id: "run-1" })).toBe(false);
    expect(isSyntheticRecord({ is_synthetic: true, demo_run_id: "  " })).toBe(false);
    expect(isSyntheticRecord(undefined)).toBe(false);
    expect(areSyntheticRecords([])).toBe(false);
    expect(areSyntheticRecords([{ is_synthetic: true }, { is_synthetic: true, demo_run_id: "run-1" }])).toBe(true);
    expect(areSyntheticRecords([{ is_synthetic: true }, {}])).toBe(false);
});
