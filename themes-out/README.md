# themes-out — Tier 2 template themes (source files)

Every `.html` here is a **sellable website theme**. `/theme` writes them, the
admin panel uploads them, and resort owners buy them one-time (see
[plan/theme-studio-and-design-service.md](../plan/theme-studio-and-design-service.md)).

## These files are tracked in git on purpose

They are inventory. The copy stored in the database is *deployed state*, not a
backup — if that database is ever reset or migrated, these files are what each
theme gets restored from. Commit a theme the same day you make it.

## Making one

```
/theme
```

It asks nine questions about the resort and design direction, then writes a
finished `.html` here. The structural rules it follows —  data tokens, required
section ids, widget mount points, the no-JavaScript rule — are specified in
[plan/theme-contract.md](../plan/theme-contract.md).

## Publishing one

1. Admin → Themes → Add Theme → Upload Package → pick the `.html`
2. It lands **inactive**, status `PREVIEW` — nothing is live yet
3. Check it at `/theme-preview/<key>`
4. Set the price (default $30 / ৳3000) and activate it on the Themes page

**The filename is the identity.** `sunset-villa.html` becomes the key
`sunset-villa`, shown to owners as "Sunset Villa". Renaming the file later
creates a *second* theme rather than renaming the first, so pick it once and
keep it. `luxe`, `minimal`, `coastal`, and `tea-garden-eco-resort` are reserved
by the built-in themes and will be rejected.

## If an upload is rejected

The uploader enforces the contract's security rules and refuses the whole file
rather than importing part of it. The usual causes:

| Error | Cause |
|---|---|
| `Missing required section id(s)` | `id="rooms"` and `id="booking"` are mandatory |
| `Contains a <script> tag` / `on*=` / `fetch(` / `eval(` | The public site shares an origin with the dashboard, so any JS in a theme could read a logged-in owner's auth token. Motion has to be CSS-only. |
| `Contains {{{triple-brace}}}` | Bypasses Handlebars escaping — an XSS hole |
| `Key … is reserved` | Rename the file |
