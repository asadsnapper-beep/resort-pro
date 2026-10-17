# Build prompt: a Mac app that turns typed lines into ResortPro marketing reels

Paste this whole file into a **fresh session, in a new empty folder** — not this
repository. It describes an app to build from scratch. Ask before adding
anything not asked for here.

---

## What it is

A small macOS desktop app, for one person, that turns a few typed lines into a
**vertical marketing video** for ResortPro — the hotel/resort management SaaS
sold to resort owners in Bangladesh.

The person using it writes:

```
Topic: Front desk
5 things ResortPro does for your front desk
- Walk-in guest checked in under a minute
- Room status on one screen, always current
- Invoice printed before they reach the lift
- Works offline when the internet drops
- Bangla for the people actually using it
```

…picks a **look**, and gets a 1080×1440 MP4 with the lines revealed one by one,
branded, with an end card. No editor, no timeline, no keyframes.

It is a personal tool. **No accounts, no server, no cloud, no telemetry.**
Everything runs offline on the Mac and writes the file to `~/Downloads`.

## Why it is being built

Marketing ResortPro means a steady stream of short vertical videos for
Facebook and Instagram, in Bangla and English. Making them by hand in a video
editor takes an hour each and they come out inconsistent. This makes one in
about a minute and they all look like the same brand.

---

## The content model

Plain text, one screen of it. No rich-text document format.

| Line | Meaning |
|---|---|
| `Topic: Front desk` | a small chip at the top of the card |
| First non-`Topic:` line | the title |
| `- something` or `• something` | one point, revealed on its own |
| A blank line then more text | supporting paragraph under the points |
| `---` on its own line | ends this video and starts the next |

Two inline marks, applied to the selection:

- **⌘B** — bold
- **⌘H** — highlight (a coloured marker sweep behind the words)

Both must survive into the video, animated: bold appears with the line,
highlight sweeps in a moment later. Store them as offsets on the line, not as
HTML.

**One file can hold several videos** separated by `---`. Rendering produces one
MP4 per section, numbered.

## Looks

A look is a named bundle of choices. The app ships with three and they are data,
not code — a JSON file per look, so a new one needs no rebuild.

| | |
|---|---|
| **Name** | e.g. "Resort Clean" |
| **Fonts** | a display font for the title, a text font for points |
| **Palette** | background, text, accent, highlight |
| **Reveal** | how a point arrives: `fade-up`, `type-on`, `wipe` |
| **Points** | bullet style: `dot`, `arrow`, `number`, `tick` |
| **Motion** | a slow background: `drift`, `kenburns` on a still, `none` |
| **Sound** | a per-point tick, and a background bed, both optional |
| **Pace** | `fast` (reels, ~1.6s a point) or `calm` (~2.6s) |

Three to ship with:

1. **Resort Clean** — ResortPro's own palette (`#1a6b5e` green, `#d4a853` gold),
   Inter, fade-up, tick bullets, no bed. The default.
2. **Sunset Coast** — warm gradient, Playfair Display + Inter, wipe, dot
   bullets, soft bed. For guest-facing resort content.
3. **Bangla Board** — Hind Siliguri throughout, dark green board, type-on,
   arrow bullets. For Bangla posts.

## Branding panel

Set once, remembered, overridable per video:

- Brand name (default **ResortPro**) and handle
- End card: a big line and a small line — e.g. "Start free at resortpro.site"
- A logo PNG with transparency, shown on the end card, with a checkbox to
  include it in this video
- Video size: `3:4 — 1080×1440` (default) or `9:16 — 1080×1920`
- Effects volume, and a mute for everything

## ⚠️ Bangla is not an afterthought

The audience is Bangladeshi resort owners, so **most videos will be in Bangla**,
and Bangla is where naive text rendering fails: conjuncts and vowel signs need
proper shaping, and a font without Bengali coverage silently renders boxes.

- Ship **Hind Siliguri** and **Noto Sans Bengali** with the app. Do not rely on
  a system font being present.
- Render Bangla through a real text shaper — a browser's own layout engine
  qualifies, a canvas `fillText` with a font that lacks the glyphs does not.
- **Test with this string in every look before calling any of it done:**
  `৫টি জিনিস যা ResortPro আপনার ফ্রন্ট ডেস্কের জন্য করে` — mixed Bangla and
  Latin in one line, which is how these posts are actually written.
- Numbers: Bangla posts mix `৫` and `5`. Do not "normalise" either.

---

## How to build it

**Stack, and why.** Render with **Remotion** (React components → frames →
ffmpeg), wrapped in an **Electron** shell so it is a Mac app with an icon.

- Remotion exists for exactly this: text and timing as React, rendered
  deterministically. Layout and Bangla shaping come from Chrome, so the hard
  problem above is already solved.
- Electron because a `.app` was asked for, and `electron-builder --mac` is a
  one-line packaging step.
- `ffmpeg` is already installed on this Mac (`/opt/homebrew/bin/ffmpeg`).

**Check Remotion's licence before committing to it.** It is free for
individuals and small companies and paid above a threshold. If that does not
fit, the fallback is a hidden `BrowserWindow`, `capturePage()` per frame, and
pipe to ffmpeg — more code, same idea, no licence question. Ask which is
preferred rather than deciding alone.

### Steps, each finished before the next

1. **Electron shell** — a window, two panes, and nothing else. It builds and
   opens.
2. **The editor** — plain text, `⌘B`, `⌘H`, and the parser for `Topic:`,
   points, `---`. Show the parsed structure as JSON in the right pane. No video
   yet. *Verify: paste the Bangla test string and the marks survive a reparse.*
3. **The card preview** — the right pane renders the parsed content as a still
   card in the chosen look. *Verify: all three looks, in Bangla and English.*
4. **One rendered video** — the "Resort Clean" look only, no sound, no end card.
   Write it to `~/Downloads` and **watch it**. *Verify: every point appears, in
   order, with the marks; nothing is cut off; no boxes instead of Bangla.*
5. **Looks as data** — move the look into JSON, add the other two, add a picker.
6. **Branding and the end card** — including the logo PNG.
7. **Sound** — per-point tick and the background bed, with the mute.
8. **Several videos per file** — `---`, numbered output, and a progress line
   per section.
9. **Package** — `electron-builder --mac`, an icon, and a `.app` that runs on a
   Mac that has never seen the source.

Keep each step small and verify it by **watching the output**, not by reading
the code. A video that renders without error and looks wrong is the normal
failure here.

### Things that will go wrong, so plan for them

- **Fonts must be bundled and loaded before the first frame renders**, or frame
  1 uses a fallback and the rest use the real font. Wait for `document.fonts.ready`.
- **A long point must wrap, not overflow.** Test with a 140-character point.
- **Audio and video length must agree** — if a bed is shorter than the video it
  has to loop, and if longer, be cut.
- **The output must be H.264 + AAC in an MP4**, or Facebook and Instagram will
  re-encode it badly.
- **Rendering is slow.** Show progress and never freeze the window.

## Out of scope — do not build these

- Any login, account, subscription or licence check
- Uploading to Facebook, Instagram or anywhere else
- A timeline, keyframes, or arbitrary layer editing
- AI generation of the copy — the person writes the words
- Windows or Linux builds
- Stock footage or music libraries; ship a handful of files or none

## What to report back

1. Which rendering approach was used, and the licence answer.
2. The path of a finished MP4, made from the Bangla test string, in each of the
   three looks.
3. Anything in this file that turned out to be wrong or impossible.
