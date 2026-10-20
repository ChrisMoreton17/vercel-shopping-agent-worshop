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
import { createAgentUIStreamResponse } from "ai";
import { shoppingAgent } from "@/lib/agent";
import { getOrCreateCartToken } from "@/lib/cart-token";

export const POST = async (req: Request) => {
  const { messages } = await req.json();

  // The addToCart tool runs mid-stream, after headers are sent, so it can't
  // set the cart cookie itself. Make sure one exists before streaming.
  await getOrCreateCartToken();

  return createAgentUIStreamResponse({
    agent: shoppingAgent,
    uiMessages: messages,
  });
};
