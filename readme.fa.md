# <img src="public/icons/document.svg" width="28" height="28" align="absmiddle" alt=""> ویرایشگر آنلاین سند

<p align="center">
  <a href="https://github.com/ranuts/document/actions/workflows/ci.yml">
    <img src="https://github.com/ranuts/document/actions/workflows/ci.yml/badge.svg" alt="CI Status">
  </a>
  <a href="https://github.com/ranuts/document/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/ranuts/document" alt="License">
  </a>
  <a href="https://github.com/ranuts/document/releases">
    <img src="https://img.shields.io/github/v/release/ranuts/document" alt="Version">
  </a>
  <a href="https://edit.chaxus.com/">
    <img src="https://img.shields.io/badge/Live-edit.chaxus.com-brightgreen" alt="Live site">
  </a>
</p>

<p align="center">
  <a href="readme.md">English</a> |
  <a href="readme.zh.md">简体中文</a> |
  <a href="readme.ja.md">日本語</a> |
  <a href="readme.ko.md">한국어</a> |
  <a href="readme.de.md">Deutsch</a> |
  <a href="readme.es.md">Español</a> |
  <a href="readme.pt.md">Português</a> |
  <b>فارسی</b>
</p>

**فضای کار اسناد در مرورگر، برای شما و عامل‌های هوش مصنوعی شما.**

فایل‌های Word، Excel و PowerPoint را در مرورگر باز، ویرایش و ذخیره کنید و به PDF یادداشت اضافه کنید. بدون حساب کاربری یا نصب Office.

**[امتحان آنلاین](https://edit.chaxus.com/)** · [مشاهدهٔ کد](https://github.com/ranuts/document)

---

## ✨ ویژگی‌ها

- **ویرایش و تبدیل محلی.** سندها روی دستگاه شما پردازش می‌شوند؛ ویرایش و تبدیل نیازی به بارگذاری سند ندارد.
- **ذخیره به انتخاب شما.** در مرورگرهای سازگار در فایل انتخاب‌شده ذخیره کنید یا خروجی را دانلود کنید. کارهای اخیر را در همین مرورگر ادامه دهید.
- **کار با هوش مصنوعی (Experimental Beta).** متن بنویسید و اصلاح کنید، داده‌های صفحه‌گسترده را پردازش کنید، اسلاید بسازید یا دربارهٔ صفحهٔ فعلی PDF بپرسید. تغییرات را پیش از اعمال بررسی کنید.
- **عامل‌ها ابزارهای سند را فراخوانی می‌کنند.** در مرورگرهای سازگار با [WebMCP](docs/reference.md#webmcp-agent-tools)، عامل‌های هوش مصنوعی می‌توانند فایل‌ها را باز، تبدیل و خروجی بگیرند و متن سندهای متنی را بخوانند.
- **نصب به‌صورت PWA.** مانند یک برنامه استفاده کنید؛ منابع کش‌شدهٔ ویرایشگر به‌صورت آفلاین هم کار می‌کنند.
- **میزبانی یا جاسازی.** یک سایت ایستا میزبانی کنید یا ویرایشگر را با API مبتنی بر iframe در برنامهٔ خود قرار دهید.

## 🚀 شروع سریع

[سند جدید](https://edit.chaxus.com/editor?new=docx&locale=en) · [صفحه‌گستردهٔ جدید](https://edit.chaxus.com/editor?new=xlsx&locale=en) · [ارائهٔ جدید](https://edit.chaxus.com/editor?new=pptx&locale=en)

یا نسخهٔ خود را اجرا کنید:

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

## 📄 قالب‌ها

| گونه        | ویرایش                     | باز کردن                    |
| ----------- | -------------------------- | --------------------------- |
| سند         | `.docx`                    | `.doc` `.odt` `.rtf` `.txt` |
| صفحه‌گسترده | `.xlsx` `.csv`             | `.xls` `.ods`               |
| ارائه       | `.pptx`                    | `.ppt` `.odp`               |
| PDF         | یادداشت، پر کردن، برون‌بری | `.pdf`                      |

سندهای پشتیبانی‌شده را می‌توان به PDF خروجی گرفت.

رابط چندزبانه، پوستهٔ روشن و تیره و پیش‌نمایش فقط‌خواندنی نیز پشتیبانی می‌شوند.

## 🔐 ویرایش محلی و نحوهٔ پردازش داده‌ها

نسخه‌های بازیابی تا ۷ روز پس از آخرین ویرایش یا بازکردن در این مرورگر می‌مانند. در [سندهای ذخیره‌شده](https://edit.chaxus.com/history) حذفشان کنید. این نسخه‌ها پشتیبان نیستند؛ فایل‌های مهم را خروجی بگیرید.

سرویس‌های بیرونی هوش مصنوعی محتوای لازم برای درخواست را دریافت می‌کنند. مدل‌های روی دستگاه آن را محلی پردازش می‌کنند. دیکته ممکن است از سرویس گفتار آنلاین استفاده کند؛ خروجی جاسازی‌شده را برنامهٔ میزبان مدیریت می‌کند.

## مستندات و یکپارچه‌سازی

[راهنمای کاربر](https://edit.chaxus.com/help) · [میزبانی، نشانی‌ها و یکپارچه‌سازی](docs/reference.md) · [API جاسازی](docs/embed-api.md) · [قلم‌ها](docs/fonts.md)

استفادهٔ آفلاین به منابع کش‌شدهٔ ویرایشگر نیاز دارد. منابع کش‌نشده و فایل‌های راه دور همچنان به شبکه نیاز دارند.

## دستیار هوش مصنوعی (Experimental Beta)

متن بنویسید و اصلاح کنید، با داده‌های صفحه‌گسترده کار کنید، اسلاید بسازید یا دربارهٔ صفحهٔ فعلی PDF بپرسید. تغییرات را پیش از اعمال بررسی کنید و در صورت نیاز برگردانید.

مدل روی دستگاه را انتخاب کنید یا سرویس هوش مصنوعی خود را وصل کنید. در مرورگرهای دارای ورودی گفتار می‌توانید فرمان‌ها را دیکته کنید.

**Experimental Beta.** به‌طور پیش‌فرض خاموش است. پاسخ‌ها و تغییرات ممکن است اشتباه باشند؛ نتایج مهم را بررسی کنید.

<details>
<summary>دیدن چهار نمایش</summary>

| Word                                                                                                                                                      | Excel                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![نوشتن، درج، خلاصه‌سازی و بازگردانی](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9) | [![پر کردن، محاسبه، مرتب‌سازی و بازگردانی](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c) |
| **نوشتن، درج، خلاصه‌سازی و بازگردانی**                                                                                                                    | **پر کردن، محاسبه، مرتب‌سازی و بازگردانی**                                                                                                                     |
| PowerPoint                                                                                                                                                | PDF                                                                                                                                                            |
| [![ساختن، تکثیر و بازگردانی](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e)           | [![خواندن، پرسیدن و بررسی یادداشت](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9)           |
| **ساختن، تکثیر و بازگردانی**                                                                                                                              | **خواندن، پرسیدن و بررسی یادداشت**                                                                                                                             |

گردش‌کارهای کامل با سرعت عادی، رابط انگلیسی و مدل محلی Qwen3 4B از پیش بارگذاری‌شده. زمان پاسخ به مدل و دستگاه بستگی دارد.

[ویدئوها، زیرنویس‌ها و توضیحات](docs/media/ai-demos/README.md)

کمک PDF برای متن قابل‌انتخاب و یادداشت صفحه است، نه تشخیص متن تصاویر اسکن‌شده یا بازنویسی متن اصلی PDF.

</details>

## 🛠 توسعه

اجرا از کد منبع:

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install --frozen-lockfile
pnpm run dev
```

بازخورد و مشارکت خوش‌آمد است: [Issues](https://github.com/ranuts/document/issues) · [Pull requests](https://github.com/ranuts/document/pulls)

## 📚 بر پایهٔ

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) و [web-apps](https://github.com/ONLYOFFICE/web-apps) — ویرایشگرهای OnlyOffice
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — مبدل سند بر پایهٔ WASM
- [ranui / ranuts](https://github.com/chaxus/ran) — سامانهٔ طراحی و ابزارهایی که این سایت با آنها ساخته شده
- [se-office](https://github.com/Qihoo360/se-office)، [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — کارهای پیشین در اجرای OnlyOffice بدون کارساز سند

## 📄 پروانه

[AGPL-3.0](LICENSE) · [NOTICE](NOTICE)

<details>
<summary>اطلاعیه‌ها و علائم تجاری پروژهٔ اصلی</summary>

این پروژه نسخهٔ تغییریافتهٔ ویرایشگرهای ONLYOFFICE (sdkjs و web-apps، با حق نشر
Ascensio System SIA) است. رابط کاربری از نام‌های کاربردی خنثی استفاده می‌کند و نشان محصول
یا تبلیغ برند ندارد. اطلاعات حق نشر، پروانه، تغییرها و پیوند کد منبع در پنل «درباره» و
[NOTICE](NOTICE) باقی می‌ماند. عناصر رابط کاربری و قلم‌های شخص ثالث همچنان پروانه‌های خود را دارند.

تصمیم به نمایش ندادن نشان محصول با توجه به تفسیر منتشرشدهٔ FSF از بخش ۷ AGPLv3 گرفته شده
است. این تفسیر حکم دادگاه یا تضمین رعایت کامل قانون نیست. موضع پروژهٔ اصلی و مبنای تصمیم
در NOTICE ثبت شده است.

ONLYOFFICE علامت تجاری Ascensio System SIA است. این پروژه محصول رسمی نیست و هیچ وابستگی،
حمایت مالی یا تأییدی از سوی آن شرکت ندارد. نام‌ها در اعلامیه‌های حقوقی و ارجاع‌های کد تنها
برای مشخص کردن فناوری اصلی هستند، نه برند این پروژه.

برای نصب PWA و زبانه‌های مرورگر از نماد خنثی سند با طراحی مستقل استفاده می‌شود.
این نماد شامل لوگو، علامت تجاری بالادستی یا حروف اختصاری پروژه نیست.

</details>
