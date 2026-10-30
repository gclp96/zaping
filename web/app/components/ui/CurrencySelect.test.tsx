import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CurrencySelect, { isSupportedCurrency } from "./CurrencySelect";

afterEach(() => cleanup());

describe("CurrencySelect", () => {
  it("only allows selection of MXN or USD", async () => {
    const onChange = vi.fn();
    render(<CurrencySelect label="Moneda" value="MXN" onChange={onChange} required />);
    const select = screen.getByRole("combobox", { name: /Moneda/ });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await userEvent.setup().selectOptions(select, "USD");
    expect(onChange).toHaveBeenCalledWith("USD");
    expect(isSupportedCurrency("EUR")).toBe(false);
  });

  it("does not silently remap a legacy unsupported currency", () => {
    render(<CurrencySelect label="Moneda corregida" value="EUR" onChange={vi.fn()} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("EUR");
    expect(screen.getByRole("option", { name: /fuera del catálogo/ })).toBeTruthy();
  });
});
