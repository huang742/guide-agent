// Compact schema builder: converts a lightweight definition to OpenAI-compatible JSON Schema.

export type Prop =
  | { t: "s"; d?: string; en?: string[] }                       // string
  | { t: "n"; d?: string }                                       // number
  | { t: "b"; d?: string }                                       // boolean
  | { t: "a"; it: Prop | Obj; d?: string; min?: number; max?: number }  // array
  | { t: "o"; p: Record<string, Prop | Obj>; d?: string };       // nested object

export type Obj = { t: "o"; p: Record<string, Prop | Obj>; d?: string };

type JSONSchema = Record<string, unknown>;

function buildProp(prop: Prop | Obj): JSONSchema {
  switch (prop.t) {
    case "s": return { type: "string", ...(prop.d && { description: prop.d }), ...(prop.en && { enum: prop.en }) };
    case "n": return { type: "number", ...(prop.d && { description: prop.d }) };
    case "b": return { type: "boolean", ...(prop.d && { description: prop.d }) };
    case "a": return {
      type: "array",
      items: buildProp(prop.it),
      ...(prop.d && { description: prop.d }),
      ...(prop.min !== undefined && { minItems: prop.min }),
      ...(prop.max !== undefined && { maxItems: prop.max }),
    };
    case "o": return {
      type: "object",
      properties: Object.fromEntries(Object.entries(prop.p).map(([k, v]) => [k, buildProp(v)])),
      ...(prop.d && { description: prop.d }),
    };
  }
}

export function buildFunctionSchema(
  name: string,
  description: string,
  root: Obj,
  required: string[],
): { name: string; description: string; strict: boolean; parameters: JSONSchema } {
  const schema = buildProp(root) as JSONSchema;
  (schema as any).required = required;
  return { name, description, strict: true, parameters: { type: "object", required, properties: schema.properties } };
}
