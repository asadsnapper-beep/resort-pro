# ResortPro — Project Learnings

এই folder এ আমাদের কাজ করতে গিয়ে যা শিখেছি, যেসব ভুল হয়েছে, এবং যেসব pattern কাজ করেছে — সব document করা আছে।

## Files

| File | বিষয় |
|------|-------|
| [dark-mode-mistakes.md](./dark-mode-mistakes.md) | Dark mode implementation এ যত ভুল হয়েছে |
| [styling-system.md](./styling-system.md) | CSS token migration — কেন করলাম, কীভাবে কাজ করে |
| [modal-pattern.md](./modal-pattern.md) | Modal/Sheet এ dark mode কীভাবে handle করতে হয় |
| [quick-fixes.md](./quick-fixes.md) | Common dark mode bugs এর quick fix patterns |

## Core Rule (এই project এ সবচেয়ে গুরুত্বপূর্ণ)

> নতুন কোনো component বানানোর সময় hardcoded hex color ব্যবহার করো না।  
> সব সময় `var(--rp-*)` tokens ব্যবহার করো।  
> তাহলে dark mode automatically কাজ করবে — আলাদা কিছু করতে হবে না।
