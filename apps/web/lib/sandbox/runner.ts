import { Sandbox } from "@vercel/sandbox";
import { Writable } from "node:stream";
import { MAX_OUTPUT_BYTES, SANDBOX_TIMEOUT_MS, type SandboxJobInput } from "./validation";

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
    write(chunk: Buffer | string, _encoding, callback) {
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
  return { stream, read: () => Buffer.concat(chunks).toString("utf8") };
}

/**
 * Executes user code in an ephemeral Firecracker microVM.
 * No application environment variables, credentials, package installation, or
 * network access are provided to the guest. The guest receives only its source file.
 */
export async function executeSandboxCode(input: SandboxJobInput): Promise<SandboxExecutionResult> {
  const startedAt = Date.now();
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined;

  try {
    sandbox = await Sandbox.create({
      image: "vercel/sandbox/universal:latest",
      timeout: SANDBOX_TIMEOUT_MS,
      resources: { vcpus: 1 },
      networkPolicy: "deny-all",
    });

    const filename = input.runtime === "node" ? "main.mjs" : "main.py";
    await sandbox.writeFiles([
      { path: filename, content: Buffer.from(input.code, "utf8") },
    ]);

    const stdout = boundedCollector(MAX_OUTPUT_BYTES);
    const stderr = boundedCollector(MAX_OUTPUT_BYTES);
    const command = input.runtime === "node" ? "node" : "python3.14";
    const args = input.runtime === "node"
      ? ["--disable-proto=throw", filename]
      : ["-I", filename];

    const result = await sandbox.runCommand({
      cmd: command,
      args,
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
        // Cleanup is best-effort; the platform also expires the sandbox at timeout.
      }
    }
  }
}
