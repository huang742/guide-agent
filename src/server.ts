import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, extname } from "path";
import { GuideAgent, type AgentConfig } from "./agent.js";
import { render } from "./renderer.js";
import { md2html } from "./md2html.js";
import type { GenerateInput, GuideType } from "./agent.js";

// ---- MIME map --------------------------------------------------------------

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// ---- Static file server ----------------------------------------------------

const PUBLIC_DIR = join(import.meta.dirname, "public");
const OUTPUT_DIR = join(import.meta.dirname, "..", "output");

function serveStatic(res: ServerResponse, urlPath: string) {
  let filePath = join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }
  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const content = readFileSync(filePath);
  res.writeHead(200, { "Content-Type": mime });
  res.end(content);
}

// ---- JSON helpers ----------------------------------------------------------

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function jsonResponse(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

// ---- In-memory state (per server instance) ---------------------------------

// Keep the last generated result so revise/save can reference it
let lastInput: GenerateInput | null = null;
let lastMarkdown: string | null = null;

// ---- Main ------------------------------------------------------------------

async function main() {
  const port = parseInt(process.env.PORT ?? "3456", 10);

  const agentConfig: AgentConfig = {
    parserProvider: process.env.PARSER_PROVIDER ?? "deepseek",
  };

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // ---- API: generate guide ----
    if (req.method === "POST" && url.pathname === "/api/generate") {
      try {
        const body = await readBody(req);
        const { game, type, target, style } = JSON.parse(body) as {
          game: string;
          type: GuideType;
          target?: string;
          style?: string;
        };

        if (!game || !type) {
          jsonResponse(res, 400, { error: "缺少必填字段 game / type" });
          return;
        }

        const agent = new GuideAgent(agentConfig);
        const input: GenerateInput = {
          game,
          type,
          target,
          style: (style as GenerateInput["style"]) ?? "detailed",
        };

        const result = await agent.generate(input);
        const markdown = render(type, result.guide);

        const html = md2html(markdown);

        // Store for later revise/save
        lastInput = input;
        lastMarkdown = markdown;

        jsonResponse(res, 200, {
          markdown,
          html,
          review: result.review,
          revised: result.revised,
        });
      } catch (err: any) {
        console.error("Generate error:", err.message);
        jsonResponse(res, 500, { error: err.message });
      }
      return;
    }

    // ---- API: revise with feedback ----
    if (req.method === "POST" && url.pathname === "/api/revise") {
      try {
        const body = await readBody(req);
        const { feedback } = JSON.parse(body) as { feedback: string };

        if (!feedback?.trim()) {
          jsonResponse(res, 400, { error: "请提供修改意见" });
          return;
        }

        if (!lastInput) {
          jsonResponse(res, 400, { error: "请先生成一份攻略" });
          return;
        }

        const agent = new GuideAgent(agentConfig);
        const result = await agent.revise(lastInput, feedback);
        const markdown = render(lastInput.type, result.guide);

        const html = md2html(markdown);
        lastMarkdown = markdown;

        jsonResponse(res, 200, {
          markdown,
          html,
          review: result.review,
          revised: true,
        });
      } catch (err: any) {
        console.error("Revise error:", err.message);
        jsonResponse(res, 500, { error: err.message });
      }
      return;
    }

    // ---- API: save markdown to file ----
    if (req.method === "POST" && url.pathname === "/api/save") {
      try {
        if (!lastMarkdown) {
          jsonResponse(res, 400, { error: "没有可保存的攻略" });
          return;
        }

        const body = await readBody(req);
        const { filename } = JSON.parse(body) as { filename?: string };

        const ts = Date.now();
        const type = lastInput?.type ?? "guide";
        const outFile = filename || `${type}-${ts}.md`;
        const outPath = join(OUTPUT_DIR, outFile);

        writeFileSync(outPath, lastMarkdown, "utf-8");
        jsonResponse(res, 200, { saved: outFile, path: outPath });
      } catch (err: any) {
        console.error("Save error:", err.message);
        jsonResponse(res, 500, { error: err.message });
      }
      return;
    }

    // ---- API: list saved guides ----
    if (req.method === "GET" && url.pathname === "/api/guides") {
      try {
        const fileParam = url.searchParams.get("file");
        if (fileParam) {
          // Read specific guide
          const filePath = join(OUTPUT_DIR, fileParam);
          if (!existsSync(filePath) || !filePath.startsWith(OUTPUT_DIR)) {
            jsonResponse(res, 404, { error: "攻略文件不存在" });
            return;
          }
          const raw = readFileSync(filePath, "utf-8");
          const html = md2html(raw);
          jsonResponse(res, 200, { filename: fileParam, markdown: raw, html });
        } else {
          // List all guides
          const files = readdirSync(OUTPUT_DIR)
            .filter(f => f.endsWith(".md"))
            .map(f => {
              const stat = readFileSync(join(OUTPUT_DIR, f), "utf-8");
              const firstLine = stat.split("\n").find(l => l.startsWith("# "))?.replace("# ", "") ?? f;
              return { filename: f, title: firstLine };
            })
            .sort((a, b) => b.filename.localeCompare(a.filename)); // newest first
          jsonResponse(res, 200, { guides: files });
        }
      } catch (err: any) {
        console.error("Guides error:", err.message);
        jsonResponse(res, 500, { error: err.message });
      }
      return;
    }

    // ---- API: revise loaded guide ----
    if (req.method === "POST" && url.pathname === "/api/revise-content") {
      try {
        const body = await readBody(req);
        const { game, type, feedback } = JSON.parse(body) as {
          game: string;
          type: GuideType;
          feedback: string;
        };

        if (!feedback?.trim()) {
          jsonResponse(res, 400, { error: "请提供修改意见" });
          return;
        }
        if (!lastMarkdown) {
          jsonResponse(res, 400, { error: "请先加载一份攻略" });
          return;
        }

        const agent = new GuideAgent(agentConfig);
        const result = await agent.reviseFromContent(
          lastMarkdown,
          feedback,
          game || "未知游戏",
          type || "boss_guide",
        );
        const markdown = render(type || "boss_guide", result.guide);
        const html = md2html(markdown);
        lastMarkdown = markdown;
        lastInput = { game: game || "未知游戏", type: type || "boss_guide", target: "(修订版)", style: "detailed" };

        jsonResponse(res, 200, {
          markdown,
          html,
          review: result.review,
          revised: true,
        });
      } catch (err: any) {
        console.error("Revise-content error:", err.message);
        jsonResponse(res, 500, { error: err.message });
      }
      return;
    }

    // Static files
    serveStatic(res, url.pathname);
  });

  server.listen(port, () => {
    console.log(`\n🌐 攻略生成 Agent 已启动: http://localhost:${port}\n`);
  });
}

main().catch((err) => {
  console.error("Server failed:", err);
  process.exit(1);
});