import { assertToolAllowed } from "./policy.js";

export const CHROME_DEVTOOLS_MCP_PACKAGE = "chrome-devtools-mcp";
export const CHROME_DEVTOOLS_MCP_VERSION = "1.12.0";

/**
 * Canonical upstream tool names mapped to Corleon's stable policy IDs.
 * Unknown upstream tools are denied by the shared policy engine.
 */
export const CHROME_DEVTOOLS_TOOL_POLICY = Object.freeze({
  list_pages: "browser.pages.read",
  take_snapshot: "browser.snapshot.read",
  take_screenshot: "browser.screenshot.read",
  list_console_messages: "browser.console.read",
  get_console_message: "browser.console.read",
  get_css_styles: "browser.styles.read",
  list_network_requests: "browser.network.read",
  get_network_request: "browser.network.read",
  performance_analyze_insight: "browser.performance.read",
  performance_start_trace: "browser.performance.read",
  performance_stop_trace: "browser.performance.read",
  lighthouse_audit: "browser.performance.read",

  navigate_page: "browser.navigation.navigate",
  new_page: "browser.navigation.navigate",
  close_page: "browser.navigation.navigate",
  select_page: "browser.navigation.navigate",
  wait_for: "browser.navigation.navigate",

  click: "browser.input.interact",
  drag: "browser.input.interact",
  fill: "browser.input.interact",
  fill_form: "browser.input.interact",
  handle_dialog: "browser.input.interact",
  hover: "browser.input.interact",
  press_key: "browser.input.interact",
  type_text: "browser.input.interact",
  click_at: "browser.input.interact",

  upload_file: "browser.file.upload",
  evaluate_script: "browser.script.evaluate",
  take_heapsnapshot: "browser.memory.inspect",
  analyze_heapsnapshot_contexts: "browser.memory.inspect",
  close_heapsnapshot: "browser.memory.inspect",
  compare_heapsnapshots: "browser.memory.inspect",
  get_heapsnapshot_class_nodes: "browser.memory.inspect",
  get_heapsnapshot_details: "browser.memory.inspect",
  get_heapsnapshot_dominators: "browser.memory.inspect",
  get_heapsnapshot_duplicate_strings: "browser.memory.inspect",
  get_heapsnapshot_edges: "browser.memory.inspect",
  get_heapsnapshot_object_details: "browser.memory.inspect",
  get_heapsnapshot_retainers: "browser.memory.inspect",
  get_heapsnapshot_retaining_paths: "browser.memory.inspect",
  get_heapsnapshot_summary: "browser.memory.inspect",
  query_heapsnapshot_objects: "browser.memory.inspect",

  install_extension: "browser.extensions.manage",
  list_extensions: "browser.extensions.read",
  reload_extension: "browser.extensions.manage",
  trigger_extension_action: "browser.extensions.manage",
  uninstall_extension: "browser.extensions.manage",

  execute_3p_developer_tool: "browser.third_party.execute",
  list_3p_developer_tools: "browser.third_party.read",
  execute_webmcp_tool: "browser.webmcp.execute",
  list_webmcp_tools: "browser.webmcp.read",

  get_os_app_state: "browser.pwa.read",
  install_pwa: "browser.pwa.manage",
  launch_pwa: "browser.pwa.manage",
  uninstall_pwa: "browser.pwa.manage",
  configure_webauthn: "browser.webauthn.manage",
});

export function getChromeDevToolsPolicyId(upstreamToolName) {
  return CHROME_DEVTOOLS_TOOL_POLICY[upstreamToolName] ?? "browser.unknown";
}

export function authorizeChromeDevToolsTool(upstreamToolName, options = {}) {
  return assertToolAllowed(getChromeDevToolsPolicyId(upstreamToolName), options);
}

/**
 * Returns a local stdio MCP client definition. The package version is pinned;
 * no browser endpoint, profile, credential, or WebSocket token is embedded.
 */
export function createChromeDevToolsMcpServerDefinition({
  configPath = "config/mcp/chrome-devtools-server.json",
} = {}) {
  if (typeof configPath !== "string" || configPath.length === 0 || configPath.startsWith("/")) {
    throw new TypeError("configPath must be a non-empty repository-relative path.");
  }

  return Object.freeze({
    command: "npx",
    args: Object.freeze([
      "--yes",
      `${CHROME_DEVTOOLS_MCP_PACKAGE}@${CHROME_DEVTOOLS_MCP_VERSION}`,
      `--config=${configPath}`,
      "--no-javascript-evaluation",
      "--no-usage-statistics",
      "--no-update-checks",
      "--no-performance-crux",
    ]),
    transport: "stdio",
    trust: "local-development-only",
  });
}
