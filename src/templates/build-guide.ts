import { buildFunctionSchema, type Obj, type Prop } from "../schema.js";

const s = (d?: string, en?: string[]): Prop => ({ t: "s", d, en });
const n = (d?: string): Prop => ({ t: "n", d });
const a = (it: Prop | Obj, d?: string, min?: number, max?: number): Prop => ({ t: "a", it, d, min, max });
const o = (p: Record<string, Prop | Obj>, d?: string): Obj => ({ t: "o", p, d });

const stageItem = o({ stage: s(), level_range: s(), focus: s(), reason: s() });

const weaponItem = o({
  name: s(), slot: s("",["main_hand","off_hand","dual_wield","swap"]),
  infusion: s("质变路线"), required_upgrade: s(), why: s(), how_to_get: s(),
  alternatives: a(o({ name: s(), tradeoff: s("对比主选武器的优劣") })),
});

const armorPiece = o({ slot: s("",["head","body","arms","legs"]), name: s(), weight: n() });
const talismanItem = o({ name: s(), effect: s(), why: s(), how_to_get: s() });
const consumableItem = o({ name: s(), usage: s("使用场景"), how_to_farm: s() });

const comboItem = o({ situation: s("什么情况下用"), action: s("具体操作") });
const techItem = o({ name: s(), description: s(), difficulty: s("",["easy","medium","hard"]) });

const matchupStrong = o({ boss_or_enemy_type: s(), reason: s() });
const matchupWeak = o({ boss_or_enemy_type: s(), reason: s(), counterplay: s("遇到时怎么应对") });

const root: Obj = o({
  build_name: s("Build名"),
  build_name_en: s(),
  game_name: s(),
  tags: a(s()),

  build_overview: o({
    positioning: s("一句话定位"),
    difficulty: s("",["beginner","medium","advanced"]),
    viability: o({ pve: s("",["S","A","B","C","D"]), pvp: s("",["S","A","B","C","D"]) }),
    target_audience: s("适合什么样的玩家"),
    pros_and_cons: o({ pros: a(s(), "", 3), cons: a(s(), "", 2) }),
  }),

  stat_allocation: o({
    target_level: n(),
    stats: o({ vigor:n(),mind:n(),endurance:n(),strength:n(),dexterity:n(),intelligence:n(),faith:n(),arcane:n() }),
    leveling_priority: a(stageItem, "加点优先级路线", 3),
    soft_caps_note: s(),
  }),

  equipment: o({
    weapons: a(weaponItem, "", 1),
    armor_sets: a(o({
      pieces: a(armorPiece),
      total_weight: n(), poise: n(), why: s(),
    }), "", 1),
    talismans: a(talismanItem, "", 0, 4),
    consumables: a(consumableItem),
  }),

  skills_and_spells: o({
    core_skills: a(o({ name:s(), type:s("",["ash_of_war","sorcery","incantation","spirit_ash"]), fp_cost:n(), usage:s(), how_to_get:s() })),
    spirit_ash: o({ name: s(), upgrade_level: s(), usage: s() }),
    wonderous_physick: o({ tear1: s(), tear2: s(), effect: s() }),
  }),

  gameplay_guide: o({
    core_loop: s("基础战斗循环"),
    combo_rotation: a(comboItem),
    buff_sequence: a(s()),
    advanced_tech: a(techItem),
  }),

  matchups: o({
    strong_against: a(matchupStrong),
    weak_against: a(matchupWeak),
  }),

  summary: s("一句话总结，评价这个Build"),
});

export const buildGuideSchema = buildFunctionSchema(
  "generate_build_guide",
  "生成一篇完整的角色配装/Build指南",
  root,
  ["build_name","game_name","build_overview","stat_allocation","equipment","gameplay_guide","matchups"],
);
