import { WorkflowAgent, type ModelCallStreamPart } from "@ai-sdk/workflow";
import { getWritable } from "workflow";
import {
  convertToModelMessages,
  hasToolCall,
  isStepCount,
  type UIMessage,
} from "ai";
import { shippyInstructions, shippyTools } from "@/lib/shippy";

export async function chatFlow(messages: UIMessage[], cartToken: string) {
  "use workflow";

  const modelMessages = await convertToModelMessages(messages);

  const agent = new WorkflowAgent({
    model: "anthropic/claude-sonnet-5",
    instructions: shippyInstructions,
    tools: shippyTools,
    toolsContext: {
      addToCart: { cartToken },
      viewCart: { cartToken },
    },
  });

  await agent.stream({
    messages: modelMessages,
    writable: getWritable<ModelCallStreamPart>(),
    // WorkflowAgent has no default step limit. Suggestions end a reply.
    stopWhen: [isStepCount(20), hasToolCall("suggestNextActions")],
  });
}
