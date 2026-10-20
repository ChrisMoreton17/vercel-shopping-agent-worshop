"use client";

/**
 * Welcome! This is the chat panel you will edit for the workshop!
 *
 * During the workshop you'll connect it to a real agent: swap the
 * local `useState` for `useChat` from the AI SDK, point the form
 * at `sendMessage`, and render each message's `parts` inside
 * `<ConversationContent>`.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/chat-agent
 */
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import { ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { useCart } from "@/components/cart-provider";
import type { ShoppingAgentUIMessage } from "@/lib/agent";
import { AgentCartCard } from "./agent-cart-card";
import { AgentProductCard } from "./agent-product-card";
import { AgentProductList } from "./agent-product-list";

export function AgentChat() {
  const [input, setInput] = useState("");

  const activeRunId = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem("active-workflow-run-id") ?? undefined;
  }, []);

  const { messages, error, status, sendMessage } =
    useChat<ShoppingAgentUIMessage>({
      // Resume a response that was still streaming when the page was left.
      resume: Boolean(activeRunId),
      transport: new WorkflowChatTransport({
        api: "/api/chat",
        onChatSendMessage: (response) => {
          const runId = response.headers.get("x-workflow-run-id");
          if (runId) localStorage.setItem("active-workflow-run-id", runId);
        },
        onChatEnd: () => localStorage.removeItem("active-workflow-run-id"),
        prepareReconnectToStreamRequest: ({ api, ...rest }) => {
          const runId = localStorage.getItem("active-workflow-run-id");
          if (!runId) throw new Error("No active workflow run ID found");
          return {
            ...rest,
            api: `/api/chat/${encodeURIComponent(runId)}/stream`,
          };
        },
      }),
    });

  // Buttons inside cards and suggestion chips send text as if the user typed it.
  const ask = (text: string) => sendMessage({ text });

  const { itemCount } = useCart();

  const handleSubmit = (message: PromptInputMessage) => {
    sendMessage({ text: input });
    setInput("");
  };

  if (error) return <div>{error.message}</div>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((m, mi) =>
            m.parts.map((p, i) => {
              switch (p.type) {
                case "text":
                  return (
                    <Message key={`${m.id}-${i}`} from={m.role}>
                      <MessageContent>
                        <MessageResponse>{p.text}</MessageResponse>
                      </MessageContent>
                    </Message>
                  );
                case "tool-searchProducts":
                  return (
                    <AgentProductList
                      key={`${m.id}-${i}`}
                      invocation={p}
                      onAsk={ask}
                    />
                  );
                case "tool-getProductDetails":
                  return (
                    <AgentProductCard key={`${m.id}-${i}`} invocation={p} />
                  );
                case "tool-addToCart":
                  return (
                    <AgentCartCard
                      key={`${m.id}-${i}`}
                      invocation={p}
                      title="Added to your cart"
                    />
                  );
                case "tool-viewCart":
                  return (
                    <AgentCartCard
                      key={`${m.id}-${i}`}
                      invocation={p}
                      title="Your cart"
                    />
                  );
                case "tool-suggestNextActions": {
                  // Only the latest reply's suggestions are actionable.
                  const isLatest = mi === messages.length - 1;
                  const suggestions = p.input?.suggestions;
                  if (!isLatest || status !== "ready" || !suggestions?.length)
                    return null;
                  return (
                    <Suggestions key={`${m.id}-${i}`}>
                      {suggestions.map((s) =>
                        s ? (
                          <Suggestion key={s} suggestion={s} onClick={ask} />
                        ) : null,
                      )}
                    </Suggestions>
                  );
                }
                default:
                  return null;
              }
            }),
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="Ask the agent"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton
                onClick={() => ask("Show me my cart")}
                disabled={status !== "ready"}
                tooltip="Show your cart in the chat"
              >
                <ShoppingCart />
                <span>Cart ({itemCount})</span>
              </PromptInputButton>
            </PromptInputTools>
            <PromptInputSubmit status={status} disabled={!input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
