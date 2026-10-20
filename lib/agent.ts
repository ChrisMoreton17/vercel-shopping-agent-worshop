/**
 * UI types for the shopping agent.
 *
 * The agent itself now runs durably as a WorkflowAgent in
 * `lib/workflows/chat-flow.ts`, with its prompt and tools in `lib/shippy.ts`.
 * These types are derived from that shared tool set so the chat UI's
 * `useChat` call and tool-part components stay in sync with it.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/workflows
 */
import type { InferUITools, UIMessage, UIToolInvocation } from "ai";
import type { shippyTools } from "@/lib/shippy";
import type {
  addToCart,
  getProductDetails,
  searchProducts,
  suggestNextActions,
  viewCart,
} from "@/lib/tools";

export type ShoppingAgentUIMessage = UIMessage<
  unknown,
  never,
  InferUITools<typeof shippyTools>
>;
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
