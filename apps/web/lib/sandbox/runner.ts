import { Sandbox } from "@vercel/sandbox";
import { Writable } from "node:stream";
import {
  MAX_OUTPUT_BYTES,
  type SandboxJobInput,
} from "./validation";

export interface SandboxExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

function boundedCollector(limit: number): { stream: Writable; read: () => string } {
  const chunks: Buffer[] = [];
  let bytes = 0;

  const stream = new Writable({
    write(chunk: Buffer | string, _encoding: BufferEncoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = limit - bytes;
      if (remaining > 0) {
        const accepted = buffer.subarray(0, remaining);
        chunks.push(accepted);
        bytes += accepted.length;
      }
      callback();
    },
  });

  return {
    stream,
    read: () => Buffer.concat(chunks).toString("utf8"),
  };
}

/**
 * Run untrusted source in a one-off Firecracker microVM.
 * The guest receives no application secrets and has no network egress.
 */
export async function executeSandboxCode(
  input: SandboxJobInput,
): Promise<SandboxExecutionResult> {
  const startedAt = Date.now();
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined;

  try {
    const authOptions =
      process.env.VERCEL_OIDC_TOKEN
        ? {}
        : process.env.VERCEL_TOKEN &&
            process.env.VERCEL_TEAM_ID &&
            process.env.VERCEL_PROJECT_ID
          ? {
              token: process.env.VERCEL_TOKEN,
              teamId: process.env.VERCEL_TEAM_ID,
              projectId: process.env.VERCEL_PROJECT_ID,
            }
          : {};

    sandbox = await Sandbox.create({
      image: "vercel/sandbox/universal",
      persistent: false,
      timeout: input.timeoutMs,
      resources: { vcpus: 1 },
      networkPolicy: "deny-all",
      ...authOptions,
    });

    const filename = input.runtime === "node" ? "main.mjs" : "main.py";
    await sandbox.writeFiles([
      { path: filename, content: Buffer.from(input.code, "utf8") },
    ]);

    const stdout = boundedCollector(MAX_OUTPUT_BYTES);
    const stderr = boundedCollector(MAX_OUTPUT_BYTES);
    const command = input.runtime === "node" ? "node" : "python3";
    const args = input.runtime === "node"
      ? ["--disable-proto=throw", "/vercel/sandbox/main.mjs"]
      : ["-I", "/vercel/sandbox/main.py"];

    const result = await sandbox.runCommand({
      cmd: command,
      args,
      cwd: "/vercel/sandbox",
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    return {
      exitCode: result.exitCode,
      stdout: stdout.read(),
      stderr: stderr.read(),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch {
        // The platform also enforces the session timeout; cleanup is best-effort.
      }
    }
  }
}
