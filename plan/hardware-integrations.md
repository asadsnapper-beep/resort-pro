# Hardware Integrations — Input & Output Devices

Resort-এর physical hardware-এর সাথে ResortPro-র integration plan। তিন ক্যাটাগরি: **Printer (output)**, **Camera/Scanner (input)**, **Payment Terminal + Access Control (future)**।

> তারিখ: 2026-06-19 · মূল নীতি: browser-based যতটা সম্ভব (OS install কম); hardware-specific SDK শুধু যেখানে বাধ্য।

---

## 🖨️ Output Devices — Printer

### ১. Thermal Receipt Printer (80mm) — P1
**কোথায়:** Front desk — payment receipt, check-in confirmation slip, invoice summary  
**Hardware:** Epson TM-T88 / Star TSP / যেকোনো ESC/POS compatible  
**Connection:** USB / LAN / Bluetooth

**Integration approach:**
- **[QZ Tray](https://qz.io/)** (recommended) — lightweight desktop app, browser ↔ printer bridge; JavaScript SDK দিয়ে dashboard থেকে সরাসরি ESC/POS command পাঠানো
- Fallback: **WebUSB API** (Chrome, USB only, no app install) — limited ESC/POS support
- Dashboard-এ "🖨️ Print Receipt" button → QZ Tray detect করলে thermal print; না থাকলে browser PDF print

**Build:**
- `apps/web/src/lib/printer.ts` — QZ Tray wrapper (connect, print ESC/POS, detect)
- Dashboard booking detail + invoice page-এ thermal print button
- Receipt template: confirmation no, guest name, room, dates, amount, payment method

**Effort:** মাঝারি (~২ দিন)

---

### ২. Kitchen Thermal Printer — P2
**কোথায়:** Restaurant/kitchen — F&B order ticket (KDS-এর physical backup)  
**Hardware:** Same ESC/POS printer, kitchen counter-এ

**Integration approach:**
- KDS-এ order আসলে **auto-print option** (toggle: "Auto-print new orders")
- Same QZ Tray SDK — KDS page থেকে order ticket format print
- Ticket: table number, order items + qty, special notes, timestamp

**Effort:** ছোট (QZ Tray already wired in P1)

---

### ৩. Label Printer (Housekeeping / Luggage) — P3
**কোথায়:** Housekeeping — room service bag tag, luggage label, laundry tag  
**Hardware:** Zebra ZD series (ZPL) বা Brother QL series

**Integration approach:**
- ZPL (Zebra): QZ Tray দিয়ে raw ZPL string পাঠানো
- Brother QL: B-PAC SDK বা same QZ Tray raw print
- Housekeeping task-এ "Print Label" → guest name, room, date, task type

**Effort:** ছোট (infra same, শুধু template আলাদা)

---

### ৪. A4 Laser/Inkjet — Already Done ✅
Dashboard → Invoice PDF → browser print dialog। কোনো extra integration লাগবে না।

---

## 📷 Input Devices — Camera & Scanner

### ১. Guest ID / Passport Scanner (OCR) — P1
**কোথায়:** Front desk check-in — NID / passport / driving license scan করে guest info auto-fill  
**Hardware:** Webcam / phone camera / flatbed scanner

**Integration approach:**
- **Browser `getUserMedia()`** → live camera feed বা file upload
- **OCR:** [Tesseract.js](https://tesseract.projectnaptha.com/) (client-side, no API cost) বা Google Cloud Vision API (server-side, বেশি accurate, MRZ support)
- Extracted fields: firstName, lastName, dateOfBirth, documentNumber, nationality, expiryDate → guest form auto-fill
- Extracted image → `GuestDocument` model-এ store (existing `guestDocuments` route আছে)
- Flow: Check-in page → "Scan ID" button → camera/file → OCR → preview + confirm → save

**Priority fields (MRZ line):**
```
P<BGDRAHMAN<<MD<MIZANUR<<<<<<<<<<<<<<<<<<<<<<
A12345678<3BGD8801014M2501014<<<<<<<<<<<<<<<2
```
MRZ parsing library: `mrz` npm package (lightweight, no API)

**Effort:** মাঝারি (~১.৫ দিন); Google Vision upgrade-এ আরো ছোট

---

### ২. QR Code Scanner — P1 (Partially Done ✅)
**কোথায়:** Table ordering QR (done), room key QR (future), event pass  
**Hardware:** Phone camera (web-based) বা USB HID barcode scanner

**Status:**
- Table QR → `/<slug>/table/<n>` — ইতিমধ্যে কাজ করে (browser camera বা printed QR)
- USB HID scanner: browser keyboard event হিসেবে আসে — কোনো driver লাগে না
- Future: guest wristband QR → check-in status, room access

**Effort:** Table QR done ✅; room/event QR → ছোট

---

### ৩. Document Camera / Flatbed Scanner — P2
**কোথায়:** Front desk — physical document scan করে booking-এর সাথে attach করা  
**Hardware:** Flatbed scanner (TWAIN driver) বা document camera

**Integration approach:**
- **TWAIN.js** বা **DynamsoftSDK** — browser-based TWAIN scanner access
- Simpler: scanner software-এ "scan to folder" → dashboard file upload দিয়ে attach
- `GuestDocument` model already আছে — শুধু upload UI দরকার

**Effort:** ছোট (upload) → মাঝারি (live TWAIN scan)

---

## 💳 Payment Terminal

### POS Card Reader / bKash QR Terminal — P2
**Hardware:** bKash merchant device, SSLCommerz POS terminal, Stripe Reader  
**Status:** Payment gateway API already আছে (bKash/SSLCommerz/Stripe) — software side ready  
**Missing:** Physical terminal SDK wiring (Stripe Terminal SDK, bKash merchant app webhook)  
**Effort:** মাঝারি per gateway

---

## 🔐 Access Control — Smart Lock (Future / P4)

**Use case:** Check-in confirm → room door PIN / digital key auto-generate → SMS/app-এ পাঠানো  
**Hardware:** TTLock, Salto, ASSA ABLOY (REST API আছে), Yale smart lock  

**Integration approach:**
- `TenantIntegration` model-এ lock provider + credentials store
- Booking CONFIRMED → `generateRoomKey(bookingId)` → lock API → PIN or NFC key
- Check-out → key auto-revoke
- Guest-কে SMS/email-এ PIN

**Effort:** বড় (~৩-৪ দিন per lock vendor) · **কখন:** paying customer demand হলে

---

## 📺 Display / Digital Signage (Future)

- Lobby display: upcoming arrivals, weather, events → `/display/:slug/lobby` public page (read-only, auto-refresh)
- Room TV: welcome message, room service menu → QR or HDMI cast
- **Effort:** ছোট (শুধু একটা fullscreen public page)

---

## 🚫 Out of Scope (এখন না)

| Device | কেন না |
|--------|--------|
| CCTV / NVR | আলাদা heavy system; ResortPro-র scope না |
| Fingerprint reader | GDPR/data sensitivity; hardware vendor-specific SDK |
| Weighing scale (laundry) | Niche; serial port integration complex |
| IoT room sensors | Separate platform (Home Assistant etc.) |

---

## Build Sequence

| ধাপ | Feature | Effort | কেন আগে |
|-----|---------|--------|---------|
| 1 | Guest ID scan + OCR (check-in) | মাঝারি | সরাসরি check-in speed বাড়ায়, data accuracy বাড়ায় |
| 2 | Thermal receipt print (QZ Tray) | মাঝারি | front desk-এর daily pain point |
| 3 | Kitchen auto-print | ছোট | QZ Tray already done; F&B workflow |
| 4 | Document upload (flatbed fallback) | ছোট | guest document store |
| 5 | Label printer (housekeeping) | ছোট | same QZ Tray infra |
| 6 | POS terminal wiring | মাঝারি | payment UX complete করে |
| 7 | Smart lock integration | বড় | demand দেখে |
| 8 | Lobby/room display | ছোট | polish |

> **শুরু: ধাপ ১ (ID scan)** — no hardware purchase needed, just webcam; সবচেয়ে বেশি daily value।

---

## Tech Stack Summary

| Layer | Tool |
|-------|------|
| Thermal/label print | QZ Tray (desktop bridge) + ESC/POS / ZPL |
| Camera access | Browser `getUserMedia()` |
| OCR (client) | Tesseract.js (MRZ + general) |
| OCR (server, better) | Google Cloud Vision API |
| MRZ parse | `mrz` npm package |
| TWAIN scanner | TWAIN.js / DynamsoftSDK |
| Smart lock | Vendor REST API (TTLock / Salto) |
| QR scan | `jsQR` / `zxing` (already used in table ordering) |
