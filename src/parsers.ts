// ---- Pluggable JSON argument parsers for different LLM providers -----------

export interface ParsedArgs {
  data: Record<string, unknown>;
  /** Raw text after cleanup, for debugging */
  raw: string;
}

export interface ArgumentParser {
  /** Provider name, e.g. "deepseek", "openai" */
  readonly provider: string;
  /** Parse raw tool_call.function.arguments into structured data */
  parse(raw: string): ParsedArgs;
}

// ---- DeepSeek parser -------------------------------------------------------

/**
 * DeepSeek sometimes emits JSON with a premature closing brace,
 * followed by additional valid fields. This parser tries the full
 * string first, then attempts to repair by dropping the offending
 * brace when that fails.
 */
export class DeepSeekParser implements ArgumentParser {
  readonly provider = "deepseek";

  parse(raw: string): ParsedArgs {
    let text = raw.trim();

    // Strip any markdown fences
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }

    // Try full parse; if it fails, iteratively drop the last problematic `}`
    let attempt = text;
    while (attempt.length > 0) {
      try {
        return { data: JSON.parse(attempt) as Record<string, unknown>, raw: attempt };
      } catch {
        const prevBrace = attempt.lastIndexOf("}", attempt.length - 2);
        if (prevBrace < 0) break;
        // Drop the closing brace that prematurely ended the object
        attempt = attempt.slice(0, prevBrace + 1) + attempt.slice(prevBrace + 2);
      }
    }

    throw new Error(`DeepSeekParser: failed to parse arguments after repair attempts`);
  }
}

// ---- OpenAI parser ----------------------------------------------------------

export class OpenAIParser implements ArgumentParser {
  readonly provider = "openai";

  parse(raw: string): ParsedArgs {
    let text = raw.trim();
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
    return { data: JSON.parse(text) as Record<string, unknown>, raw: text };
  }
}

// ---- Parser registry -------------------------------------------------------

const registry = new Map<string, ArgumentParser>();

export function registerParser(parser: ArgumentParser): void {
  registry.set(parser.provider, parser);
}

export function getParser(provider: string): ArgumentParser {
  const p = registry.get(provider);
  if (p) return p;
  // Fallback to OpenAI-style parsing
  return new OpenAIParser();
}

// Register built-in parsers
registerParser(new DeepSeekParser());
registerParser(new OpenAIParser());