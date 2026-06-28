import { GuideAgent } from "./agent.js";
import { render } from "./renderer.js";
import type { GenerateInput, GuideType } from "./agent.js";

export { GuideAgent, render };
export type { GenerateInput, GuideType };

// ---- CLI entry --------------------------------------------------------------

async function main() {
  const agent = new GuideAgent();

  // Accept CLI args or defaults
  const game = process.argv[2] ?? "Elden Ring / 艾尔登法环";
  const type = (process.argv[3] ?? "boss_guide") as GuideType;
  const target = process.argv[4] ?? "Malenia, Blade of Miquella / 玛莲妮亚";

  console.log(`\n===== 攻略生成 Agent =====`);
  console.log(`游戏: ${game}`);
  console.log(`类型: ${type}`);
  console.log(`目标: ${target}`);
  console.log(`==========================\n`);

  const input: GenerateInput = { game, type, target, style: "detailed" };

  console.log("▶ 正在生成攻略...");
  const startTime = Date.now();
  const result = await agent.generate(input);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✓ 生成完成 (${elapsed}s)`);
  console.log(`  重试过: ${result.revised ? "是" : "否"}`);
  console.log(`  综合评分: ${result.review.overall_score}`);
  console.log(`  审查结论: ${result.review.verdict}`);
  console.log(`  审查摘要: ${result.review.summary}`);

  // Render to Markdown
  const markdown = render(type, result.guide);

  // Save to file
  const fs = await import("fs");
  const outFile = `output-${type}-${Date.now()}.md`;
  fs.writeFileSync(outFile, markdown, "utf-8");
  console.log(`\n✓ Markdown 已保存到: ${outFile}`);

  // Print preview
  console.log(`\n----- 预览 (前500字) -----`);
  console.log(markdown.slice(0, 500));
  console.log(`...\n`);

  if (result.review.verdict === "reject") {
    console.log("⚠ 审查未通过，建议人工审核后再发布。");
  }
}

main().catch((err) => {
  console.error("Agent failed:", err);
  process.exit(1);
});
