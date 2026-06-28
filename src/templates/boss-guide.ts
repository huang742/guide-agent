import { buildFunctionSchema, type Obj, type Prop } from "../schema.js";

const s = (d?: string, en?: string[]): Prop => ({ t: "s", d, en });
const n = (d?: string): Prop => ({ t: "n", d });
const b = (d?: string): Prop => ({ t: "b", d });
const a = (it: Prop | Obj, d?: string, min?: number, max?: number): Prop => ({ t: "a", it, d, min, max });
const o = (p: Record<string, Prop | Obj>, d?: string): Obj => ({ t: "o", p, d });

const move = o({
  name:          s("招式名称"),
  tell:          s("前摇/识别信号，如「Boss跳起、右手后摆、刀刃闪光」"),
  damage_type:   s("slash/strike/pierce/fire/lightning/magic/holy"),
  danger_level:  s("危险程度", ["fatal","high","medium","low"]),
  counter:       s("应对方法，必须具体可操作"),
  punish_window: s("反击窗口，如「收刀后约1.5秒」"),
  notes:         s("额外提示"),
});

const phaseStrategy = o({
  opening:         s("入场后第一时间做什么"),
  neutral_game:    s("走位和拉扯策略"),
  burst_windows:   s("全力输出时机"),
  healing_windows: s("安全治疗时机"),
});

const weapon = o({ name: s(), infusion: s("质变类型"), upgrade_level: s(), reason: s("选择理由") });
const shield = o({ name: s(), type: s("",["shield","catalyst","seal","none"]), reason: s() });
const armor  = o({ slot: s("",["head","body","arms","legs"]), name: s(), note: s() });
const talisman = o({ name: s(), reason: s() });
const consumable = o({ name: s(), usage: s("何时使用") });

const build = o({
  build_name: s(),
  build_type: s("", ["melee","ranged","magic","faith","dex","strength","hybrid"]),
  difficulty: s("", ["easy","medium","hard"]),
  stats: o({ level:n(),vigor:n(),mind:n(),endurance:n(),strength:n(),dexterity:n(),intelligence:n(),faith:n(),arcane:n() }),
  equipment: o({
    weapon: a(weapon),
    shield_or_catalyst: a(shield),
    armor: a(armor),
    talismans: a(talisman, "", 0, 4),
    consumables: a(consumable),
  }),
  playstyle_tips: a(s(""), "至少3条核心打法要点", 3),
});

const root: Obj = o({
  boss_name_cn: s("Boss中文名"),
  boss_name_en: s("Boss英文名"),
  game_name:    s("游戏全名"),
  tags:         a(s()),

  basic_info: o({
    location: s("区域和具体位置"),
    recommended_level: o({ min: n(), comfortable: n() }),
    drops: a(o({ name:s(), type:s("",["weapon","armor","talisman","spell","consumable","rune","key_item","other"]), note:s() }), "", 1),
    lore: s("背景故事，2-4句"),
    is_optional: b(),
    achievement: s(),
  }),

  stats_and_resistances: o({
    hp: o({ ng:s(), ng_plus:s(), phase1:s(), phase2:s() }),
    weaknesses:  a(o({ damage_type:s("slash/strike/pierce/fire/lightning/magic/holy"), effectiveness:s("extreme/high/moderate/slight") })),
    resistances: a(o({ damage_type:s(), level:s("immune/very_high/high/moderate") })),
    immunities:  a(s()),
    status_effects: a(o({ effect:s(), susceptibility:s("very_high/high/moderate/low") })),
  }),

  moveset_phase1: o({
    phase_name: s(),
    phase_trigger: s(),
    passive_abilities: a(s()),
    moves: a(move, "", 4),
  }),

  moveset_phase2: o({
    phase_name: s(),
    phase_trigger: s(),
    passive_abilities: a(s()),
    new_moves: a(move, "", 2),
    retained_moves: a(s()),
    modified_moves: a(o({ name:s(), change:s() })),
  }),

  recommended_builds: a(build, "至少两种不同流派的配装方案", 2),

  strategy: o({
    preparation: a(s(), "灵药、Buff顺序、召唤物"),
    phase1_strategy: phaseStrategy,
    phase_transition: s("转阶段注意事项"),
    phase2_strategy: phaseStrategy,
  }),

  common_deaths: a(o({ situation:s("死亡场景"), cause:s("根本原因"), solution:s("解决办法，必须具体可操作") }), "", 3, 6),
  summary: s("一句话总结"),
});

export const bossGuideSchema = buildFunctionSchema(
  "generate_boss_guide",
  "生成一篇完整的Boss打法攻略",
  root,
  ["boss_name_cn","boss_name_en","game_name","basic_info","stats_and_resistances","moveset_phase1","recommended_builds","strategy","common_deaths"],
);
