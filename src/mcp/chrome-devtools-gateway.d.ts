export interface ChromeDevToolsGatewayIdentity {
  tenantId: string;
  actorId: string;
  sessionId: string;
}

export interface ChromeDevToolsGatewayAuditEvent {
  eventId: string;
  occurredAt: string;
  tenantId: string;
  actorId: string;
  sessionId: string;
  action: string;
  outcome: string;
  toolName?: string;
  actionDigest?: string;
  approvalRequired?: boolean;
  policyReason?: string;
}

export interface ChromeDevToolsGatewayResponse {
  jsonrpc?: string;
  id?: string | number | null;
  result?: { [key: string]: any };
  error?: { code: number; message: string };
  [key: string]: unknown;
}

export interface ChromeDevToolsGatewayWorker {
  request(message: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  close(): Promise<void>;
}

export interface ChromeDevToolsGatewayOptions {
  identity: ChromeDevToolsGatewayIdentity;
  worker: ChromeDevToolsGatewayWorker;
  audit(event: ChromeDevToolsGatewayAuditEvent): Promise<void>;
  consumeApproval?(input: {
    identity: ChromeDevToolsGatewayIdentity;
    toolName: string;
    actionDigest: string;
    approvalToken: string;
  }): Promise<boolean>;
  authorize?(toolName: string, options: { production: boolean }): {
    allowed: boolean;
    requiresApproval: boolean;
    reason?: string;
  } | Promise<{
    allowed: boolean;
    requiresApproval: boolean;
    reason?: string;
  }>;
  production?: boolean;
  maxMessageBytes?: number;
}

export declare function createChromeDevToolsGateway(options: ChromeDevToolsGatewayOptions): {
  readonly identity: Readonly<ChromeDevToolsGatewayIdentity>;
  handle(message: Record<string, unknown>): Promise<ChromeDevToolsGatewayResponse | null>;
  close(): Promise<void>;
};
