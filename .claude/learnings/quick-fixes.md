# Quick Fix Patterns — ResortPro Dark Mode

Common problems এবং তাদের instant fix।

---

## "Modal টা সাদা দেখাচ্ছে dark mode এ"

```bash
# File খোঁজো
grep -n "bg-white\|#ffffff" apps/web/src/components/YourModal.tsx
```

Fix:
```tsx
// Modal container
className="... bg-white dark:bg-[#1a2e2a]"

// Modal header border
className="... border-gray-100 dark:border-white/10"
```

---

## "Row hover করলে সাদা হয়ে যায় dark mode এ"

```bash
# সব জায়গা একসাথে খোঁজো
grep -rn "hover:bg-\[#faf9f7\]" apps/web/src/
```

Fix (batch):
```bash
sed -i '' 's/hover:bg-\[#faf9f7\]/hover:bg-[#faf9f7] dark:hover:bg-white\/5/g' FILE.tsx
```

---

## "Text পড়া যাচ্ছে না dark mode এ"

```tsx
// Label/caption
className="... text-gray-700 dark:text-[#94b8b0]"

// Primary text
style={{ color: 'var(--rp-text)' }}

// Conditional (e.g. status color)
const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === 'dark';
style={{ color: isError ? '#c43c3c' : isDark ? '#dfd9d0' : '#18231f' }}
```

---

## "Input field dark mode এ দেখাচ্ছে না"

```tsx
style={{
  background: 'var(--rp-surface-3)',  // auto dark
  color: 'var(--rp-text)',            // auto dark
  border: '1px solid var(--rp-border)',
}}
```

---

## "Step indicator / progress bar dark এ অদৃশ্য"

```tsx
// Inactive circle
'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-white/40'

// Divider line
'bg-gray-200 dark:bg-white/10'
```

---

## Batch fix সব hover এর জন্য (সব file)

```bash
cd /Users/parthohore/Hotel\ management
find apps/web/src -name "*.tsx" | xargs grep -l "hover:bg-\[#faf9f7\]\|hover:bg-\[#f5f4f1\]" | while read f; do
  sed -i '' \
    's/hover:bg-\[#faf9f7\]/hover:bg-[#faf9f7] dark:hover:bg-white\/5/g; s/hover:bg-\[#f5f4f1\]/hover:bg-[#f5f4f1] dark:hover:bg-white\/5/g' \
    "$f"
done
```
