import { buildFunctionSchema, type Obj, type Prop } from "../schema.js";

const s = (d?: string, en?: string[]): Prop => ({ t: "s", d, en });
const n = (d?: string): Prop => ({ t: "n", d });
const b = (d?: string): Prop => ({ t: "b", d });
const a = (it: Prop | Obj, d?: string, min?: number, max?: number): Prop => ({ t: "a", it, d, min, max });
const o = (p: Record<string, Prop | Obj>, d?: string): Obj => ({ t: "o", p, d });

const pickup = o({ name: s(), type: s("",["weapon","armor","talisman","spell","consumable","key_item","collectible"]), location_detail: s(), missable: b() });

const step = o({
  step_number: n(), instruction: s("具体操作指引，含地标+动作"),
  landmarks: a(s("关键地标")), caution: s("陷阱/危险提示"), pickup: a(pickup),
});

const bossRef = o({
  name: s(), type: s("",["main","optional","elite"]),
  difficulty: s("",["easy","medium","hard","very_hard"]),
  recommended_strategy: s("简要打法"), drops: a(s()), achievement: s(),
});

const itemRef = o({
  name: s(), type: s(), location: s(),
  importance: s("",["required","recommended","optional"]), missable: b(),
});

const questRef = o({
  npc_name: s(), quest_summary: s(),
  key_choices: a(o({ choice: s(), consequence: s() })), missable: b(),
});

const chapter = o({
  chapter_number: n(), chapter_name: s("如「第一章：宁姆格福」"),
  recommended_level: s(), estimated_time: s(),
  objectives: a(s()),
  walkthrough: a(step, "", 1),
  bosses: a(bossRef),
  key_items: a(itemRef),
  npcs_and_quests: a(questRef),
  map_reference: s(),
});

const ending = o({
  name: s(), type: s("",["standard","hidden","bad","true"]),
  requirements: a(s()), point_of_no_return: s("不可逆节点"),
  trophy_or_achievement: s(),
});

const checklistSection = o({ total: n(), missable_count: n(), important_items: a(itemRef) });

const root: Obj = o({
  game_name: s(), game_name_en: s(), tags: a(s()), spoiler_warning: b(),

  game_overview: o({
    genre: s(),
    estimated_hours: o({ main_story: s(), main_plus_side: s(), completionist: s() }),
    difficulty: s("",["easy","medium","hard","very_hard"]),
    difficulty_settings: s(), missable_warning: a(s("会永久错过的重要事项")),
  }),

  preparation: o({
    recommended_start: o({ class_or_origin: s(), keepsake_or_gift: s(), reason: s() }),
    early_game_tips: a(s(), "开局就该知道的建议", 5, 10),
    key_mechanics_to_understand: a(o({ mechanic: s(), explanation: s() })),
  }),

  chapters: a(chapter, "按游戏进程划分的章节", 1),

  endings: o({ total_endings: n(), endings_list: a(ending) }),

  post_game: o({
    ng_plus_changes: a(s()), post_game_content: a(s()), cleanup_guide: a(s()),
  }),

  collectibles_checklist: o({
    weapons: checklistSection, armor_sets: checklistSection,
    talismans_or_accessories: checklistSection, spells_or_skills: checklistSection,
  }),

  summary: s("攻略末尾总结"),
});

export const walkthroughSchema = buildFunctionSchema(
  "generate_walkthrough_guide",
  "生成一篇完整的游戏全流程攻略",
  root,
  ["game_name","game_overview","preparation","chapters","endings","collectibles_checklist"],
);
