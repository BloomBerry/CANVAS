import Anthropic from "@anthropic-ai/sdk";
import * as AnthropicMessages from "@anthropic-ai/sdk/resources/messages";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  ModelConfig,
  CallToolRequestParams,
  GenericMessage,
  ContentType,
  AgentRequestMessage,
  RoleType,
  MessageType,
} from "../types";
import { ModelInstance } from "./modelInstance";

/** Claude via Anthropic API (ANTHROPIC_API_KEY). Use this instead of Bedrock if you have an Anthropic API key. */
export class AnthropicModel extends ModelInstance {
  private client: Anthropic;

  constructor(config: ModelConfig) {
    super(config);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is required for Anthropic (direct API) models. Set it in .env"
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  async generateResponse(
    messages: AnthropicMessages.MessageParam[],
    options: Partial<AnthropicMessages.MessageCreateParams> = {}
  ): Promise<AnthropicMessages.Messages.Message> {
    return await this.client.messages.create({
      model: this.modelName,
      messages,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      ...options,
      stream: false,
    });
  }

  async generateResponseWithTool(
    messages: AnthropicMessages.MessageParam[],
    tools: AnthropicMessages.Tool[],
    options: Partial<AnthropicMessages.MessageCreateParams> = {}
  ): Promise<AnthropicMessages.Messages.Message> {
    return await this.client.messages.create({
      model: this.modelName,
      messages,
      tools,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      ...options,
      stream: false,
    });
  }

  formatRequest(messages: GenericMessage[]): AnthropicMessages.MessageParam[] {
    if (!messages?.length) throw new Error("No messages provided");

    return messages.map((msg) => {
      const role =
        msg.role === "system" ? "user" : (msg.role as "user" | "assistant");
      const content = msg.content.map((item) => {
        switch (item.type) {
          case ContentType.TEXT:
            return { type: "text" as const, text: item.text };
          case ContentType.IMAGE: {
            const imageData = item as any;
            if (
              !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
                imageData.mimeType
              )
            ) {
              throw new Error(`Unsupported image type: ${imageData.mimeType}`);
            }
            return {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: imageData.mimeType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: this.formatImageData(imageData.data),
              },
            };
          }
          default:
            throw new Error(`Unsupported content type: ${item.type}`);
        }
      });

      return { role, content };
    });
  }

  formatCallToolRequest(
    message: AnthropicMessages.Messages.Message
  ): CallToolRequestParams[] {
    const messageContent = message.content;
    if (!Array.isArray(messageContent)) return [];

    return messageContent
      .filter((c: any) => c.type === "tool_use")
      .map((c: any) => ({
        id: c.id,
        call_id: "",
        name: c.name,
        arguments: c.input ?? {},
      }));
  }

  formatToolResponse(
    result: CallToolResult
  ): AnthropicMessages.MessageParam {
    const textJSON = JSON.stringify({
      content: result.content,
      structuredContent: result.structuredContent ?? {},
    });

    return {
      role: "user",
      content: [
        {
          type: "tool_result" as const,
          tool_use_id: result.id,
          content: textJSON,
        } as AnthropicMessages.ToolResultBlockParam,
      ],
    };
  }

  formatToolList(
    tools: Awaited<ReturnType<Client["listTools"]>>["tools"]
  ): AnthropicMessages.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
      input_schema: tool.inputSchema ?? {
        type: "object",
        properties: {},
        required: [],
      },
    }));
  }

  formatResponseToIntermediateRequestMessage(
    response: AnthropicMessages.Messages.Message
  ): GenericMessage {
    if (!response || !response.content) {
      throw new Error("Invalid response format");
    }
    const textContent = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");

    return {
      id: response.id,
      timestamp: Date.now(),
      type: MessageType.INTERMEDIATE_REQUEST,
      role: RoleType.USER,
      content: [{ type: ContentType.TEXT, text: textContent }],
    } as GenericMessage;
  }

  createMessageContext(): AnthropicMessages.MessageParam[] {
    return [];
  }

  addToApiMessageContext(
    response: AnthropicMessages.Messages.Message,
    context: AnthropicMessages.MessageParam[]
  ): void {
    context.push({
      role: response.role,
      content: response.content,
    });
  }

  addToFormattedMessageContext(
    response: AnthropicMessages.Messages.Message,
    type: MessageType,
    context: GenericMessage[]
  ): void {
    const textContent = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");

    context.push({
      id: response.id,
      timestamp: Date.now(),
      type,
      role: RoleType.ASSISTANT,
      content: [{ type: ContentType.TEXT, text: textContent }],
      calls: this.formatCallToolRequest(response),
    } as AgentRequestMessage);
  }

  getCostFromResponse(response: AnthropicMessages.Messages.Message): number {
    return (
      response.usage.input_tokens * this.inputCost +
      response.usage.output_tokens * this.outputCost
    );
  }

  formatImageData(imageData: string, mimeType: string = "image/png"): string {
    return imageData.replace(/^data:image\/[^;]+;base64,/, "");
  }
}
