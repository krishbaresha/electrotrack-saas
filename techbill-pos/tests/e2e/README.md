# TechBill Automated Tester (Playwright)

Ye "tester" — ek real browser (Chromium) kholta hai, tumhari app mein login karta hai,
har protected page kholta hai aur crash detect karta hai, aur ek POS cart flow bhi
end-to-end chalata hai. Ye industry mein isi tarah ka QA automation hota hai.

## Ek dafa setup

`techbill-pos/package.json` mein add karo:
```json
"devDependencies": {
  "@playwright/test": "^1.48.0"
}
"scripts": {
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

```bash
cd techbill-pos
npm install
npx playwright install --with-deps chromium
```

Ek `.env.e2e` (ya CI secrets mein) banao — **hamesha ek staging/test tenant account use karo,
kabhi bhi real shop ka data test mein mat daalna:**
```
E2E_TEST_EMAIL=test@techbill.app
E2E_TEST_PASSWORD=xxxxx
E2E_TEST_PRODUCT_NAME=Sample Product   # ek product jo staging catalog mein pakka maujood ho
```

## Chalane ke liye
```bash
# backend + frontend dono chalu hone chahiye (npm run start:dev / npm run dev)
npx playwright test              # headless, terminal mein result
npx playwright test --ui         # interactive mode — dekhte hue step by step
npx playwright show-report       # last run ka HTML report + screenshots/videos of failures
```

## Ismein kya included hai
- `smoke.spec.ts` — login + 7 protected routes (`/pos`, `/dashboard`, `/inventory`, etc.)
  khulte hain aur crash/console-error detect karta hai
- `pos-cart.spec.ts` — cashier jaisa flow: product search karo, cart mein add karo,
  total update hote hue verify karo (ye tumhari app ka sabse revenue-critical path hai)

Maine code mein 2 chhote `data-testid` attributes bhi add kar diye hain
(`UniversalSearch.tsx`, `CartTable.tsx`) taake test reliably element dhoondh sake —
CSS class names change hote rehte hain, testid nahi.

## Isko CI mein daalna (recommended)
`.github/workflows/frontend-ci.yml` mein e2e step add karo (staging DB ke sath),
ya har raat cron se chalao — taake koi bhi naya bug production tak pohanchne se pehle pakda jaye.

## Aage badhane ke liye (jab time ho)
Har naye major feature (checkout, return, GRN receiving) ke liye ek spec file add karte jao.
Yehi tumhara "regression safety net" banega — jitna zyada coverage, utna kam "app crash ho gaya" phone calls.
