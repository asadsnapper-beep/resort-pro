# ResortPro Android — পূর্ণ UI ও UX পরিকল্পনা

> অবস্থা: **কাজ চলমান পরিকল্পনা** · সর্বশেষ যাচাই: ৩০ অক্টোবর ২০২৬
>
> পাঠক: product owner, designer, Android ও backend developer এবং tester
>
> উদ্দেশ্য: পাঁচটি role-এর জন্য পুরো Android app-এর screen, ব্যবহারপথ, design
> এবং development order এক জায়গায় রাখা। এটি প্রথম release-এর পরিকল্পনা;
> কোনো প্রস্তাবিত screen তৈরি হয়েছে বা production-ready—এমন দাবি নয়।

## ১. লক্ষ্য ও সীমা

App-টি resort-এর দৈনন্দিন কাজ ফোনে সহজ করবে: আজকের অবস্থা দেখা, রুম খোঁজা,
guest check-in, housekeeping task সম্পন্ন করা এবং অনুমতি অনুযায়ী রিপোর্ট দেখা।
Shareholder নিজের investment তথ্য দেখবেন। Android app-এ web dashboard-এর সব
module হুবহু আনা প্রথম release-এর লক্ষ্য নয়।

**যে নীতি সব screen-এ থাকবে:**

- মূল কাজ প্রথমেই স্পষ্ট; এক screen-এ অপ্রয়োজনীয় অনেক action নয়।
- নমুনা সংখ্যা বা mockup-এর তথ্য বাস্তব ডেটা হিসেবে দেখানো যাবে না।
- ব্যবহারকারীর role ও server permission অনুযায়ী তথ্য ও action দেখাতে হবে।
- Loading, empty, error, offline ও সফল অবস্থার জন্য আলাদা পরিষ্কার বার্তা থাকবে।
- Guest, document ও financial তথ্য শুধু অনুমোদিত জায়গায় দেখা যাবে।
- বাংলা ও ইংরেজি, dark ও light theme, বড় font এবং screen reader বিবেচনায় ডিজাইন।

## ২. Design direction

আমাদের আলোচনায় তৈরি Home, Rooms, Analytics ও Walk-in mockup-এর সাধারণ দিক:
উষ্ণ ivory, গভীর forest green, শান্ত sage, সীমিত gold ও coral accent; বড় serif
heading, সহজে পড়া যায় এমন body text, নরম corner এবং পর্যাপ্ত ফাঁকা জায়গা।
ছবি থাকলে তা কাজের তথ্যকে ঢেকে দেবে না।

| অংশ | পরিকল্পনা |
| --- | --- |
| Brand | ResortPro-এর অনুমোদিত logo ও একই রঙের ব্যবহার; mockup-এর logo চূড়ান্ত asset ধরে নেওয়া যাবে না। |
| Typography | শিরোনামে ব্যক্তিত্ব, তথ্য ও form-এ পরিষ্কার সহজ font; বড় text-এ layout ভাঙবে না। |
| Cards | গুরুত্বপূর্ণ তথ্য ও action সহজে আলাদা করা; status কেবল রং দিয়ে নয়, label দিয়েও বোঝানো। |
| Navigation | Role অনুযায়ী সীমিত destination; active tab স্পষ্ট; Android Back প্রত্যাশামতো কাজ করবে। |
| Forms | স্পষ্ট label, উপযুক্ত keyboard/date picker, field-এর পাশে ভুলের বার্তা; প্রয়োজন হলে ধাপে বিভক্ত। |
| Images | আসল room photo থাকলে দেখানো; না থাকলে সুশৃঙ্খল placeholder। Guest/ID photo-তে বিশেষ privacy নিয়ম। |
| Interaction | বড় touch target, বোধগম্য feedback, প্রয়োজনে ছোট ও সংযত animation; motion কমানোর পছন্দ মানা। |
| Theme | আলো ও অন্ধকার দুই mode-এ যথেষ্ট contrast; mockup light হলেও dark mode বাদ নয়। |

Mockup হলো visual direction; বাস্তব screen-এ তথ্যের সঠিকতা, usability ও
backend capability আগে যাচাই করতে হবে। Bottom navigation-এর **More** mockup-এ
আছে, কিন্তু বাস্তবে সেটি এখনো তৈরি হয়নি; ভবিষ্যৎ destination হিসেবে পরিকল্পিত।

## ৩. Role অনুযায়ী ব্যবহারপথ

| Role | Login-এর পর বর্তমান landing | বর্তমানে Android-এ প্রবেশ | পরিকল্পিত পরবর্তী অভিজ্ঞতা |
| --- | --- | --- | --- |
| Owner | Home dashboard | Rooms, Housekeeping, Walk-in, Analytics | পূর্ণ operational ও অনুমোদিত financial overview, guest/stay ও settings। |
| Manager | Home dashboard | Rooms, Housekeeping, Walk-in, Analytics | দৈনন্দিন operations ও অনুমোদিত reports; প্রয়োজন হলে ownership নয় এমন সীমা নির্ধারণ। |
| Receptionist | Home dashboard | Rooms, Housekeeping, Walk-in | Arrival/departure, guest lookup ও দ্রুত check-in; financial analytics নয়। |
| Staff | Assigned Housekeeping | নিজের housekeeping task | বড় action, নিজের task/status, offline sync-এর স্পষ্ট অবস্থা। |
| Shareholder | নিজের investment summary | Personal summary | নিজস্ব ownership, অনুমোদিত financial summary ও payout history; read-only। |

এটি **UI navigation-এর বর্তমান বিবরণ ও প্রস্তাব**, চূড়ান্ত permission matrix
নয়। Route লুকানো authorization নয়: backend-এ প্রতিটি role, tenant ও resource-এর
access আলাদাভাবে enforce এবং test করতে হবে। বিশেষ করে নতুন Android Analytics
screen-এর অনুমতি ও backend endpoint-এর role restriction একসঙ্গে যাচাই করা বাকি।

## ৪. Navigation map

```text
App open
├─ Session নেই / মেয়াদ শেষ → Sign in → role অনুযায়ী landing
├─ App lock চালু → Unlock → আগের অনুমোদিত অবস্থান
├─ Owner / Manager / Receptionist → Home
│  ├─ Rooms → room list / status filter / live availability → room details
│  ├─ New walk-in → Stay → Room → Guest + photos → Review → Confirmation
│  ├─ Guests & stays → search → guest profile / recent bookings
│  ├─ Housekeeping → task list → status update
│  ├─ Analytics [Owner/Manager UI] → report details [planned]
│  └─ More / Settings [planned]
├─ Staff → My housekeeping tasks → task status
└─ Shareholder → My investment → payout history [planned]
```

বর্তমানে bottom bar Home, Rooms ও Analytics-এ প্রযোজ্য role অনুযায়ী দেখা যায়।
Housekeeping ও Walk-in Home থেকে খোলে; Staff সরাসরি Housekeeping পান। Mockup-এর
**More** এবং পূর্ণ bottom-navigation আচরণ পরবর্তী design কাজ।

## ৫. Screen-by-screen plan

অবস্থার অর্থ: **প্রাথমিক** = code আছে, কিন্তু পুরো design/validation শেষ নয়;
**আংশিক** = প্রয়োজনের কিছু অংশ আছে; **পরিকল্পিত** = এখনো পূর্ণ screen নেই।
Device-এ একবার খোলা মানেই সব role বা edge case verified নয়।

| Screen | কার জন্য | কী কাজ / প্রধান উপাদান | বর্তমান অবস্থা ও বাকি কাজ |
| --- | --- | --- | --- |
| Launch / session restore | সবাই | Session restore, অপেক্ষার সময় স্পষ্ট loading, expiry হলে sign-in। | সাময়িক network/server error-এ session রেখে retry screen দেখানো হয়; বাস্তব account দিয়ে process death ও expiry পরীক্ষা বাকি। |
| Sign in | সবাই | Resort slug, email, password, show/hide, sign-in ও field error। | প্রাথমিক; S21-এ খোলা হয়েছে। Mockup-এর সঙ্গে polish, সম্পূর্ণ বাংলা ও accessibility বাকি। |
| Email verification / session error | সবাই | কী সমস্যা, কী করতে হবে এবং আবার চেষ্টা করার পথ। | Sign-in-এ verification state আছে; সব auth error ও recovery flow যাচাই বাকি। |
| App lock | সমর্থিত device-এ opted-in user | Phone credential/biometric দিয়ে unlock, প্রয়োজন হলে password sign-in। | প্রাথমিক; device lock, cancellation, background/foreground ও accessibility test প্রয়োজন। |
| Owner / Manager Home | Owner, Manager | Resort পরিচিতি, আজকের arrivals/departures/occupancy, quick actions, অনুমোদিত revenue, Analytics link। | প্রাথমিক; বাস্তব dashboard data S21-এ দেখা হয়েছে। অনুমোদিত mockup-এর ছবি, তিন-column actions, icon, spacing ও পূর্ণ polish বাকি। |
| Receptionist Home | Receptionist | আজকের কাজ, available rooms, check-in এবং housekeeping shortcuts; guest-facing দ্রুত workflow। | Role-aware operational Home আছে; receptionist-specific prioritisation ও বাস্তব কাজের test বাকি। |
| Rooms & Availability | Owner, Manager, Receptionist | Room count/status, status filter, check-in/out date picker, live availability, room cards। | প্রাথমিক; S21-এ list ও navigation দেখা হয়েছে। List সর্বোচ্চ প্রথম ৩০০ room; সীমিত list-এর count বলে দিতে হবে। Mockup-এর room image ও পূর্ণ polish বাকি। |
| Room details | Owner, Manager, Receptionist | Room name, status, capacity, amenities, ছবি ও অনুমতিপ্রাপ্ত পরবর্তী action। | প্রাথমিক screen: room details ও selected dates-এর live availability আলাদা দেখায়; offline cached তথ্য চিহ্নিত। একই API origin-এর public ছবি দেখায়, অন্য ছবিতে placeholder; room/date walk-in-এ আবার নির্বাচন করতে হয়। সম্পূর্ণ live workflow ও অন্য image host যাচাই বাকি। |
| Walk-in: Stay | Owner, Manager, Receptionist | তারিখ picker, adults/children count, live availability শুরু। | প্রাথমিক চার-ধাপ flow আছে; demo-তে একটি সম্পূর্ণ check-in করা হয়েছে। |
| Walk-in: Room | Owner, Manager, Receptionist | Available room নির্বাচন, capacity, server quote ও retry। | প্রাথমিক; demo live availability/quote দেখা হয়েছে। Race, stale quote ও conflict test বাড়াতে হবে। |
| Walk-in: Guest | Owner, Manager, Receptionist | নাম, optional phone/notes; optional guest photo ও ID photo, ID type, preview/retake/remove। | প্রাথমিক camera UI আছে; S21-এ দুই ধরনের capture/preview দেখা হয়েছে। Private storage ও deployed backend নিশ্চিত না হওয়া পর্যন্ত বাস্তব ID upload readiness দাবি করা যাবে না। |
| Walk-in: Review / Confirmation | Owner, Manager, Receptionist | Guest, room, date, সংখ্যা, estimated price, payment ও ছবি যাচাই; confirm; booking number। | Demo booking confirmation দেখা হয়েছে। Photo upload server-এ end-to-end যাচাই বাকি। |
| Housekeeping overview | Owner, Manager, Receptionist | Task list, status/filter, assignee ও নির্দিষ্ট task update। | Summary ও refreshed task cards আছে; pending offline update আলাদা দেখানো হয়। Offline conflict ও live server authorization যাচাই বাকি। |
| My housekeeping | Staff | শুধু নিজের assigned task, প্রাধান্যপূর্ণ next action, task status ও sync state। | Staff সরাসরি এখানে যায়; বড় action ও pending-sync indicator আছে। Offline conflict ও বাস্তব role-এ সম্পূর্ণ workflow পরীক্ষা দরকার। |
| Analytics | Owner, Manager — বর্তমান Android UI | Monthly revenue, current occupancy, ৩০ দিনের bookings, ৯০ দিনের average rate, monthly expenses, ৯০ দিনের sources এবং ১২ মাসের revenue chart। | প্রাথমিক live data S21-এ দেখা হয়েছে। Mockup-এর period selector/visual polish নেই; সময়ের সীমা label-এ সত্যভাবে দেখাতে হবে; server-side authorization যাচাই বাকি। |
| Investment Home | Shareholder | নিজের ownership ও অনুমোদিত personal summary, read-only। | প্রাথমিক personal summary আছে; data scope ও role test সম্পূর্ণ করা বাকি। |
| My payouts | Shareholder | নিজের payout history, date/status ও empty state। | পরিকল্পিত; personal endpoint ও authorization যাচাই করে তৈরি করতে হবে। |
| Guest search / profile | Owner, Manager, Receptionist | নাম/phone দিয়ে guest খোঁজা, profile ও সর্বশেষ সর্বোচ্চ ১০টি booking। | প্রাথমিক read-only UI; guest তথ্য offline cache করা হয় না, document/photo দেখানো হয় না। Live server role/tenant isolation ও বাস্তব account-এ end-to-end test বাকি। |
| Booking details | Owner, Manager, Receptionist | Guest, room, তারিখ, status ও confirmation; নিজের resort-এর সব booking-এর payment summary। | User অনুমোদিত policy অনুযায়ী Receptionist booking payment দেখবেন, কিন্তু aggregate financial reports নয়। Local mobile API tenant-scoped ও সীমিত projection দেয়; deploy ও live test হয়নি; পুরোনো web API-র privacy আলাদা যাচাই প্রয়োজন। |
| Booking / stay details | অনুমোদিত operational role — প্রস্তাব | Confirmation, guest, room, dates, status, payment summary ও উপযুক্ত পরবর্তী কাজ। | পরিকল্পিত; server workflow ও permission যাচাই প্রয়োজন। |
| More / Settings | সবাই; role অনুযায়ী option | Profile, ভাষা, theme, app lock, privacy, support, sign out। | পরিকল্পিত; mockup-এর More এখন clickable destination নয়। |
| Permission / camera recovery | ছবি নেওয়ার অনুমতিপ্রাপ্ত role | Camera unavailable/cancel/error, retake/remove; permission বা device সমস্যা বুঝিয়ে retry। | প্রাথমিক camera error ও preview আছে; সব failure ও lifecycle test বাকি। |
| Shared feedback states | প্রযোজ্য screen-এর user | Loading, retry, no results, validation, access denied, offline/cache age, sync/conflict। | কিছু screen-এ আছে; সব screen-এ একই ব্যবহার ও Bengali copy দরকার। |

## ৬. প্রধান flow ও UX নিয়ম

### ৬.১ Login ও role landing

1. Slug, email ও password দিয়ে sign in; invalid input সংশ্লিষ্ট field-এ দেখাতে হবে।
2. Session restore বা email verification চললে অবস্থা স্পষ্ট থাকবে।
3. Owner/Manager/Receptionist Home, Staff assigned tasks এবং Shareholder নিজের
   investment summary দেখবেন। অচেনা role-এর জন্য অনুমতি ছাড়া তথ্য খুলবে না।
4. App lock optional; সেটি চালু থাকলে device credential দিয়ে ফিরতে হবে।

### ৬.২ Room খোঁজা

1. Room list-এ বর্তমান operational status এবং filter দেখা যাবে।
2. তারিখ বেছে server-এ availability চাইতে হবে। Room-এর বর্তমান status এবং
   নির্বাচিত ভবিষ্যৎ তারিখের availability এক জিনিস নয়—দুটির label আলাদা।
3. Offline cached list-এর last-sync সময় দেখাতে হবে; cached availability-কে
   নিশ্চিত booking availability বলা যাবে না।
4. প্রথম ৩০০ room পর্যন্ত সীমিত list হলে count/filter অসম্পূর্ণ হতে পারে—সেটি
   দৃশ্যমান রাখতে হবে; পরবর্তী ধাপে সম্পূর্ণ pagination ডিজাইন করতে হবে।

### ৬.৩ Walk-in check-in ও photos

1. **Stay:** dates ও guest সংখ্যা → live available rooms।
2. **Room:** room ও server price quote নির্বাচন; capacity ও conflict যাচাই।
3. **Guest:** প্রয়োজনীয় নাম, optional phone/notes; guest ও ID photo আলাদা capture,
   preview, retake, remove এবং ID type। ছবি বাধ্যতামূলক কি না product decision।
4. **Review:** সব তথ্য, estimated price, payment ও ছবির উপস্থিতি দেখে submit।
5. **Confirmation:** booking number দেখানো। Booking-এর ফল অনিশ্চিত হলে
   Front Desk-এ যাচাই ছাড়া auto-retry নয়। Booking offline queue করা যাবে না।
6. Booking সফল হওয়ার পর photo upload-এর আলাদা progress/result থাকবে। Upload
   ব্যর্থ বা ফল অনিশ্চিত হলে booking পুনরায় তৈরি হবে না; staff কীভাবে যাচাই ও
   পুনরুদ্ধার করবেন সেটি স্পষ্ট হতে হবে।

**Photo release gate:** চালু server-এ নির্দিষ্ট guest-photo type ও private
storage/deployment যাচাই, role/tenant isolation, temporary file lifecycle,
upload failure ও retry/reconciliation এবং camera → booking → upload → authorised
retrieval-এর end-to-end test শেষ না হওয়া পর্যন্ত বাস্তব ID-এর জন্য প্রস্তুত নয়।
S3/R2 private delivery নিশ্চিত না হলে upload বন্ধ থাকা প্রয়োজন।

### ৬.৪ Housekeeping ও offline

- Staff শুধু নিজের task দেখবেন; overview role অনুমতিপ্রাপ্ত scope দেখবেন।
- Online update ও local queued update আলাদা বোঝাতে হবে। Last synced সময় দেখাতে হবে।
- Queue sync, conflict, permission পরিবর্তন বা স্থায়ী failure হলে staff যেন
  জানেন কী ঘটেছে এবং কী করবেন। অন্যের নতুন status নীরবে overwrite নয়।
- বর্তমান outbox implementation-এর conflict visibility, account পরিবর্তন,
  process death ও retry behaviour production-এর আগে আরও যাচাই করতে হবে।

### ৬.৫ Shareholder

নিজের ownership ও personal investment summary read-only থাকবে। Payout list ও
তারিখ/স্ট্যাটাস আলাদা screen-এ দেখানোর প্রস্তাব; অন্য shareholder বা resort-এর
সম্পূর্ণ finance দেখানোর অনুমতি এখানে ধরে নেওয়া হচ্ছে না।

## ৭. Shared state ও interaction checklist

প্রতিটি screen implementation শেষ করার আগে যাচাই:

- **Loading:** কোন তথ্য আসছে বোঝা যায়; দীর্ঘ অপেক্ষায় retry/error আছে।
- **Empty:** কোনো তথ্য নেই নাকি filter-এর কারণে নেই, তা বোঝা যায়।
- **Error:** সমস্যা ও পরবর্তী কাজ লেখা; form/input সম্ভব হলে অক্ষত থাকে।
- **Offline:** কোন তথ্য cached, কবে sync হয়েছে, কোন action online লাগে তা স্পষ্ট।
- **Permission:** অনুমতি না থাকলে সংবেদনশীল ডেটা বা action দেখা/চলা যাবে না।
- **Long content:** ছোট ফোন, বড় font, keyboard ও landscape-এ লেখা বা action চাপা পড়ে না।
- **Accessibility:** status text-সহ, contrast ও touch target যথেষ্ট, TalkBack label অর্থবহ।
- **Language:** বাংলা ও ইংরেজি দুই ভাষায় copy, তারিখ ও currency যাচাই।
- **Lifecycle:** rotation, background, ফিরে আসা ও process death-এ আচরণ যাচাই।

## ৮. বাস্তবায়নের অগ্রাধিকার

| ধাপ | কাজ | শেষ হওয়ার শর্ত |
| --- | --- | --- |
| 1 | **Photo privacy ও Walk-in completion** | Private backend/storage ও deployment যাচাই, failure recovery নির্ধারণ, test image দিয়ে পুরো flow; বাস্তব ID ব্যবহার নয়। |
| 2 | **Shared design foundation** | অনুমোদিত logo, theme, typography, buttons, cards, status, spacing ও navigation-এর reusable উপাদান; light/dark/large text যাচাই। |
| 3 | **Home ও Rooms mockup অনুযায়ী polish** | তিনটি মূল action, accurate data, room image/placeholder, date ও status filter; device screenshot review। |
| 4 | **Walk-in চার ধাপ polish** | Stay/Room/Guest/Review, safe booking, photo states ও সফল/ব্যর্থ অবস্থার device test। |
| 5 | **Housekeeping / Staff experience** | Role-scoped task list, বড় সহজ action, offline queued/conflict visibility এবং বাস্তব device test। |
| 6 | **Analytics** | Backend authorization, মেট্রিকের সঠিক সময়সীমা, সত্যিকারের data ও chart; period selector কেবল API সমর্থন করলে। |
| 7 | **Shareholder ও payout history** | নিজের data-তে সীমাবদ্ধ read-only experience ও role isolation test। |
| 8 | **Guest ও stay details** | অনুমোদিত search/profile, booking details ও private document access। |
| 9 | **Settings, ভাষা ও release polish** | More/profile, app lock, privacy/support, বাংলা/ইংরেজি, accessibility, lifecycle ও signed release verification। |

প্রতিটি ধাপে প্রথমে flow ও data contract নিশ্চিত → UI → automated test →
S21 Ultra-তে smoke test → প্রয়োজনমতো অন্য screen size/Android version যাচাই।
ধাপগুলোর আনুমানিক সময় ও scope implementation শুরুতে আলাদা করে নির্ধারণ হবে।

## ৯. Product সিদ্ধান্ত বাকি

1. Guest photo এবং ID photo কোন resort/booking-এ বাধ্যতামূলক হবে, নাকি optional?
2. ID-এর শুধু সামনের ছবি, নাকি front/back; একাধিক guest-এর জন্য কী প্রয়োজন?
3. ছবি কতদিন রাখা হবে, কারা দেখতে/মুছতে পারবেন এবং upload অসম্পূর্ণ থাকলে কে সমাধান করবেন?
4. Manager-এর financial report এবং Shareholder-এর ঠিক কোন তথ্য দেখার অনুমতি থাকবে?
5. More-এ প্রথম release-এর কোন settings ও support action দরকার?
6. Analytics-এর প্রয়োজনীয় সময়সীমা ও প্রতিটি metric-এর নির্দিষ্ট business definition কী?
7. Mockup-এর resort image, logo ও room image-এর চূড়ান্ত অনুমোদিত asset কোনগুলো?

এই প্রশ্নগুলোর উত্তর না পাওয়া পর্যন্ত বাস্তব সংবেদনশীল ডেটা, নতুন permission বা
অতিরিক্ত workflow সম্পর্কে সিদ্ধান্ত অনুমান করে চূড়ান্ত করা যাবে না।

## ১০. সম্পর্কিত নথি

- [Android architecture ও development roadmap](ARCHITECTURE.md)
- [Android engineering guide](BEST_PRACTICES.md)
- [Play release ও privacy checklist](PLAY_STORE_COMPLIANCE.md)
- [আগের Android code review](CODE_REVIEW_2026-08-29.md)

পুরোনো নথিতে তারিখভিত্তিক অবস্থা বা photo capture deferred থাকার উল্লেখ থাকতে
পারে। এই UI plan নতুন কাজের উদ্দেশ্য ও বর্তমান code review অনুযায়ী লেখা; release
readiness ঘোষণা করার আগে সংশ্লিষ্ট নথি ও বাস্তব implementation আবার মিলিয়ে নিতে হবে।
