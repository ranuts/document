# Online-Dokumenteneditor

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
  <b>Deutsch</b> |
  <a href="readme.es.md">Español</a> |
  <a href="readme.pt.md">Português</a> |
  <a href="readme.fa.md">فارسی</a>
</p>

Word-, Excel- und PowerPoint-Dateien in einem Browser-Tab öffnen und bearbeiten. Ohne Server:
Die OnlyOffice-Engine und ihr WASM-Konverter laufen auf dem Gerät der Besucherin selbst,
Dokumente werden also nie hochgeladen, und ein Konto braucht es auch nicht.

**Live-Website: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ Funktionen

- 🔒 **Nichts wird hochgeladen** — jede Umwandlung, jede Änderung, jeder Export passiert im Tab
- 📝 **Echtes Bearbeiten, keine Vorschau** — DOCX, XLSX, PPTX und CSV, dazu ODF, RTF, TXT und die alten Binärformate; PDFs lassen sich öffnen und kommentieren
- 🕓 **Nichts geht verloren, wenn der Tab zugeht** — Änderungen werden im eigenen Browser gesichert, 7 Tage aufbewahrt, jederzeit löschbar ([Einzelheiten](#-ihre-daten-bleiben-auf-ihrem-gerät))
- 📴 **Funktioniert offline** — als PWA installierbar; nach dem ersten Besuch ist kein Netz nötig
- 🌍 **Mehrsprachig** — 8 Oberflächensprachen für die Website, 45 für den Editor selbst
- 🧩 **Einbettbar** — vollständige postMessage-API für die iframe-Integration
- 🤖 **Bereit für Agenten** — stellt WebMCP-Werkzeuge bereit, mit denen ein KI-Agent im Browser Dokumente öffnen, umwandeln und lesen kann
- 🚀 **Überall betreibbar** — ein statischer Build; ein Verzeichnis hinter irgendeinem Webserver

---

## 🚀 Schnellstart

**Einfach nutzen:** [edit.chaxus.com](https://edit.chaxus.com/) — nichts zu installieren.

**Selbst betreiben mit Docker:**

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

**Aus dem Quelltext starten:**

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install
pnpm run dev
```

---

## 📄 Formate

| Art            | Bearbeiten                           | Öffnet außerdem             |
| -------------- | ------------------------------------ | --------------------------- |
| Dokumente      | `.docx`                              | `.doc` `.odt` `.rtf` `.txt` |
| Tabellen       | `.xlsx` `.csv`                       | `.xls` `.ods`               |
| Präsentationen | `.pptx`                              | `.ppt` `.odp`               |
| PDF            | kommentieren, ausfüllen, exportieren | `.pdf`                      |

Alles davon lässt sich als PDF exportieren. CSV behält beim Export seine Kodierung
(UTF-8, GB18030 und Latin-1 werden beim Öffnen erkannt).

---

## 🔗 Routen und URL-Parameter

| Route                 | Was es ist                                                       |
| --------------------- | ---------------------------------------------------------------- |
| `/`                   | Startseite. Der Editor wird erst geladen, wenn Sie etwas öffnen. |
| `/editor`             | Der Editor.                                                      |
| `/history`            | Dokumente, die dieser Browser aufbewahrt (siehe unten).          |
| `/help`, `/changelog` | Erzeugt aus dem Markdown unter `content/`.                       |

Parameter für `/editor`:

| Parameter    | Beschreibung                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src=<url>`  | Ein Dokument von einer URL öffnen (die URL muss CORS erlauben)                                                                                             |
| `file=<url>` | Dasselbe in alter Schreibweise; gewinnt, wenn beide gesetzt sind                                                                                           |
| `new=docx`   | Ein leeres Dokument anlegen (`docx`, `xlsx`, `pptx`)                                                                                                       |
| `doc=<id>`   | Ein Dokument aus dem Verlauf dieses Browsers erneut öffnen — der Editor trägt hier seine eigene ID ein, ein Neuladen kehrt also zum selben Dokument zurück |
| `readonly=1` | Nur zum Ansehen öffnen: Bearbeiten und Exportieren sind deaktiviert                                                                                        |
| `embed=1`    | Einbettmodus; die einbettende Seite steuert den Editor über postMessage                                                                                    |
| `locale=de`  | Sprache der Oberfläche                                                                                                                                     |

---

## 🔐 Ihre Daten bleiben auf Ihrem Gerät

Dokumente werden nirgendwohin geschickt. Zwei Dinge bleiben lokal liegen, und beide
können Sie selbst entfernen:

- **Kopien dessen, was Sie bearbeitet haben.** Während Sie arbeiten, sichert der Editor
  das Dokument in diesem Browser (IndexedDB), damit ein Neuladen, ein geschlossener Tab
  oder ein Absturz die Arbeit nicht kostet. Beim nächsten Öffnen bietet er sie wieder an.
  Diese Kopien sind dazu da, dass Sie weitermachen können — sie sind keine Sicherung,
  exportieren Sie also weiterhin alles, was Sie behalten wollen.
- **Sieben Tage, dann weg.** Jedes Dokument wird sieben Tage nach der letzten Bearbeitung
  oder Öffnung automatisch gelöscht, ob Sie zurückkommen oder nicht.

[`/history`](https://edit.chaxus.com/history) listet auf, was gespeichert ist, mit einem
Löschen pro Zeile, einem Alles-Löschen und einem Schalter, der das automatische Speichern
ganz abstellt. Löschen wirkt dort sofort. Auf einem gemeinsam genutzten Rechner ist das
die Seite, die man aufsucht.

---

## 🧩 Einbetten per iframe

Betten Sie den Editor ein und steuern Sie ihn über postMessage. Die übliche Aufteilung:
Ihr System kümmert sich um Anmeldung und Speicherung, das iframe ums Bearbeiten.

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

```js
// Ein Dokument öffnen
iframe.contentWindow.postMessage(
  { id: '1', type: 'document:open-url', payload: { url: 'https://example.com/doc.xlsx' } },
  'https://your-deployment',
);

// Auf das Ergebnis hören
window.addEventListener('message', (e) => {
  if (e.data?.type === 'document:opened') console.log('Bereit zum Bearbeiten');
  if (e.data?.type === 'document:saved') uploadFile(e.data.payload.file);
});
```

Eingebettete Editoren führen keinen lokalen Verlauf — das Dokument gehört der
einbettenden Seite.

→ **[Vollständige API-Referenz](docs/embed-api.md)** — jeder Nachrichtentyp, die
Origin-Freigabeliste, der Nur-Lesen-Modus und der Speicherablauf.

Auch als Komponente verfügbar: Dieses Projekt treibt die Dokumentvorschau in
[@ranui/preview](https://www.npmjs.com/package/@ranui/preview) an
([Dokumentation](https://chaxus.github.io/ran/src/ranui/preview/)).

---

## 🤖 KI-Agenten im Browser (WebMCP)

Wo der Browser es unterstützt, meldet die Seite Werkzeuge an, die ein Agent direkt
aufrufen kann, statt die Oberfläche zu bedienen: `open_document_url`,
`open_document_buffer`, `create_document`, `save_document`, `get_document_text`,
`set_readonly`, `get_document_state`. Die Dokumente verlassen das Gerät auch dabei nicht —
der Browser holt und wandelt sie selbst. Fehlt die API, passiert schlicht nichts.

---

## 🚀 Bereitstellung

Ein statischer Build — keine Laufzeitumgebung, keine Datenbank.

```bash
pnpm build   # landet in dist/
```

### Statisches Hosting (Cloudflare Pages, Nginx, Vercel, Netlify …)

`dist/` hochladen. In `public/_headers` steht die Caching-Vereinbarung, von der die Seite
ausgeht (Assets mit Hash unveränderlich, Service Worker niemals im Cache); Hoster, die das
ignorieren, funktionieren trotzdem — sie prüfen nur häufiger nach.

Bei Nginx `index.html` als Rückfallebene für unbekannte Routen ausliefern:

```nginx
location / {
  root /var/www/document;
  try_files $uri $uri/ /index.html;
}
```

### GitHub Pages

`.github/workflows/pages-build-site.yml` baut und veröffentlicht bei jedem Push auf `main`.
Aktivieren Sie Pages in den Repository-Einstellungen mit **GitHub Actions** als Quelle.

### Docker

```bash
# Einfach
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest

# Mit HTTPS und Basic Auth
docker run -d --name document -p 443:443 \
  -v /path/to/certs:/ssl \
  -e SERVER_BASIC_AUTH='user:$2y$...' \
  -e SERVER_HTTP2_TLS=true \
  -e SERVER_HTTP2_TLS_CERT=/ssl/cert.pem \
  -e SERVER_HTTP2_TLS_KEY=/ssl/key.pem \
  ghcr.io/ranuts/document:latest
```

`SERVER_BASIC_AUTH` erwartet einen BCrypt-Hash; die `$`-Zeichen fürs Shell-Escaping
verdoppeln. Das Caching des Images wird in `sws.toml` festgelegt.

---

## 🔤 Schriften

Der mitgelieferte OnlyOffice-Build bringt seine Schriftbibliothek in `public/fonts/` mit,
indiziert über `public/sdkjs/common/AllFonts.js`. Schriften werden bei Bedarf geholt — ein
Dokument lädt nur die, die es tatsächlich verwendet.

→ **[Leitfaden zur Schriftverwaltung](docs/fonts.md)** — das Format des indizierten
Katalogs, die Registries und das Hinzufügen von Schriften mit `bin/font-catalog.mjs`.

---

## 🛠 Entwicklung

```bash
pnpm install --frozen-lockfile
pnpm run dev            # Entwicklungsserver
pnpm run build          # Produktions-Build (bin/build.sh)
pnpm run lint           # oxlint + tsc + Docker-Konfiguration
pnpm run test           # Unit-Tests (Vitest)
pnpm run test:e2e       # End-to-End-Tests (Playwright, echter Editor + echtes WASM)
```

Die End-to-End-Suite fährt den echten Editor und den echten Konverter statt Mocks, samt
Dokument-Rundläufen, dem Einbettprotokoll und dem Wiederherstellungsablauf.
`docs/explorations/` hält fest, warum jede nicht offensichtliche Stelle so ist, wie sie
ist — ein Blick lohnt sich, bevor Sie die Editor-Integration anfassen.

---

## 📚 Aufgebaut auf

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) und [web-apps](https://github.com/ONLYOFFICE/web-apps) — die OnlyOffice-Editoren
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — der WASM-Dokumentkonverter
- [ranui / ranuts](https://github.com/chaxus/ran) — das Designsystem und die Werkzeuge, mit denen diese Seite gebaut ist
- [se-office](https://github.com/Qihoo360/se-office), [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — Vorarbeiten dazu, OnlyOffice ohne Dokumentserver zu betreiben

## 🤝 Mitwirken

Issues und Pull Requests sind willkommen. `main` ist geschützt: Arbeiten Sie auf einem
Branch und öffnen Sie einen PR, der Lint, Unit-Tests und drei End-to-End-Suites ausführt
(Entwicklungsserver, Cloudflare-Pages-Verhalten und das Produktions-Docker-Image).

## 📄 Lizenz

[AGPL-3.0](LICENSE)
