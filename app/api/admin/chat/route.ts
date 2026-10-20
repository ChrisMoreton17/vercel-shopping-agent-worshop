/**
 * Admin chat API route: runs the back-office agent as a durable workflow.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/admin-chat-agent
 */
import { adminChatFlow } from "@/lib/workflows/admin-chat-flow";
import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import { createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { cookies } from "next/headers";
import { start } from "workflow/api";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/admin-auth";

export async function POST(req: Request) {
  // proxy.ts only guards /admin pages; this API returns customer and revenue
  // data, so it checks the same admin cookie itself.
  const store = await cookies();
  if (store.get(ADMIN_COOKIE_NAME)?.value !== ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();
  const run = await start(adminChatFlow, [messages]);
  return createUIMessageStreamResponse({
    stream: run.readable.pipeThrough(createModelCallToUIChunkTransform()),
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}
