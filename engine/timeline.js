// Minutage automatique d'un film à partir d'une histoire (story.json).
// Module pur, utilisé par le navigateur (film.js) et par Node (make.mjs → bande son).
// Chaque scène est optionnelle sauf l'accroche ; les durées s'adaptent au nombre de phrases, d'étapes et de chiffres.

export function buildTimeline(story) {
  const scenes = {}, cues = {}, sfx = [];
  const add = (name, at) => sfx.push([name, +at.toFixed(3)]);

  // 1. Accroche : une phrase de plus toutes les 1,05 s
  const nH = Math.max(1, Math.min(4, (story.hook || []).length));
  scenes.hook = 0;
  cues.intro = [0.05, 0.7];
  add("whoosh", 0.05); add("pop", 0.7);
  cues.morphs = [];
  for (let i = 1; i < nH; i++) {
    const a = 0.25 + i * 1.05;
    cues.morphs.push([a, a + 0.45]);
    add("whoosh", a); add("pop", a + 0.45);
  }
  let t = 0.25 + nH * 1.05 + 0.5;
  cues.scatter = [t - 0.4, t + 0.3];
  add("whoosh_down", t - 0.4);

  // 2. Point de départ (facultatif)
  const B = story.before;
  if (B) {
    scenes.before = t;
    cues.phoneIn = [t + 0.1, t + 1.0];
    cues.beforeTitle = t + 0.3;
    cues.ringIn = t + 1.2;
    cues.ringFill = [t + 1.4, t + 2.2];
    cues.beforeCard = t + 2.4;
    add("whoosh", t + 0.1);
    if (B.screenshot) add("pop", t + 0.95);
    if (B.gauge) { add("tick", t + 1.45); add("tick", t + 1.75); add("tick", t + 2.05); add("ding", t + 2.2); }
    if (B.card) add("pop", t + 2.4);
    t += 4.5;
  }

  // 3. L'agent et ses outils : 0,9 s par étape
  const A = story.agent;
  scenes.agent = t;
  cues.phoneOut = [t, t + 0.8];
  cues.agentTitle = t + 0.2;
  cues.agentIn = t + 0.3;
  cues.edges = [t + 0.7, t + 1.4];
  cues.pulse = 0.45;
  add("whoosh", t); add("pop", t + 0.3);
  cues.steps = A.steps.slice(0, 8).map((_, i) => t + 1.7 + i * 0.9);
  cues.steps.forEach((s) => { add("send", s); add("check", s + 0.45); });
  cues.validated = cues.steps[cues.steps.length - 1] + 0.9;
  if (A.validated) add("stamp", cues.validated);
  t = cues.validated + 0.9;

  // 4. Résultats (facultatif)
  const R = story.results;
  if (R) {
    scenes.results = t;
    cues.resultTitle = t + 0.1;
    add("whoosh", t);
    let c = t + 0.9;
    if (R.gauge) {
      cues.bigRing = t + 0.3;
      cues.bigFill = [t + 0.7, t + 2.3];
      add("pop", t + 0.3); add("riser", t + 0.7); add("boom", t + 2.3);
      c = t + 2.9;
    }
    cues.cards = (R.cards || []).map((_, i) => c + i * 0.6);
    cues.cards.forEach((x) => add("pop", x));
    const lastCard = cues.cards.length ? cues.cards[cues.cards.length - 1] : c - 0.6;
    cues.footnote = lastCard + 0.8;
    t = Math.max(cues.footnote + 1.6, t + 5.2);
  }

  // 5. Signature
  const E = story.end || {};
  scenes.end = t;
  cues.phoneBack = [t, t + 0.9];
  cues.endText = t + 0.3;
  cues.name = t + 1.6;
  cues.scroll = [t + 0.9, t + 4.4];
  cues.fadeOut = [t + 4.4, t + 5.0];
  add("whoosh", t);
  if (E.scroll) add("pop", t + 0.9);
  add("ding", t + 1.6);
  const total = +(t + 5.0).toFixed(3);

  return { total, scenes, cues, sfx: sfx.sort((a, b) => a[1] - b[1]), voiceOffset: 0, bpm: story.bpm || 118, chords: story.chords || "warm" };
}
