import type {
  AgentMessageResult,
  AgentSendOptions,
  AgentSession,
  WorkflowServeCall,
  WorkflowServeContext,
  WorkflowServeReceive,
} from "eve/tools";
import { z } from "zod";

export const subagentMessageInput = z.object({
  message: z.string().min(1).describe("The message to send to the child agent, with all required context."),
});

type SubagentCall = WorkflowServeCall<z.infer<typeof subagentMessageInput>>;

interface PendingTurn<TOutput> {
  readonly result: Promise<AgentMessageResult<TOutput>>;
  readonly signal: AbortSignal;
}

type NextEvent<TOutput> =
  | { readonly call: SubagentCall; readonly kind: "call" }
  | { readonly kind: "result"; readonly result: AgentMessageResult<TOutput> };

const sendTurn = <TOutput>(
  session: AgentSession,
  call: SubagentCall,
  outputSchema: NonNullable<AgentSendOptions<TOutput>["outputSchema"]>,
): PendingTurn<TOutput> => ({
  result: session
    .send<TOutput>(call.input.message, {
      outputSchema,
      signal: call.abortSignal,
    })
    .then((response) => response.result()),
  signal: call.abortSignal,
});

const nextEvent = async <TOutput>(
  nextCall: Promise<SubagentCall>,
  turn: PendingTurn<TOutput>,
): Promise<NextEvent<TOutput>> =>
  await Promise.race([
    turn.result.then((result) => ({ kind: "result" as const, result })),
    nextCall.then((call) => ({ call, kind: "call" as const })),
  ]);

export const serveSubagentTask = async <TOutput>(
  receive: WorkflowServeReceive<z.infer<typeof subagentMessageInput>>,
  ctx: WorkflowServeContext<TOutput>,
  agentName: string,
  outputSchema: NonNullable<AgentSendOptions<TOutput>["outputSchema"]>,
): Promise<TOutput> => {
  const session = ctx.agent(agentName);
  let turn = sendTurn(session, await receive(), outputSchema);
  let nextCall = receive();

  for (;;) {
    const event = await nextEvent(nextCall, turn);
    if (event.kind === "call") {
      if (turn.signal.aborted) {
        await turn.result.catch(() => undefined);
      }
      turn = sendTurn(session, event.call, outputSchema);
      nextCall = receive();
      continue;
    }

    if (!turn.signal.aborted) {
      const { data, error, status } = event.result;
      if (status === "failed") {
        throw new Error(
          "The agent's turn failed: " + (error?.message ?? "no reason given") +
          "\nThis task has ended; retry without taskId.",
        );
      }

      const pending = receive();
      if (pending !== nextCall) {
        turn = sendTurn(session, await nextCall, outputSchema);
        nextCall = pending;
        continue;
      }

      if (data === undefined) {
        throw new Error(
          "The agent ended its turn without a structured result (status: " + status +
          "). This task has ended; retry without taskId.",
        );
      }
      ctx.reply(data);
    }

    turn = sendTurn(session, await nextCall, outputSchema);
    nextCall = receive();
  }
};
