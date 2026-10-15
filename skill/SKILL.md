---
name: session-film
description: Turn the current Claude Code session (or a piece of work just finished) into a 30-second vertical 3D film showing the real steps, the real tools and the real before/after numbers, rendered with session-film. Use when the user asks to "make a film of this session", "replay this", "turn this into a video post" or runs /session-film.
---

# Session film

The renderer is the session-film repository (clone it once, for example in `~/session-film`, then `npm install`). A JSON story becomes a 1080×1920 MP4 with music and sound effects in about a minute.

## 1. Gather the facts from the conversation

- **Steps**: 3 to 8 concrete actions that were actually done, 35 characters max each ("Domain fixed on Vercel", "14 photos compressed").
- **Tools**: the 2 to 6 tools really used (Search Console, Vercel, GitHub, Chrome, Supabase, Figma…). Every step points to one tool.
- **Numbers**: only before/after values measured during the session. Never estimate, never round in your favour. No measurement means no number card.
- **Client privacy**: leave out private client data (traffic, calls, revenue, business profile stats) unless the user says the client agreed. Prefer public measurements (Lighthouse, page weight, errors fixed).
- **Websites**: if the work is about a site, take mobile screenshots with `node shoot.mjs <url> stories/<name>`.

## 2. Write the story

`stories/<name>/story.json`. Copy `stories/memory-cleanup` (English) or `stories/memoire` (French) and follow the field table in the README. Short sentences, `*word*` for accent words, `|` to split a hook sentence over two lines, `locale` for number formatting. The `validated` line should say the human stayed in charge. The ending carries the user's own line and name: ask for them if you don't know them.

## 3. Check, then render

1. `node make.mjs stories/<name>/story.json --stills` writes 6 key frames to `stories/<name>/stills/`. Look at them: overflowing text, empty scenes, wrong numbers. Fix the story and repeat.
2. `node make.mjs stories/<name>/story.json` writes `stories/<name>/<name>.mp4`. Check a frame grid of the MP4 (`ffmpeg -vf fps=0.5,tile=...`).
3. `--preview` serves the same scene live in the browser.

## 4. After

Remind the user to tell the client before publishing if their site or name appears, and offer a short caption for the post.
