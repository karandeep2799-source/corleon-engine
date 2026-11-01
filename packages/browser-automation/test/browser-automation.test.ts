import { describe, expect, it, vi } from "vitest";
import type { Page } from "puppeteer";
import {
  BrowserAutomationError,
  createBrowserAutomation,
  type BrowserAction,
} from "../src/index.js";

function makePage(options: { url?: string; safeTarget?: boolean } = {}) {
  const page = {
    url: () => options.url ?? "https://example.com/form",
    evaluate: vi.fn(async () => options.safeTarget ?? true),
    keyboard: {
      press: vi.fn(async () => undefined),
      type: vi.fn(async () => undefined),
    },
    mouse: {
      click: vi.fn(async () => undefined),
      move: vi.fn(async () => undefined),
      wheel: vi.fn(async () => undefined),
    },
  };
  return page as unknown as Page & typeof page;
}

const allActions: BrowserAction[] = [
  "keyboard.press", "keyboard.type", "mouse.click", "mouse.move", "mouse.wheel",
];

describe("Corleon browser automation policy", () => {
  it("requires an explicit host allowlist", () => {
    expect(() => createBrowserAutomation(makePage(), {
      allowedHosts: [],
      enabledActions: allActions,
    })).toThrowError(BrowserAutomationError);
  });

  it("rejects unapproved hosts before sending input", async () => {
    const page = makePage({ url: "https://evil.example/path" });
    const automation = createBrowserAutomation(page, {
      allowedHosts: ["example.com"],
      enabledActions: ["keyboard.press"],
    });
    await expect(automation.pressKey("Enter")).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
    expect(page.keyboard.press).not.toHaveBeenCalled();
  });

  it("presses an allowed key and records a content-free audit event", async () => {
    const page = makePage();
    const audit = vi.fn();
    const automation = createBrowserAutomation(page, {
      allowedHosts: ["example.com"],
      enabledActions: ["keyboard.press"],
      audit,
    });
    await automation.pressKey("Enter", { delay: 10 });
    expect(page.keyboard.press).toHaveBeenCalledWith("Enter", { delay: 10 });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "keyboard.press",
      status: "success",
      metadata: { key: "Enter", delay: 10 },
    }));
  });

  it("blocks arbitrary key strings and out-of-policy delays", async () => {
    const page = makePage();
    const automation = createBrowserAutomation(page, {
      allowedHosts: ["example.com"],
      enabledActions: ["keyboard.press"],
      maxDelayMs: 50,
    });
    await expect(automation.pressKey("Control+Alt+Delete")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(automation.pressKey("Enter", { delay: 51 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("requires explicit approval for configured click actions", async () => {
    const page = makePage();
    const automation = createBrowserAutomation(page, {
      allowedHosts: ["example.com"],
      enabledActions: ["mouse.click"],
      requireApprovalFor: ["mouse.click"],
      approve: async () => false,
    });
    await expect(automation.click(20, 20)).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(page.mouse.click).not.toHaveBeenCalled();
  });

  it("blocks typing into password and payment-card fields", async () => {
    const page = makePage({ safeTarget: false });
    const automation = createBrowserAutomation(page, {
      allowedHosts: ["example.com"],
      enabledActions: ["keyboard.type"],
    });
    await expect(automation.typeText("sensitive")).rejects.toMatchObject({ code: "UNSAFE_FOCUSED_FIELD" });
    expect(page.keyboard.type).not.toHaveBeenCalled();
  });

  it("never writes typed text into audit metadata", async () => {
    const page = makePage({ safeTarget: true });
    const audit = vi.fn();
    const automation = createBrowserAutomation(page, {
      allowedHosts: ["example.com"],
      enabledActions: ["keyboard.type"],
      audit,
    });
    await automation.typeText("hello world");
    expect(page.keyboard.type).toHaveBeenCalledWith("hello world", { delay: 0 });
    expect(JSON.stringify(audit.mock.calls)).not.toContain("hello world");
  });

  it("bounds clicks to the visible viewport", async () => {
    const page = makePage();
    page.evaluate = vi.fn(async () => ({ width: 800, height: 600 })) as never;
    const automation = createBrowserAutomation(page, {
      allowedHosts: ["example.com"],
      enabledActions: ["mouse.click"],
    });
    await expect(automation.click(900, 20)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(page.mouse.click).not.toHaveBeenCalled();
  });

  it("bounds wheel deltas", async () => {
    const page = makePage();
    const automation = createBrowserAutomation(page, {
      allowedHosts: ["example.com"],
      enabledActions: ["mouse.wheel"],
      maxScrollDelta: 300,
    });
    await expect(automation.wheel(0, 301)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await automation.wheel(0, 120);
    expect(page.mouse.wheel).toHaveBeenCalledWith({ deltaX: 0, deltaY: 120 });
  });
});
