import Anthropic from "@anthropic-ai/sdk";

export interface Env {
  ANTHROPIC_API_KEY: string;
  ACCESS_CODE: string;
  ALLOWED_ORIGIN: string;
}

const SYSTEM_PROMPT = "You are Claude, a helpful AI assistant.";
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 16000;

function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-access-code",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }

    const code = request.headers.get("x-access-code");
    if (!env.ACCESS_CODE || code !== env.ACCESS_CODE) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }

    let body: { messages: Anthropic.MessageParam[]; effort?: string };
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400, headers: cors });
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response("messages required", { status: 400, headers: cors });
    }

    const effort = body.effort === "low" || body.effort === "medium" ? body.effort : "high";

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    let stream: ReturnType<typeof client.messages.stream>;
    try {
      stream = client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: body.messages,
        thinking: { type: "adaptive" },
        output_config: { effort },
      });
    } catch (err) {
      return new Response("Failed to start stream", { status: 502, headers: cors });
    }

    const encoder = new TextEncoder();
    const sseBody = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "stream failed";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: { message } })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sseBody, {
      headers: {
        ...cors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  },
};
