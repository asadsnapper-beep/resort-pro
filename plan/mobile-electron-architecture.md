# Mobile ও Desktop অ্যাপ প্ল্যান

## উদ্দেশ্য
এই প্ল্যানটি প্রোজেক্টের বর্তমান `apps/mobile` ও `apps/web` স্ট্রাকচার থেকে আলাদা করে:
- একটি native Android মোবাইল অ্যাপ Kotlin দিয়ে তৈরি করা
- একটি desktop অ্যাপ Electron JS দিয়ে তৈরি করা

## 1. Kotlin মোবাইল অ্যাপ

### কেন Kotlin?
- React Native / JS ভিত্তিক মোবাইল অ্যাপ বাদ দিয়ে native Android app বানানো
- performance ও platform integration আরও ভাল হয়
- ভবিষ্যতে KMM বা iOS port করার সুযোগ থাকে

### স্ট্রাকচার
- নতুন ফোল্ডার: `apps/mobile-kotlin` বা `apps/android`
- backend API থেকে data লোড করা হবে
- UI screens: login, dashboard, room listing, reservation, guest profile, notifications
- authentication ও local persistence Android-native ভাবে কাজ করবে

### কাজের স্টেপ
1. API endpoint inventory তৈরি করা
2. Kotlin data classes ও network client ডিজাইন করা
3. অ্যাপের স্ক্রিন ফ্লো প্ল্যান করা
4. Android UI/UX তৈরি করা
5. build ও release configuration সেট করা

## 2. Electron desktop অ্যাপ

### কেন Electron?
- ওয়েব অ্যাপ `apps/web` থেকে UI reuse করে desktop wrapper বানাতে পারবে
- ওয়েব ব্যবহারকারীদের জন্য native desktop installable অ্যাপ

### স্ট্রাকচার
- নতুন ফোল্ডার: `apps/desktop` বা `apps/electron`
- Electron main process ও renderer process সেট আপ
- renderer হিসেবে current Next.js / React UI ব্যবহার করা যাবে
- native window controls, local storage, desktop notifications যোগ করা যাবে

### কাজের স্টেপ
1. `apps/web` থেকে production-ready build বের করা
2. Electron entry point ও packaging কনফিগার করা
3. desktop-specific features যেমন এক্সটেন্ডেড permissions বা local caching যোগ করা
4. installer/package build তৈরি করা

## 3. backend reuse
- বর্তমান backend `apps/api` অপরিবর্তিত থাকবে
- Kotlin অ্যাপ ও Electron ডেক্সটপ উভয়ই একই API ব্যবহার করবে
- `packages/types` থেকে data contract বিশ্লেষণ করে API ক্লায়েন্ট তৈরি করা

## 4. পরবর্তী কাজ
- `apps/mobile` Expo/React Native কোড আর নতুন কাজের জন্য archive বা migrate করা
- `apps/web` থেকে `apps/electron` এ reuse করার architecture ঠিক করা
- build pipeline ও release plan তৈরি করা
