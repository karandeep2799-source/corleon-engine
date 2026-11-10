export declare const CHROME_DEVTOOLS_MCP_PACKAGE: string;
export declare const CHROME_DEVTOOLS_MCP_VERSION: string;
export declare const CHROME_DEVTOOLS_TOOL_POLICY: Readonly<Record<string, string>>;

export declare function getChromeDevToolsPolicyId(upstreamToolName: string): string;

export declare function authorizeChromeDevToolsTool(
  upstreamToolName: string,
  options?: { production?: boolean },
): {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
};

export declare function createChromeDevToolsMcpServerDefinition(options?: {
  configPath?: string;
}): {
  command: string;
  args: readonly string[];
  transport: "stdio";
  trust: "local-development-only";
};
