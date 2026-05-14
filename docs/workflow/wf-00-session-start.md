# WF-00 — Session Start Workflow

## এই file টা প্রতিটি নতুন session শুরুতে পড়তে হবে

---

## Step 1 — PROGRESS.md পড়ো

সবার আগে এই file খোলো:

```
docs/PROGRESS.md
```

এতে দেখবে:
- **Current Task** → এখন কোন কাজ চলছে
- **Status** → কতটুকু হয়েছে
- **Next Step** → ঠিক কোথা থেকে শুরু করতে হবে
- **Context** → কাজ বুঝতে যা জানা দরকার

---

## Step 2 — Task file পড়ো

PROGRESS.md-এ Current Task-এর link থাকবে। সেই task file খোলো।

```
docs/tasks/task-XX-feature-name.md
```

এতে পাবে:
- Task-এর সব ছোট ছোট steps
- কোন step শেষ (✅) কোনটা বাকি (🔲)
- কোন files touch করতে হবে
- কীভাবে test করতে হবে

---

## Step 3 — Code দেখো (দরকার হলে)

Task file-এ relevant files list থাকবে। দরকার হলে সেগুলো read করো — তবে PROGRESS.md-এর context পড়লে সাধারণত বোঝা যায়।

---

## Step 4 — কাজ শুরু করো

Task-এর পরের অসম্পূর্ণ step থেকে শুরু করো।
প্রতিটি step শেষ হলে task file-এ `🔲` → `✅` করো।

---

## Step 5 — Session শেষে PROGRESS.md update করো

Session শেষ করার আগে অবশ্যই:

1. Task file-এ completed steps `✅` mark করো
2. `docs/PROGRESS.md` update করো:
   - কী হয়েছে লেখো
   - পরের session কোথা থেকে শুরু করবে লেখো
3. Commit + push করো

```bash
git add docs/
git commit -m "progress: [task name] — [কী হয়েছে]"
git push origin [current-branch]
```

---

## Quick Reference

| File | Purpose |
|------|---------|
| `docs/PROGRESS.md` | Master tracker — সবসময় সত্য |
| `docs/tasks/task-XX.md` | একটা feature-এর সব steps |
| `docs/plan/part-XX.md` | High-level feature plan |
| `docs/workflow/wf-XX.md` | কীভাবে কাজ করতে হয় |
