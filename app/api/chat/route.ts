/**
 * This is where the chat API route will live.
 *
 * During the workshop you'll wire this up to the agent in `lib/agent.ts`
 * using `createAgentUIStreamResponse` from the AI SDK. The chat panel in
 * `components/agent-chat.tsx` posts here once you swap its placeholder
 * `useState` for `useChat`.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/chat-agent
 */
import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { start } from "workflow/api";
import { getOrCreateCartToken } from "@/lib/cart-token";
import { chatFlow } from "@/lib/workflows/chat-flow";

export const POST = async (req: Request) => {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Cart tools run as workflow steps, outside this request, so they can't read
  // the cookie. Resolve (or create) the cart here and pass the token in.
  const cartToken = await getOrCreateCartToken();

  const run = await start(chatFlow, [messages, cartToken]);

  return createUIMessageStreamResponse({
    stream: run.readable.pipeThrough(createModelCallToUIChunkTransform()),
    headers: { "x-workflow-run-id": run.runId },
  });
};
