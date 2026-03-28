import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { Message } from "@/types/messages";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const {
    messages,
    model = "claude-sonnet-4-6",
    system,
  }: { messages: Message[]; model?: string; system?: string } =
    await req.json();

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    ...(system ? { system } : {}),
    messages,
  });

  return new Response(stream.toReadableStream());
}
