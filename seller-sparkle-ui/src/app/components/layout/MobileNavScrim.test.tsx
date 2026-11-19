import { render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMobileNavLock } from "./MobileNavScrim";

afterEach(() => {
  document.documentElement.style.overflow = "";
  document.documentElement.style.overscrollBehavior = "";
  document.body.style.overflow = "";
  document.body.style.overscrollBehavior = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.paddingRight = "";
});

function LockHarness({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  useMobileNavLock(open, () => setOpen(false));
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <aside data-app-drawer="">
        <nav style={{ overflowY: "auto", height: 40 }}>
          <div style={{ height: 200 }}>Menu</div>
        </nav>
      </aside>
      <div data-testid="page">Page</div>
    </div>
  );
}

describe("useMobileNavLock", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
  });

  it("freezes the document while the menu is open and restores it on close", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => 80 });
    const view = render(<LockHarness />);

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-80px");

    const pageWheel = new WheelEvent("wheel", { deltaY: 40, cancelable: true, bubbles: true });
    document.querySelector("[data-testid='page']")!.dispatchEvent(pageWheel);
    expect(pageWheel.defaultPrevented).toBe(true);

    view.unmount();

    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");
    expect(scrollTo).toHaveBeenCalledWith(0, 80);
    vi.unstubAllGlobals();
  });

  it("lets the drawer consume a wheel gesture when its list can still scroll", () => {
    const view = render(<LockHarness />);
    const nav = view.container.querySelector("nav")!;
    Object.defineProperty(nav, "scrollHeight", { value: 200, configurable: true });
    Object.defineProperty(nav, "clientHeight", { value: 40, configurable: true });
    Object.defineProperty(nav, "scrollTop", { value: 0, writable: true, configurable: true });

    const menuWheel = new WheelEvent("wheel", { deltaY: 30, cancelable: true, bubbles: true });
    nav.dispatchEvent(menuWheel);
    expect(menuWheel.defaultPrevented).toBe(false);

    view.unmount();
  });
});
