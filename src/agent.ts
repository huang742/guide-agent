import OpenAI from "openai";
import { GENERATOR_SYSTEM_PROMPT, REVIEWER_SYSTEM_PROMPT } from "./prompts.js";
import { ALL_SCHEMAS, type GuideType } from "./templates/index.js";
import { getParser, type ArgumentParser } from "./parsers.js";

// ---- Types -----------------------------------------------------------------

export interface GenerateInput {
  game: string;           // 游戏名，如 "Elden Ring / 艾尔登法环"
  type: GuideType;        // boss_guide | build_guide | walkthrough
  target?: string;        // Boss名 / Build名 / 留空
  style?: "detailed" | "concise" | "beginner";
}

export interface ReviewResult {
  accuracy:      { score: number; issues: string[] };
  completeness:  { score: number; issues: string[] };
  actionability: { score: number; issues: string[] };
  readability:   { score: number; issues: string[] };
  overall_score: number;
  verdict:       "pass" | "needs_revision" | "reject";
  summary:       string;
}

export interface GenerateResult {
  guide: Record<string, unknown>;   // 生成的攻略数据（结构化 JSON）
  review: ReviewResult;             // 审查结果
  revised: boolean;                 // 是否经过重试
}

// ---- Agent -----------------------------------------------------------------

export interface AgentConfig {
  apiKey?: string;
  baseURL?: string;
  /** Which parser provider to use: "deepseek" | "openai" | custom registered name */
  parserProvider?: string;
}

export class GuideAgent {
  private openai: OpenAI;
  private parser: ArgumentParser;

  constructor(config: AgentConfig = {}) {
    this.openai = new OpenAI({
      apiKey: config.apiKey ?? process.env.DEEPSEEK_API_KEY,
      baseURL: config.baseURL ?? "https://api.deepseek.com",
    });
    this.parser = getParser(config.parserProvider ?? "deepseek");
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const schema = ALL_SCHEMAS[input.type];
    if (!schema) throw new Error(`Unknown guide type: ${input.type}`);

    // Step 1: Generate
    const userMessage = this.buildUserMessage(input);
    const generated = await this.callGenerator(userMessage, schema);

    // Step 2: Review
    const review = await this.callReviewer(generated);

    // Step 3: Handle verdict
    if (review.verdict === "pass") {
      return { guide: generated, review, revised: false };
    }

    if (review.verdict === "reject") {
      return { guide: generated, review, revised: false };
      // Caller should check review.verdict and decide not to publish
    }

    // needs_revision: retry once
    const revisionMessage = this.buildRevisionMessage(userMessage, review);
    const revised = await this.callGenerator(revisionMessage, schema);
    const reviewV2 = await this.callReviewer(revised);

    return {
      guide: reviewV2.verdict === "reject" ? generated : revised,
      review: reviewV2,
      revised: true,
    };
  }

  // ---- Revise with user feedback -------------------------------------------

  /** Regenerate based on human feedback. */
  async revise(originalInput: GenerateInput, feedback: string): Promise<GenerateResult> {
    const schema = ALL_SCHEMAS[originalInput.type];
    if (!schema) throw new Error(`Unknown guide type: ${originalInput.type}`);

    // Build message that includes original intent + user feedback
    let userMessage = this.buildUserMessage(originalInput);
    userMessage += `\n\n⚠ 用户审阅后提出以下修改意见，请根据意见重新生成攻略：\n${feedback}\n请务必全部采纳上述意见，并保持中文输出。`;

    const revised = await this.callGenerator(userMessage, schema);
    const review = await this.callReviewer(revised);

    return {
      guide: revised,
      review,
      revised: true,
    };
  }

  // ---- Revise from existing content ---------------------------------------

  /**
   * Regenerate based on existing guide content + human feedback.
   * Used when the user loads a saved guide file and wants to improve it.
   */
  async reviseFromContent(
    guideContent: string,
    feedback: string,
    game: string,
    type: GuideType,
  ): Promise<GenerateResult> {
    const schema = ALL_SCHEMAS[type];
    if (!schema) throw new Error(`Unknown guide type: ${type}`);

    const userMessage = [
      `游戏：${game}`,
      `攻略类型：${type}`,
      ``,
      `以下是现有的攻略内容：`,
      `---`,
      guideContent.slice(0, 6000), // truncate to save tokens
      `---`,
      ``,
      `⚠ 用户审阅后提出以下修改意见，请根据意见重新生成攻略：`,
      feedback,
      `请务必全部采纳上述意见，保持中文输出，并保持与原攻略相同的结构和完整度。`,
    ].join("\n");

    const revised = await this.callGenerator(userMessage, schema);
    const review = await this.callReviewer(revised);

    return {
      guide: revised,
      review,
      revised: true,
    };
  }

  // ---- Private helpers ------------------------------------------------------

  private buildUserMessage(input: GenerateInput): string {
    const parts: string[] = [
      `游戏：${input.game}`,
      `攻略类型：${input.type}`,
    ];
    if (input.target) parts.push(`目标：${input.target}`);
    if (input.style) parts.push(`风格：${input.style}`);
    return parts.join("\n");
  }

  private buildRevisionMessage(original: string, review: ReviewResult): string {
    const allIssues = [
      ...review.accuracy.issues,
      ...review.completeness.issues,
      ...review.actionability.issues,
      ...review.readability.issues,
    ];
    return [
      "上一版本存在以下问题，请修改后重新输出：",
      ...allIssues.map((i, idx) => `${idx + 1}. ${i}`),
      "",
      "--- 原始内容 ---",
      original,
    ].join("\n");
  }

  private async callGenerator(
    userMessage: string,
    schema: ReturnType<typeof ALL_SCHEMAS[GuideType]>,
  ): Promise<Record<string, unknown>> {
    const resp = await this.openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      messages: [
        { role: "system", content: GENERATOR_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      tools: [{ type: "function", function: schema } as any],
      tool_choice: { type: "function", function: { name: schema.name } } as any,
      temperature: 0.7,
    });

    const toolCall = resp.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function.arguments) {
      throw new Error("LLM did not return a tool call");
    }

        const parsed = this.parser.parse(toolCall.function.arguments);
    return parsed.data;
  }

  private async callReviewer(guideData: Record<string, unknown>): Promise<ReviewResult> {
    const guideText = JSON.stringify(guideData, null, 2);

    const resp = await this.openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      messages: [
        { role: "system", content: REVIEWER_SYSTEM_PROMPT },
        { role: "user", content: `请审查以下攻略：\n\n${guideText}` },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const raw = resp.choices[0]?.message?.content;
    if (!raw) throw new Error("Reviewer returned empty response");

    return JSON.parse(raw) as ReviewResult;
  }
}
