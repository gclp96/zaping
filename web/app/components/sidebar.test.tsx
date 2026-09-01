import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import Sidebar from "./sidebar";

const expectedNavigation = [
  ["Inicio", "/home"],
  ["Dashboard", "/dashboard"],
  ["Cambiar contraseña", "/change-password"],
  ["Clientes", "/customers"],
  ["Cotizaciones", "/quotes"],
  ["Ventas", "/sales"],
  ["Proveedores", "/suppliers"],
  ["Compras", "/purchases"],
  ["Recepciones", "/purchase-receipts"],
  ["Productos", "/products"],
  ["Inventario", "/inventory"],
  ["Equipos", "/equipment"],
  ["Categorías", "/categories"],
] as const;

afterEach(() => {
  cleanup();
});

describe("Sidebar", () => {
  it("preserves every navigation group and href", () => {
    render(<Sidebar pathname="/dashboard" />);

    for (const group of [
      "INICIO",
      "COMERCIAL",
      "COMPRAS",
      "INVENTARIO",
      "ADMINISTRACIÓN",
    ]) {
      expect(screen.getByText(group)).toBeTruthy();
    }

    expect(
      screen
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual(expectedNavigation);
  });

  it("marks the active route without relying only on color", () => {
    render(<Sidebar pathname="/products" />);

    const activeLink = screen.getByRole("link", { name: "Productos" });

    expect(activeLink.getAttribute("aria-current")).toBe("page");
    expect(activeLink.classList.contains("border-primary")).toBe(true);
  });

  it("marks Home active without changing the Dashboard route", () => {
    render(<Sidebar pathname="/home" />);

    expect(
      screen.getByRole("link", { name: "Inicio" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("href"),
    ).toBe("/dashboard");
  });

  it("renders expanded mode and exposes the collapse command", async () => {
    const user = userEvent.setup();
    const onToggleCollapsed = vi.fn();

    render(
      <Sidebar
        id="desktop-navigation"
        pathname="/dashboard"
        collapsible
        onToggleCollapsed={onToggleCollapsed}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Colapsar navegación",
    });

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Zaping ERP")).toBeTruthy();

    await user.click(button);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("keeps every link accessible in collapsed mode", () => {
    render(
      <Sidebar
        id="desktop-navigation"
        pathname="/products"
        collapsed
        collapsible
        onToggleCollapsed={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Expandir navegación",
    });
    const productsLink = screen.getByRole("link", {
      name: "Productos",
    });

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(productsLink.getAttribute("href")).toBe("/products");
    expect(productsLink.getAttribute("title")).toBe("Productos");
    expect(
      productsLink.querySelector("span")?.classList.contains("sr-only"),
    ).toBe(true);
  });

  it("shows Users navigation for ADMIN users", () => {
    render(<Sidebar pathname="/users" currentUserRole="ADMIN" />);

    expect(
      screen.getByRole("link", { name: "Usuarios" }).getAttribute("href"),
    ).toBe("/users");
  });

  it.each(["MANAGER", "SALES", "WAREHOUSE"] as const)(
    "hides Users navigation for %s users",
    (role) => {
      render(<Sidebar pathname="/dashboard" currentUserRole={role} />);

      expect(screen.queryByRole("link", { name: "Usuarios" })).toBeNull();
    },
  );

  it("hides Users navigation while current session is unavailable", () => {
    render(<Sidebar pathname="/dashboard" />);

    expect(screen.queryByRole("link", { name: "Usuarios" })).toBeNull();
  });
});
