# WF-01 — Git Branching Workflow

## Overview
ResortPro project-এ নতুন feature বা bug fix করার সময় এই workflow follow করতে হবে।
`main` branch সবসময় stable এবং production-ready থাকবে।

---

## Branch Structure

```
main                        → Production-ready, always stable
│
├── feature/feature-name    → নতুন feature
├── fix/bug-name            → Bug fix
└── docs/doc-name           → শুধু documentation update
```

---

## Branch Naming Rules

| Type | Format | Example |
|------|--------|---------|
| New feature | `feature/short-name` | `feature/mobile-app` |
| Bug fix | `fix/short-description` | `fix/booking-calendar-bug` |
| Documentation | `docs/short-description` | `docs/api-reference` |

**Rules:**
- সব lowercase
- Space-এর বদলে hyphen (`-`)
- Short এবং descriptive
- বাংলা লেখা নয়, English-এ নাম দাও

---

## Step-by-Step Workflow

### Step 1 — কাজ শুরুর আগে main latest নাও

```bash
git checkout main
git pull origin main
```

### Step 2 — নতুন branch তৈরি করো

```bash
git checkout -b feature/your-feature-name
```

### Step 3 — কাজ করো এবং commit করো

```bash
# Files edit করার পর stage করো
git add .

# Commit করো (meaningful message দাও)
git commit -m "feat: add mobile booking screen"
```

### Step 4 — কাজের মাঝে মাঝে push করো (backup হিসেবে)

```bash
git push origin feature/your-feature-name
```

### Step 5 — Feature complete হলে main-এ merge করো

```bash
# Main-এ চলে যাও
git checkout main

# Latest main নাও
git pull origin main

# Branch merge করো
git merge feature/your-feature-name

# GitHub-এ push করো
git push origin main
```

### Step 6 — Branch delete করো (optional but clean)

```bash
# Local branch delete
git branch -d feature/your-feature-name

# Remote branch delete
git push origin --delete feature/your-feature-name
```

---

## Commit Message Format

```
type: short description

Examples:
feat: add guest payment link feature
fix: resolve booking calendar overlap bug
docs: update API documentation
refactor: clean up auth middleware
style: improve dashboard card layout
```

| Prefix | কখন ব্যবহার করবে |
|--------|-----------------|
| `feat:` | নতুন feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `refactor:` | Code restructure (নতুন feature না) |
| `style:` | UI/UX change |
| `chore:` | Config, dependency update |

---

## Real Example — Mobile App Feature

```bash
# 1. Latest main নাও
git checkout main
git pull origin main

# 2. Feature branch তৈরি
git checkout -b feature/mobile-app

# 3. কাজ করো... কাজ করো... commit করো
git add apps/mobile/
git commit -m "feat: mobile app initial setup with Expo Router"

git add apps/mobile/src/screens/
git commit -m "feat: add booking screen with date picker"

git add apps/mobile/src/screens/
git commit -m "feat: add room listing screen"

# 4. GitHub-এ backup push
git push origin feature/mobile-app

# 5. Feature done — main-এ merge
git checkout main
git pull origin main
git merge feature/mobile-app
git push origin main

# 6. Cleanup
git branch -d feature/mobile-app
git push origin --delete feature/mobile-app
```

---

## Useful Commands

```bash
# সব branch দেখো (local)
git branch

# সব branch দেখো (local + remote)
git branch -a

# বর্তমানে কোন branch-এ আছো
git status

# Branch switch করো
git checkout branch-name

# কোন file কতটুকু changed দেখো
git diff

# Commit history দেখো
git log --oneline -10
```

---

## Do's and Don'ts

### ✅ করো
- প্রতিটি feature-এ আলাদা branch বানাও
- ছোট ছোট commit করো (একটা কাজ = একটা commit)
- Commit message meaningful লেখো
- কাজ শেষে push করো (backup)
- `main`-এ merge করার আগে `git pull origin main` করো

### ❌ করো না
- সরাসরি `main`-এ কাজ করো না
- বড় একটা commit-এ সব কিছু দিও না
- Commit message-এ "update" বা "fix" এভাবে একা লিখো না
- কাজ শেষ না হলে main-এ merge করো না
