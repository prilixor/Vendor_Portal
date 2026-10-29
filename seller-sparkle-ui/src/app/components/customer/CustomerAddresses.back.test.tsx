import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerAddresses from "./CustomerAddresses";

vi.mock("@/app/components/shared/MapPicker", () => ({
  MapPicker: () => <div data-testid="map" />,
}));

vi.mock("@/app/services/customerApi", () => ({
  customerApi: {
    getAddresses: vi.fn().mockResolvedValue([]),
    getIndianStates: vi.fn().mockResolvedValue([]),
    getCitiesByState: vi.fn().mockResolvedValue([]),
    addAddress: vi.fn(),
    updateAddress: vi.fn(),
    deleteAddress: vi.fn(),
  },
}));

function renderAddresses(initialEntries: string[], initialIndex = initialEntries.length - 1) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        <Routes>
          <Route path="/customer/checkout" element={<div>Checkout page</div>} />
          <Route path="/customer/shop" element={<div>Shop page</div>} />
          <Route path="/customer/shop/:listingId" element={<div>Product page</div>} />
          <Route path="/customer/addresses" element={<CustomerAddresses />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CustomerAddresses back", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("returns to the page that opened addresses", async () => {
    window.history.pushState({ idx: 1 }, "", "/customer/addresses");
    renderAddresses(["/customer/checkout", "/customer/addresses"]);

    expect(await screen.findByRole("heading", { name: "Addresses" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("Checkout page")).toBeInTheDocument();
  });

  it("returns to a product page when that page opened addresses", async () => {
    window.history.pushState({ idx: 1 }, "", "/customer/addresses");
    renderAddresses(["/customer/shop/listing-1", "/customer/addresses"]);

    fireEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(await screen.findByText("Product page")).toBeInTheDocument();
  });

  it("goes to the shop when addresses was opened directly", async () => {
    renderAddresses(["/customer/addresses"]);

    fireEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(await screen.findByText("Shop page")).toBeInTheDocument();
  });
});
