/**
 * This is where your agent will live.
 *
 * During the workshop you'll define a `ToolLoopAgent` here, give it a model
 * and instructions, and later add tools (web search, sandbox, etc.). The
 * route handler in `app/api/chat/route.ts` and the `useChat` call in
 * `components/agent-chat.tsx` will both import from this file.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/chat-agent
 */
import {
  hasToolCall,
  isStepCount,
  ToolLoopAgent,
  type InferAgentUIMessage,
  type UIToolInvocation,
} from "ai";
import { shippyInstructions, shippyTools } from "@/lib/shippy";
import type {
  addToCart,
  getProductDetails,
  searchProducts,
  suggestNextActions,
  viewCart,
} from "@/lib/tools";

export const shoppingAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5",
  instructions: shippyInstructions,
  tools: shippyTools,
  // Suggestions are the last thing in a reply, so stop the loop once they're offered.
  stopWhen: [isStepCount(20), hasToolCall("suggestNextActions")],
});

export type ShoppingAgentUIMessage = InferAgentUIMessage<typeof shoppingAgent>;
export type SearchProductsToolInvocation = UIToolInvocation<
  typeof searchProducts
>;
export type ProductDetailsToolInvocation = UIToolInvocation<
  typeof getProductDetails
>;
export type AddToCartToolInvocation = UIToolInvocation<typeof addToCart>;
export type ViewCartToolInvocation = UIToolInvocation<typeof viewCart>;
export type SuggestNextActionsToolInvocation = UIToolInvocation<
  typeof suggestNextActions
>;
