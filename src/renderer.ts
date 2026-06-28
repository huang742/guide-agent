// JSON-to-Markdown renderer.
// Converts structured guide data (from LLM Function Calling output) to Markdown.
// Each guide type has its own render function.

// ---- Translation maps: English game terms → 简体中文 -----------------------

const DAMAGE_CN: Record<string, string> = {
  slash: "斩击", pierce: "穿刺", strike: "打击", magic: "魔法",
  fire: "火焰", lightning: "雷电", holy: "圣", dark: "暗",
  bleed: "出血", frost: "冻伤", poison: "毒素", scarlet_rot: "猩红腐败",
  physical: "物理", standard: "普通",
};

const STATUS_CN: Record<string, string> = {
  bleed: "出血", frost: "冻伤", poison: "中毒",
  scarlet_rot: "猩红腐败", madness: "发狂", sleep: "睡眠", death_blight: "即死",
  rot: "腐败",
};

const IMMUNITY_CN: Record<string, string> = {
  sleep: "睡眠", madness: "发狂", death_blight: "即死",
  bleed: "出血", frost: "冻伤", poison: "中毒", scarlet_rot: "猩红腐败",
  rot: "腐败", toxic: "剧毒",
};

const DANGER_CN: Record<string, string> = {
  fatal: "致命", high: "高", medium: "中", low: "低", very_low: "极低",
  extreme: "极高",
};

const SUSCEPTIBILITY_CN: Record<string, string> = {
  very_high: "极高", high: "高", moderate: "中", low: "低", very_low: "极低",
  immune: "免疫", extreme: "极高",
};

const EFFECTIVENESS_CN: Record<string, string> = {
  extreme: "极高", very_high: "极高", high: "高", moderate: "中",
  slight: "低", low: "低", none: "无", immune: "免疫",
};

const STAT_CN: Record<string, string> = {
  vigor: "生命力", mind: "专注力", endurance: "耐力",
  strength: "力气", dexterity: "灵巧", intelligence: "智力",
  faith: "信仰", arcane: "感应", level: "等级",
};

const BUILD_TYPE_CN: Record<string, string> = {
  melee: "近战", magic: "法术", faith: "信仰", dex: "敏捷",
  strength: "力量", quality: "力敏", hybrid: "混合",
};

const BUILD_DIFFICULTY_CN: Record<string, string> = {
  easy: "简单", medium: "中等", hard: "困难", beginner: "新手",
};

const DROP_TYPE_CN: Record<string, string> = {
  rune: "卢恩", key_item: "关键物品", weapon: "武器", armor: "防具",
  talisman: "护符", spell: "法术/祷告", ash_of_war: "战灰", consumable: "消耗品",
  material: "材料",
};

function cnDamage(dt: string): string { return DAMAGE_CN[dt] ?? dt; }
function cnStatus(s: string): string { return STATUS_CN[s] ?? s; }
function cnImmunity(s: string): string { return IMMUNITY_CN[s] ?? s; }
function cnDanger(d: string): string { return DANGER_CN[d] ?? d; }
function cnSuscept(s: string): string { return SUSCEPTIBILITY_CN[s] ?? s; }
function cnEffect(e: string): string { return EFFECTIVENESS_CN[e] ?? e; }
function cnStat(s: string): string { return STAT_CN[s] ?? s; }

// Translate a string that may contain mixed English terms
function translateTerms(text: string): string {
  let t = text;
  for (const [en, cn] of Object.entries(DAMAGE_CN)) {
    t = t.replace(new RegExp("\\b" + en + "\\b", "gi"), cn);
  }
  for (const [en, cn] of Object.entries(STATUS_CN)) {
    t = t.replace(new RegExp("\\b" + en + "\\b", "gi"), cn);
  }
  return t;
}

// ---- Boss Guide -------------------------------------------------------------

export function renderBossGuide(g: Record<string, any>): string {
  const lines: string[] = [];

  lines.push(`---`);
  lines.push(`game: ${g.game_name ?? ""}`);
  lines.push(`boss: ${g.boss_name_cn ?? ""}`);
  lines.push(`boss_en: ${g.boss_name_en ?? ""}`);
  lines.push(`type: boss_guide`);
  if (g.tags?.length) lines.push(`tags: [${g.tags.join(", ")}]`);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# ${g.boss_name_cn ?? ""} 打法攻略`);
  lines.push(``);

  // Basic info
  const bi = g.basic_info ?? {};
  lines.push(`## 基本信息`);
  lines.push(``);
  if (bi.location) lines.push(`- **所在区域**：${bi.location}`);
  if (bi.recommended_level) lines.push(`- **推荐等级**：${bi.recommended_level.min}+ (舒适 ${bi.recommended_level.comfortable}+)`);
  if (bi.lore) lines.push(`- **背景**：${bi.lore}`);
  if (bi.is_optional !== undefined) lines.push(`- **是否可选**：${bi.is_optional ? "是" : "否"}`);
  if (bi.achievement) lines.push(`- **成就/奖杯**：${bi.achievement}`);
  if (bi.drops?.length) {
    lines.push(`- **掉落**：`);
    for (const d of bi.drops) {
      const typeCn = DROP_TYPE_CN[d.type] ?? d.type;
      lines.push(`  - ${d.name}（${typeCn}）${d.note ? ` — ${d.note}` : ""}`);
    }
  }
  lines.push(``);

  // Stats — all Chinese
  const st = g.stats_and_resistances ?? {};
  lines.push(`## 属性与抗性`);
  lines.push(``);
  if (st.hp) {
    lines.push(`- **生命值（一周目）**：约 ${st.hp.ng ?? "?"}`);
    if (st.hp.ng_plus) lines.push(`- **生命值（多周目 NG+7）**：约 ${st.hp.ng_plus}`);
    if (st.hp.phase1) lines.push(`- **第一阶段 HP**：约 ${st.hp.phase1}`);
    if (st.hp.phase2) lines.push(`- **第二阶段 HP**：约 ${st.hp.phase2}`);
  }
  if (st.weaknesses?.length) {
    lines.push(``);
    lines.push(`**弱点**：${st.weaknesses.map((w: any) => `${cnDamage(w.damage_type)}（${cnEffect(w.effectiveness)}）`).join("、")}`);
  }
  if (st.resistances?.length) {
    lines.push(`**抗性**：${st.resistances.map((r: any) => `${cnDamage(r.damage_type)}（${cnSuscept(r.level)}）`).join("、")}`);
  }
  if (st.immunities?.length) {
    lines.push(`**免疫**：${st.immunities.map((i: string) => cnImmunity(i)).join("、")}`);
  }
  if (st.status_effects?.length) {
    lines.push(`**异常状态抗性**：${st.status_effects.map((s: any) => `${cnStatus(s.effect)}（${cnSuscept(s.susceptibility)}）`).join("、")}`);
  }
  lines.push(``);

  // Movesets
  renderMoveset(lines, g.moveset_phase1);
  if (g.moveset_phase2) renderMoveset(lines, g.moveset_phase2);

  // Builds
  if (g.recommended_builds?.length) {
    lines.push(`## 推荐配装`);
    for (const b of g.recommended_builds) {
      const typeCn = BUILD_TYPE_CN[b.build_type] ?? b.build_type ?? "通用";
      const diffCn = BUILD_DIFFICULTY_CN[b.difficulty] ?? b.difficulty ?? "中等";
      lines.push(``);
      lines.push(`### ${b.build_name}（${typeCn} / ${diffCn}）`);
      if (b.stats) {
        const s = b.stats;
        const statParts: string[] = [];
        for (const k of ["vigor","mind","endurance","strength","dexterity","intelligence","faith","arcane"]) {
          if (s[k] !== undefined) statParts.push(`${cnStat(k)} ${s[k]}`);
        }
        lines.push(`- **加点**（等级 ${s.level ?? "?"}）：${statParts.join(" / ")}`);
      }
      if (b.equipment?.weapon?.length) {
        lines.push(`- **武器**：${b.equipment.weapon.map((w: any) => `${w.name}（${w.infusion}）${w.reason ? ` — ${translateTerms(w.reason)}` : ""}`).join("、")}`);
      }
      if (b.equipment?.talismans?.length) {
        lines.push(`- **护符**：${b.equipment.talismans.map((t: any) => t.name).join("、")}`);
      }
      if (b.playstyle_tips?.length) {
        lines.push(`- **打法要点**：`);
        for (const t of b.playstyle_tips) lines.push(`  - ${translateTerms(t)}`);
      }
    }
    lines.push(``);
  }

  // Strategy
  const strat = g.strategy ?? {};
  lines.push(`## 实战打法`);
  lines.push(``);
  if (strat.preparation?.length) {
    lines.push(`### 战前准备`);
    for (const p of strat.preparation) lines.push(`- ${translateTerms(p)}`);
    lines.push(``);
  }
  if (strat.phase1_strategy) {
    lines.push(`### 第一阶段`);
    const ps = strat.phase1_strategy;
    if (ps.opening) lines.push(`- **开局**：${translateTerms(ps.opening)}`);
    if (ps.neutral_game) lines.push(`- **拉扯**：${translateTerms(ps.neutral_game)}`);
    if (ps.burst_windows) lines.push(`- **输出时机**：${translateTerms(ps.burst_windows)}`);
    if (ps.healing_windows) lines.push(`- **治疗时机**：${translateTerms(ps.healing_windows)}`);
    lines.push(``);
  }
  if (strat.phase_transition) {
    lines.push(`### 转阶段`);
    lines.push(translateTerms(strat.phase_transition));
    lines.push(``);
  }
  if (strat.phase2_strategy) {
    lines.push(`### 第二阶段`);
    const ps = strat.phase2_strategy;
    if (ps.opening) lines.push(`- **开局**：${translateTerms(ps.opening)}`);
    if (ps.neutral_game) lines.push(`- **拉扯**：${translateTerms(ps.neutral_game)}`);
    if (ps.burst_windows) lines.push(`- **输出时机**：${translateTerms(ps.burst_windows)}`);
    if (ps.healing_windows) lines.push(`- **治疗时机**：${translateTerms(ps.healing_windows)}`);
    lines.push(``);
  }

  // Common deaths
  if (g.common_deaths?.length) {
    lines.push(`## 常见翻车点`);
    for (const cd of g.common_deaths) {
      lines.push(`### ${translateTerms(cd.situation)}`);
      if (cd.cause) lines.push(`- **原因**：${translateTerms(cd.cause)}`);
      if (cd.solution) lines.push(`- **对策**：${translateTerms(cd.solution)}`);
      lines.push(``);
    }
  }

  if (g.summary) {
    lines.push(`> ${translateTerms(g.summary)}`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ---- Build Guide ------------------------------------------------------------

export function renderBuildGuide(g: Record<string, any>): string {
  const lines: string[] = [];

  lines.push(`---`);
  lines.push(`game: ${g.game_name ?? ""}`);
  lines.push(`build: ${g.build_name ?? ""}`);
  if (g.build_name_en) lines.push(`build_en: ${g.build_name_en}`);
  lines.push(`type: build_guide`);
  if (g.tags?.length) lines.push(`tags: [${g.tags.join(", ")}]`);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# ${g.build_name ?? ""} 配装指南`);
  lines.push(``);

  const ov = g.build_overview ?? {};
  if (ov.positioning) lines.push(`> ${translateTerms(ov.positioning)}`);
  lines.push(``);

  if (ov.pros?.length) {
    lines.push(`**优势**：${ov.pros.map((p: string) => translateTerms(p)).join("、")}`);
  }
  if (ov.cons?.length) {
    lines.push(`**劣势**：${ov.cons.map((c: string) => translateTerms(c)).join("、")}`);
  }

  if (g.stats) {
    lines.push(`## 属性加点`);
    const s = g.stats;
    const parts: string[] = [];
    for (const k of ["vigor","mind","endurance","strength","dexterity","intelligence","faith","arcane"]) {
      if (s[k] !== undefined) parts.push(`${cnStat(k)} ${s[k]}`);
    }
    lines.push(`${parts.join(" / ")}`);
    lines.push(``);
  }

  renderEquip(lines, "武器", g.weapons);
  renderEquip(lines, "防具", g.armor);
  renderEquip(lines, "护符", g.talismans);
  renderEquip(lines, "法术/祷告", g.spells);
  renderEquip(lines, "战灰", g.ashes_of_war);

  if (g.gameplay_loop?.length) {
    lines.push(`## 打法循环`);
    for (const l of g.gameplay_loop) {
      lines.push(`- ${translateTerms(l)}`);
    }
    lines.push(``);
  }

  if (g.matchups?.length) {
    lines.push(`## 克制关系`);
    for (const m of g.matchups) {
      lines.push(`- **${m.situation}**：${translateTerms(m.advice)}`);
    }
    lines.push(``);
  }

  if (g.summary) {
    lines.push(`> ${translateTerms(g.summary)}`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ---- Walkthrough ------------------------------------------------------------

export function renderWalkthrough(g: Record<string, any>): string {
  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`game: ${g.game_name ?? ""}`);
  lines.push(`type: walkthrough`);
  if (g.tags?.length) lines.push(`tags: [${g.tags.join(", ")}]`);
  if (g.spoiler_warning) lines.push(`spoiler: true`);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# ${g.game_name ?? ""} 全流程攻略`);
  lines.push(``);

  const ov = g.game_overview ?? {};
  lines.push(`## 游戏概览`);
  if (ov.genre) lines.push(`- **类型**：${ov.genre}`);
  if (ov.difficulty) lines.push(`- **难度**：${ov.difficulty}`);
  if (ov.estimated_hours) lines.push(`- **时长**：主线 ${ov.estimated_hours.main_story ?? "?"} / 全支线 ${ov.estimated_hours.main_plus_side ?? "?"} / 全收集 ${ov.estimated_hours.completionist ?? "?"}`);
  if (ov.missable_warning?.length) {
    lines.push(`- **⚠ 会错过的内容**：${ov.missable_warning.join("、")}`);
  }
  lines.push(``);

  const prep = g.preparation ?? {};
  if (prep.recommended_start?.class_or_origin) {
    lines.push(`## 开局准备`);
    const rs = prep.recommended_start;
    lines.push(`- **推荐出身**：${rs.class_or_origin}${rs.keepsake_or_gift ? ` / 初始物品：${rs.keepsake_or_gift}` : ""}`);
    if (rs.reason) lines.push(`- **理由**：${translateTerms(rs.reason)}`);
  }
  if (prep.early_game_tips?.length) {
    for (const tip of prep.early_game_tips) lines.push(`- ${translateTerms(tip)}`);
  }
  if (prep.key_mechanics_to_understand?.length) {
    lines.push(``);
    lines.push(`### 核心机制速览`);
    for (const km of prep.key_mechanics_to_understand) lines.push(`- **${km.mechanic}**：${translateTerms(km.explanation)}`);
  }
  lines.push(``);

  if (g.chapters?.length) {
    for (const ch of g.chapters) {
      lines.push(`## 第${ch.chapter_number ?? "?"}章：${ch.chapter_name ?? ""}`);
      if (ch.recommended_level) lines.push(`*建议等级：${ch.recommended_level} / 预计耗时：${ch.estimated_time ?? "?"}*`);
      lines.push(``);
      if (ch.objectives?.length) {
        lines.push(`**目标**：${ch.objectives.join(" → ")}`);
        lines.push(``);
      }

      if (ch.walkthrough?.length) {
        lines.push(`### 流程步骤`);
        for (const step of ch.walkthrough) {
          lines.push(``);
          lines.push(`**${step.step_number ?? "?"}.** ${translateTerms(step.instruction)}`);
          if (step.landmarks?.length) lines.push(`  地标：${step.landmarks.join(" → ")}`);
          if (step.caution) lines.push(`  ⚠ ${translateTerms(step.caution)}`);
          if (step.pickup?.length) {
            for (const pk of step.pickup) {
              lines.push(`  📦 ${pk.name}（${pk.type}）— ${pk.location_detail}${pk.missable ? " ⚠可错过" : ""}`);
            }
          }
        }
        lines.push(``);
      }

      if (ch.bosses?.length) {
        lines.push(`### Boss 一览`);
        for (const b of ch.bosses) {
          lines.push(`- **${b.name}** [${b.type}] (${b.difficulty}) — ${translateTerms(b.recommended_strategy)}`);
          if (b.drops?.length) lines.push(`  - 掉落：${b.drops.join("、")}`);
        }
        lines.push(``);
      }

      if (ch.key_items?.length) {
        lines.push(`### 关键物品`);
        for (const ki of ch.key_items) {
          lines.push(`- **${ki.name}** [${ki.importance}] — ${ki.location}${ki.missable ? " ⚠可错过" : ""}`);
        }
        lines.push(``);
      }

      if (ch.npcs_and_quests?.length) {
        lines.push(`### NPC & 任务`);
        for (const nq of ch.npcs_and_quests) {
          lines.push(`- **${nq.npc_name}**：${nq.quest_summary}${nq.missable ? " ⚠可错过" : ""}`);
        }
        lines.push(``);
      }
    }
  }

  if (g.endings) {
    lines.push(`## 结局指南`);
    lines.push(`共 ${g.endings.total_endings ?? "?"} 种结局`);
    if (g.endings.endings_list?.length) {
      for (const e of g.endings.endings_list) {
        lines.push(`- **${e.name}** [${e.type}] — 节点：${e.point_of_no_return}`);
      }
    }
    lines.push(``);
  }

  if (g.summary) lines.push(`> ${translateTerms(g.summary)}`);
  lines.push(``);

  return lines.join("\n");
}

// ---- Shared helpers ---------------------------------------------------------

function renderMoveset(lines: string[], ms: any) {
  if (!ms) return;
  lines.push(`## ${ms.phase_name ?? "招式拆解"}`);
  if (ms.phase_trigger || ms.passive_abilities?.length) {
    if (ms.phase_trigger) lines.push(`- **触发条件**：${translateTerms(ms.phase_trigger)}`);
    if (ms.passive_abilities?.length) lines.push(`- **被动能力**：${ms.passive_abilities.map((p: string) => translateTerms(p)).join("、")}`);
    lines.push(``);
  }

  const allMoves = [...(ms.moves ?? []), ...(ms.new_moves ?? [])];
  if (allMoves.length) {
    lines.push(`| 招式名称 | 前摇动作 | 伤害类型 | 危险程度 | 应对方法 | 反击窗口 |`);
    lines.push(`|----------|----------|----------|----------|----------|----------|`);
    for (const m of allMoves) {
      const dangerCn = cnDanger(m.danger_level);
      const damageCn = cnDamage(m.damage_type);
      lines.push(`| ${m.name ?? ""} | ${m.tell ?? ""} | ${damageCn} | ${dangerCn} | ${translateTerms(m.counter ?? "")} | ${m.punish_window ?? ""} |`);
    }
    lines.push(``);
  }

  if (ms.retained_moves?.length) {
    lines.push(`**保留招式**：${ms.retained_moves.join("、")}`);
  }
  if (ms.modified_moves?.length) {
    for (const mm of ms.modified_moves) {
      lines.push(`- ${mm.name} → ${translateTerms(mm.change)}`);
    }
  }
  lines.push(``);
}

function renderEquip(lines: string[], label: string, items: any[]) {
  if (!items?.length) return;
  lines.push(`## ${label}`);
  lines.push(``);
  for (const item of items) {
    const name = item.name ?? "???";
    const note = item.note ?? item.reason ?? "";
    lines.push(`- **${name}**${note ? ` — ${translateTerms(note)}` : ""}`);
  }
  lines.push(``);
}

// ---- Dispatcher -------------------------------------------------------------

import type { GuideType } from "./templates/index.js";

export function render(guideType: GuideType, data: Record<string, any>): string {
  switch (guideType) {
    case "boss_guide":     return renderBossGuide(data);
    case "build_guide":    return renderBuildGuide(data);
    case "walkthrough":    return renderWalkthrough(data);
    default: throw new Error(`Unknown guide type: ${guideType}`);
  }
}