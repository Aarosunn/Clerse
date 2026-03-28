import { Message, TextContent, ImageContent } from "@/types/messages";

export function buildUserMessage(text: string): Message {
  return { role: "user", content: [{ type: "text", text }] };
}

export function buildAssistantMessage(text: string): Message {
  return { role: "assistant", content: [{ type: "text", text }] };
}

export function buildImageMessage(
  base64: string,
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
  text?: string
): Message {
  const content: (TextContent | ImageContent)[] = [
    { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
  ];
  if (text) content.push({ type: "text", text });
  return { role: "user", content };
}

export function getTextContent(content: Message["content"]): string {
  const part = content.find((c): c is TextContent => c.type === "text");
  return part?.text ?? "";
}
