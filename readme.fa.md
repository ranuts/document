# ویرایشگر آنلاین سند

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

پرونده‌های Word، Excel و PowerPoint را در همان زبانهٔ مرورگر باز کنید و ویرایش کنید. هیچ
کارسازی در میان نیست: موتور OnlyOffice و مبدل WASM آن روی دستگاه خود کاربر اجرا می‌شوند،
بنابراین سندها هرگز بارگذاری نمی‌شوند و به هیچ حسابی هم نیاز نیست.

**نشانی سایت: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ ویژگی‌ها

- 🔒 **هیچ‌چیز بارگذاری نمی‌شود** — هر تبدیل، ویرایش و برون‌بری درون همان زبانه انجام می‌شود
- 📝 **ویرایش واقعی، نه پیش‌نمایش** — DOCX، XLSX، PPTX و CSV، به‌همراه ODF، RTF، TXT و قالب‌های دودویی قدیمی؛ PDF باز می‌شود و می‌توان روی آن یادداشت گذاشت
- 🕓 **با بستن زبانه چیزی از دست نمی‌رود** — ویرایش‌ها خودکار در مرورگر خودتان ذخیره می‌شوند، ۷ روز می‌مانند و هر زمان قابل پاک شدن‌اند ([جزئیات](#-داده‌های-شما-روی-دستگاه-خودتان-می‌ماند))
- 📴 **آفلاین هم کار می‌کند** — به‌صورت PWA نصب‌شدنی است؛ پس از نخستین بازدید به شبکه نیازی نیست
- 🌍 **چندزبانه** — ۸ زبان برای رابط سایت و ۴۵ زبان برای خود ویرایشگر
- 🧩 **قابل جاسازی** — رابط برنامه‌نویسی کامل postMessage برای یکپارچه‌سازی در iframe
- 🤖 **آمادهٔ عامل‌ها** — ابزارهای WebMCP را در دسترس می‌گذارد تا عامل هوش مصنوعی درون مرورگر بتواند سند را باز کند، تبدیل کند و بخواند
- 🚀 **همه‌جا قابل استقرار** — یک ساخت ایستا؛ پوشه‌ای از پرونده‌ها پشت هر کارساز وب

---

## 🚀 شروع سریع

**همین‌طور استفاده کنید:** [edit.chaxus.com](https://edit.chaxus.com/) — چیزی برای نصب نیست.

**میزبانی خودتان با Docker:**

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

**اجرا از روی کد:**

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install
pnpm run dev
```

---

## 📄 قالب‌ها

| گونه        | ویرایش                     | باز کردن                    |
| ----------- | -------------------------- | --------------------------- |
| سند         | `.docx`                    | `.doc` `.odt` `.rtf` `.txt` |
| صفحه‌گسترده | `.xlsx` `.csv`             | `.xls` `.ods`               |
| ارائه       | `.pptx`                    | `.ppt` `.odp`               |
| PDF         | یادداشت، پر کردن، برون‌بری | `.pdf`                      |

همهٔ اینها را می‌توان به PDF برون‌بری کرد. CSV هنگام خروج رمزگذاری خود را نگه می‌دارد
(هنگام باز کردن، UTF-8، GB18030 و Latin-1 تشخیص داده می‌شوند).

---

## 🔗 مسیرها و پارامترهای نشانی

| مسیر                  | چیست                                                        |
| --------------------- | ----------------------------------------------------------- |
| `/`                   | صفحهٔ آغازین. تا چیزی باز نکنید، ویرایشگر بارگذاری نمی‌شود. |
| `/editor`             | خود ویرایشگر.                                               |
| `/history`            | سندهایی که این مرورگر نگه داشته است (پایین‌تر).             |
| `/help`, `/changelog` | از روی مارک‌داون‌های `content/` ساخته می‌شوند.              |

پارامترهای `/editor`:

| پارامتر      | توضیح                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `src=<url>`  | باز کردن سند از یک نشانی (آن نشانی باید CORS را اجازه دهد)                                                                      |
| `file=<url>` | همان، با املای قدیمی؛ اگر هر دو باشند این یکی برنده است                                                                         |
| `new=docx`   | ساختن سند خالی (`docx`، `xlsx`، `pptx`)                                                                                         |
| `doc=<id>`   | باز کردن دوبارهٔ سندی از تاریخچهٔ این مرورگر — ویرایشگر شناسهٔ خودش را اینجا می‌گذارد، پس بارگذاری دوباره به همان سند برمی‌گردد |
| `readonly=1` | باز کردن فقط برای دیدن: ویرایش و برون‌بری غیرفعال می‌شوند                                                                       |
| `embed=1`    | حالت جاسازی؛ صفحهٔ میزبان ویرایشگر را با postMessage هدایت می‌کند                                                               |
| `locale=fa`  | زبان رابط                                                                                                                       |

---

## 🔐 داده‌های شما روی دستگاه خودتان می‌ماند

سندها به هیچ‌جا فرستاده نمی‌شوند. تنها دو چیز به‌طور محلی نگه داشته می‌شود و هر دو را
خودتان می‌توانید پاک کنید:

- **نسخه‌هایی از آنچه ویرایش کرده‌اید.** هنگام کار، ویرایشگر سند را در همین مرورگر
  (IndexedDB) ذخیره می‌کند تا بارگذاری دوباره، بستن زبانه یا از کار افتادن مرورگر کارتان را
  از بین نبرد. بار بعد که ویرایشگر را باز کنید، همان را به شما پیشنهاد می‌دهد. این نسخه‌ها
  برای آن‌اند که کار نیمه‌تمام را پی بگیرید — پشتیبان نیستند، پس هر چه را می‌خواهید نگه
  دارید برون‌بری کنید.
- **هفت روز، و بعد رفته.** هر سند هفت روز پس از آخرین ویرایش یا باز کردنش خودبه‌خود پاک
  می‌شود، چه برگردید و چه برنگردید.

[`/history`](https://edit.chaxus.com/history) آنچه را ذخیره شده فهرست می‌کند؛ در هر سطر
دکمهٔ پاک کردن هست، یک «پاک کردن همه» و کلیدی برای خاموش کردن کامل ذخیرهٔ خودکار. پاک کردن
از آنجا بی‌درنگ اثر می‌کند. روی رایانهٔ مشترک، همین صفحه جایی است که باید سر بزنید.

---

## 🧩 جاسازی با iframe

ویرایشگر را جاسازی کنید و با postMessage هدایتش کنید. تقسیم کار معمول این است: سامانهٔ شما
احراز هویت و ذخیره‌سازی را بر عهده می‌گیرد و iframe ویرایش را.

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

```js
// باز کردن یک سند
iframe.contentWindow.postMessage(
  { id: '1', type: 'document:open-url', payload: { url: 'https://example.com/doc.xlsx' } },
  'https://your-deployment',
);

// شنیدن نتیجه
window.addEventListener('message', (e) => {
  if (e.data?.type === 'document:opened') console.log('آمادهٔ ویرایش');
  if (e.data?.type === 'document:saved') uploadFile(e.data.payload.file);
});
```

ویرایشگر جاسازی‌شده تاریخچهٔ محلی نگه نمی‌دارد — سند از آنِ صفحهٔ میزبان است.

→ **[مرجع کامل API](docs/embed-api.md)** — همهٔ گونه‌های پیام، فهرست مبدأهای مجاز، حالت
فقط‌خواندنی و روند ذخیره.

به‌صورت مؤلفه هم در دسترس است: همین پروژه پیش‌نمایش سند را در
[@ranui/preview](https://www.npmjs.com/package/@ranui/preview)
([مستندات](https://chaxus.github.io/ran/src/ranui/preview/)) به کار می‌اندازد.

---

## 🤖 عامل‌های هوش مصنوعی در مرورگر (WebMCP)

جایی که مرورگر پشتیبانی کند، صفحه ابزارهایی را ثبت می‌کند که عامل به‌جای کار کردن با رابط
کاربری مستقیماً آنها را فرا می‌خواند: `open_document_url`، `open_document_buffer`،
`create_document`، `save_document`، `get_document_text`، `set_readonly`،
`get_document_state`. در این حالت هم سندها دستگاه را ترک نمی‌کنند — خود مرورگر آنها را
می‌گیرد و تبدیل می‌کند. جایی که این API نباشد، هیچ اتفاقی نمی‌افتد.

---

## 🚀 استقرار

یک ساخت ایستا — بدون زمان اجرا، بدون پایگاه داده.

```bash
pnpm build   # خروجی در dist/
```

### میزبانی ایستا (Cloudflare Pages، Nginx، Vercel، Netlify و…)

`dist/` را بارگذاری کنید. `public/_headers` قرارداد حافظهٔ نهانی را دارد که سایت بر آن
حساب می‌کند (دارایی‌های هش‌دار تغییرناپذیر، سرویس‌ورکر هرگز در حافظهٔ نهان). میزبان‌هایی که
آن را نادیده بگیرند باز هم کار می‌کنند، فقط بیشتر بازبینی می‌کنند.

در Nginx، `index.html` را به‌عنوان پاسخ پیش‌فرض مسیرهای ناشناخته سرو کنید:

```nginx
location / {
  root /var/www/document;
  try_files $uri $uri/ /index.html;
}
```

### GitHub Pages

`.github/workflows/pages-build-site.yml` با هر push به `main` می‌سازد و منتشر می‌کند. در
تنظیمات مخزن، Pages را با منبع **GitHub Actions** روشن کنید.

### Docker

```bash
# ساده
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest

# با HTTPS و احراز هویت پایه
docker run -d --name document -p 443:443 \
  -v /path/to/certs:/ssl \
  -e SERVER_BASIC_AUTH='user:$2y$...' \
  -e SERVER_HTTP2_TLS=true \
  -e SERVER_HTTP2_TLS_CERT=/ssl/cert.pem \
  -e SERVER_HTTP2_TLS_KEY=/ssl/key.pem \
  ghcr.io/ranuts/document:latest
```

`SERVER_BASIC_AUTH` یک هش BCrypt می‌گیرد؛ برای گریز در پوسته، نویسه‌های `$` را دوبرابر
کنید. تنظیم حافظهٔ نهان تصویر در `sws.toml` است.

---

## 🔤 قلم‌ها

ساخت همراه OnlyOffice کتابخانهٔ قلم‌هایش را در `public/fonts/` می‌آورد که با
`public/sdkjs/common/AllFonts.js` نمایه شده است. قلم‌ها در زمان نیاز گرفته می‌شوند — هر سند
تنها همان‌هایی را می‌گیرد که واقعاً به کار می‌برد.

→ **[راهنمای مدیریت قلم‌ها](docs/fonts.md)** — قالب کاتالوگ نمایه‌شده، ثبت‌ها، و افزودن قلم
با `bin/font-catalog.mjs`.

---

## 🛠 توسعه

```bash
pnpm install --frozen-lockfile
pnpm run dev            # کارساز توسعه
pnpm run build          # ساخت تولیدی (bin/build.sh)
pnpm run lint           # oxlint + tsc + بررسی پیکربندی docker
pnpm run test           # آزمون‌های واحد (Vitest)
pnpm run test:e2e       # آزمون‌های سرتاسری (Playwright، ویرایشگر واقعی + WASM واقعی)
```

مجموعهٔ سرتاسری به‌جای بدل‌ها، ویرایشگر و مبدل واقعی را به کار می‌اندازد؛ شامل رفت‌وبرگشت
سند، پروتکل جاسازی و روند بازیابی. در `docs/explorations/` نوشته شده که هر بخش غیربدیهی چرا
این‌گونه است — پیش از دست بردن در یکپارچگی ویرایشگر، خواندنش می‌ارزد.

---

## 📚 بر پایهٔ

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) و [web-apps](https://github.com/ONLYOFFICE/web-apps) — ویرایشگرهای OnlyOffice
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — مبدل سند بر پایهٔ WASM
- [ranui / ranuts](https://github.com/chaxus/ran) — سامانهٔ طراحی و ابزارهایی که این سایت با آنها ساخته شده
- [se-office](https://github.com/Qihoo360/se-office)، [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — کارهای پیشین در اجرای OnlyOffice بدون کارساز سند

## 🤝 مشارکت

از Issue و Pull Request استقبال می‌شود. شاخهٔ `main` محافظت‌شده است: روی یک شاخه کار کنید و
PR باز کنید تا lint، آزمون‌های واحد و سه مجموعهٔ سرتاسری (کارساز توسعه، رفتار Cloudflare
Pages و تصویر تولیدی Docker) اجرا شوند.

## 📄 پروانه

[AGPL-3.0](LICENSE)
