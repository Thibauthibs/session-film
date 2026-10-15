# session-film

A JSON story becomes a vertical 1080×1920 3D film (three.js 0.170, rendered by Chrome on the GPU, captured frame by frame) with music and sound effects. Public repository: github.com/Thibauthibs/session-film. Code comments are in French.

## Layout

- `engine/index.html` + `engine/film.js`: the scene. Everything is a function of time, `update(t)`. `?story=<url>` loads a story, `?capture` switches to capture mode (`window.renderAt(t)`). Scenes: particle hook (1 to 4 sentences morphed in a shader), before (3D phone with a screenshot, gauge, card), agent and tools (2 to 6 nodes on a circle, tubes, one pulse per step, typing terminal), results (3D gauge bursting past 90, 1 to 3 before/after cards), signature (scrolling phone, or an orb without screenshot). All typography is HTML over the canvas; titles shrink to fit.
- `engine/timeline.js`: automatic timing from the story (sentences, steps, cards), shared by the browser and Node.
- `engine/audio/`: `pub_audio.py` + `sfx.py`, synthesized music and sound effects (numpy, scipy); `-` as voice file means no voice.
- `make.mjs`: timeline → `mix.wav` → built-in static server → puppeteer capture → `stories/<name>/<name>.mp4`. Options `--stills [t1,t2]` and `--preview` (port 8899). A failed frame is retried; without Python the film is silent.
- `shoot.mjs <url> <dir>`: mobile screenshots of a site (`site-hero.jpg` at ×3, `site-scroll.jpg` limited to 8,000 px tall, the GPU texture limit).
- `skill/SKILL.md`: the Claude Code skill to install in `~/.claude/skills/session-film/`.
- `stories/`: public examples `memory-cleanup` (English) and `memoire` (French). `legacy/` and client stories are gitignored and must never be published.

## Pitfalls

- ES modules do not work over file://: always go through `make.mjs` (built-in server).
- `npx` is rewritten by a shell hook on the author's machine: run binaries by path.
- Numbers shown in a film must be measured during the session; no private client data without the client's consent.
