import type { Page } from "puppeteer";

export type BrowserAction =
  | "keyboard.press"
  | "keyboard.type"
  | "mouse.click"
  | "mouse.move"
  | "mouse.wheel";

export type BrowserActionStatus = "success" | "denied" | "error";

export interface BrowserAuditEntry {
  action: BrowserAction;
  host: string;
  status: BrowserActionStatus;
  metadata: Readonly<Record<string, string | number | boolean>>;
  occurredAt: string;
}

export interface BrowserAutomationPolicy {
  /** Exact hostnames or wildcard suffixes such as "*.example.com". */
  allowedHosts: readonly string[];
  /** Actions explicitly enabled for this session. Default: none. */
  enabledActions: readonly BrowserAction[];
  /** Actions that must receive a positive approval callback before execution. */
  requireApprovalFor?: readonly BrowserAction[];
  maxTextLength?: number;
  maxDelayMs?: number;
  maxScrollDelta?: number;
  approve?: (action: BrowserAction, metadata: Readonly<Record<string, string | number | boolean>>) => Promise<boolean>;
  audit?: (entry: BrowserAuditEntry) => void | Promise<void>;
}

export interface BrowserAutomation {
  pressKey(key: string, options?: { delay?: number }): Promise<void>;
  typeText(text: string, options?: { delay?: number }): Promise<void>;
  click(x: number, y: number, options?: { button?: "left" | "right" | "middle"; clickCount?: 1 | 2 }): Promise<void>;
  move(x: number, y: number, options?: { steps?: number }): Promise<void>;
  wheel(deltaX: number, deltaY: number): Promise<void>;
}

export class BrowserAutomationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_INPUT"
      | "HOST_NOT_ALLOWED"
      | "ACTION_DISABLED"
      | "APPROVAL_REQUIRED"
      | "UNSAFE_FOCUSED_FIELD"
      | "VIEWPORT_UNAVAILABLE",
  ) {
    super(message);
    this.name = "BrowserAutomationError";
  }
}

const SAFE_KEYS = new Set([
  "Enter", "Tab", "Escape", "Backspace", "Delete", "Insert",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Home", "End", "PageUp", "PageDown", "Space",
  "Shift", "Control", "Alt", "Meta",
  ...Array.from({ length: 12 }, (_, index) => `F${index + 1}`),
]);

function isSafeKey(key: string): boolean {
  return SAFE_KEYS.has(key) || /^[a-zA-Z0-9]$/.test(key);
}

function matchesHost(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1).toLowerCase();
    return host.toLowerCase().endsWith(suffix) && host.toLowerCase() !== suffix.slice(1);
  }
  return host.toLowerCase() === pattern.toLowerCase();
}

function finiteCoordinate(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function createBrowserAutomation(
  page: Page,
  policy: BrowserAutomationPolicy,
): BrowserAutomation {
  const maxTextLength = policy.maxTextLength ?? 2_000;
  const maxDelayMs = policy.maxDelayMs ?? 250;
  const maxScrollDelta = policy.maxScrollDelta ?? 1_000;
  const requiredApprovals = new Set(policy.requireApprovalFor ?? []);
  const enabledActions = new Set(policy.enabledActions);

  if (policy.allowedHosts.length === 0) {
    throw new BrowserAutomationError("At least one allowed host is required.", "INVALID_INPUT");
  }
  if (!Number.isInteger(maxTextLength) || maxTextLength < 1 || maxTextLength > 20_000) {
    throw new BrowserAutomationError("maxTextLength must be between 1 and 20000.", "INVALID_INPUT");
  }

  async function currentHost(): Promise<string> {
    let url: URL;
    try {
      url = new URL(page.url());
    } catch {
      throw new BrowserAutomationError("The browser page has no valid URL.", "HOST_NOT_ALLOWED");
    }

    const localHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1");
    if (url.protocol !== "https:" && !localHttp) {
      throw new BrowserAutomationError("Only HTTPS pages and local development origins are allowed.", "HOST_NOT_ALLOWED");
    }
    if (!policy.allowedHosts.some((allowed) => matchesHost(url.hostname, allowed))) {
      throw new BrowserAutomationError("The current page host is not allowlisted.", "HOST_NOT_ALLOWED");
    }
    return url.hostname;
  }

  async function run<T>(
    action: BrowserAction,
    metadata: Readonly<Record<string, string | number | boolean>>,
    operation: () => Promise<T>,
  ): Promise<T> {
    const host = await currentHost();
    if (!enabledActions.has(action)) {
      await policy.audit?.({ action, host, status: "denied", metadata, occurredAt: new Date().toISOString() });
      throw new BrowserAutomationError(`Action ${action} is disabled by policy.`, "ACTION_DISABLED");
    }
    if (requiredApprovals.has(action)) {
      const approved = await policy.approve?.(action, metadata);
      if (approved !== true) {
        await policy.audit?.({ action, host, status: "denied", metadata, occurredAt: new Date().toISOString() });
        throw new BrowserAutomationError(`Action ${action} requires explicit approval.`, "APPROVAL_REQUIRED");
      }
    }

    try {
      const result = await operation();
      await policy.audit?.({ action, host, status: "success", metadata, occurredAt: new Date().toISOString() });
      return result;
    } catch (error) {
      await policy.audit?.({ action, host, status: "error", metadata, occurredAt: new Date().toISOString() });
      throw error;
    }
  }

  function validateDelay(delay: number | undefined): number {
    const value = delay ?? 0;
    if (!Number.isInteger(value) || value < 0 || value > maxDelayMs) {
      throw new BrowserAutomationError(`delay must be an integer between 0 and ${maxDelayMs}ms.`, "INVALID_INPUT");
    }
    return value;
  }

  async function viewport(): Promise<{ width: number; height: number }> {
    const size = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    if (size.width <= 0 || size.height <= 0) {
      throw new BrowserAutomationError("Could not determine a usable browser viewport.", "VIEWPORT_UNAVAILABLE");
    }
    return size;
  }

  return {
    async pressKey(key, options = {}) {
      if (!isSafeKey(key)) {
        throw new BrowserAutomationError("Unsupported key. Use a single alphanumeric key or an approved navigation key.", "INVALID_INPUT");
      }
      const delay = validateDelay(options.delay);
      await run("keyboard.press", { key, delay }, async () => {
        await page.keyboard.press(key as Parameters<Page["keyboard"]["press"]>[0], { delay });
      });
    },

    async typeText(value, options = {}) {
      if (typeof value !== "string" || value.length === 0 || value.length > maxTextLength) {
        throw new BrowserAutomationError(`Text must contain 1-${maxTextLength} characters.`, "INVALID_INPUT");
      }
      const delay = validateDelay(options.delay);
      await run("keyboard.type", { characterCount: value.length, delay }, async () => {
        const safeTarget = await page.evaluate(() => {
          const active = document.activeElement;
          if (!(active instanceof HTMLInputElement)) return true;
          const autocomplete = active.autocomplete.toLowerCase();
          return active.type !== "password" &&
            !autocomplete.includes("password") &&
            !autocomplete.startsWith("cc-");
        });
        if (!safeTarget) {
          throw new BrowserAutomationError("Typing into password or payment-card fields is blocked.", "UNSAFE_FOCUSED_FIELD");
        }
        await page.keyboard.type(value, { delay });
      });
    },

    async click(x, y, options = {}) {
      const button = options.button ?? "left";
      const clickCount = options.clickCount ?? 1;
      if (!finiteCoordinate(x) || !finiteCoordinate(y) || !["left", "right", "middle"].includes(button) || ![1, 2].includes(clickCount)) {
        throw new BrowserAutomationError("Invalid mouse click coordinates or options.", "INVALID_INPUT");
      }
      await run("mouse.click", { x, y, button, clickCount }, async () => {
        const size = await viewport();
        if (x >= size.width || y >= size.height) {
          throw new BrowserAutomationError("Mouse click is outside the visible viewport.", "INVALID_INPUT");
        }
        await page.mouse.click(x, y, { button, clickCount });
      });
    },

    async move(x, y, options = {}) {
      const steps = options.steps ?? 1;
      if (!finiteCoordinate(x) || !finiteCoordinate(y) || !Number.isInteger(steps) || steps < 1 || steps > 100) {
        throw new BrowserAutomationError("Invalid mouse movement coordinates or steps.", "INVALID_INPUT");
      }
      await run("mouse.move", { x, y, steps }, async () => {
        const size = await viewport();
        if (x >= size.width || y >= size.height) {
          throw new BrowserAutomationError("Mouse movement target is outside the visible viewport.", "INVALID_INPUT");
        }
        await page.mouse.move(x, y, { steps });
      });
    },

    async wheel(deltaX, deltaY) {
      if (
        !Number.isFinite(deltaX) ||
        !Number.isFinite(deltaY) ||
        Math.abs(deltaX) > maxScrollDelta ||
        Math.abs(deltaY) > maxScrollDelta
      ) {
        throw new BrowserAutomationError(`Scroll deltas must be within ±${maxScrollDelta}.`, "INVALID_INPUT");
      }
      await run("mouse.wheel", { deltaX, deltaY }, async () => {
        await page.mouse.wheel({ deltaX, deltaY });
      });
    },
  };
}
