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

**Ein Dokumenten-Arbeitsplatz für dich und deine KI-Agenten im Browser.**

Word, Excel und PowerPoint im Browser öffnen, bearbeiten, konvertieren und speichern sowie PDFs kommentieren. Die grundlegende Dokumentenverarbeitung läuft lokal, ohne Konto oder Office-Installation.

Nutze optionale KI-Unterstützung (Experimental Beta), Dokumentenwerkzeuge für Browser-Agenten über WebMCP oder die PWA-Installation. Zwischengespeicherte Editor-Ressourcen funktionieren offline; du kannst den Editor auch selbst hosten oder in deine App einbetten.

**Online ausprobieren: [edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ Funktionen

- **Lokal bearbeiten und konvertieren.** Dokumente werden auf deinem Gerät verarbeitet, ohne erforderlichen Upload.
- **Flexibel speichern.** Direkt in die gewählte Datei, wenn der Browser es unterstützt, sonst als Download. Öffne zuletzt bearbeitete Dokumente aus diesem Browser erneut.
- **Mit KI arbeiten (Experimental Beta).** Texte entwerfen und überarbeiten, Tabellendaten bearbeiten, Folien erstellen oder Fragen zur aktuellen PDF-Seite stellen. Änderungen vor dem Anwenden prüfen.
- **Agenten nutzen Dokumentenwerkzeuge.** In [WebMCP](docs/reference.md#webmcp-agent-tools)-kompatiblen Browsern können KI-Agenten Dateien öffnen, konvertieren und exportieren sowie Text aus Textdokumenten lesen.
- **Als PWA installieren.** Wie eine App nutzen; zwischengespeicherte Editor-Ressourcen funktionieren auch offline.
- **Selbst hosten oder einbetten.** Als statische Website betreiben oder über die iframe-API in deine App integrieren.

## 🚀 Schnellstart

[Neues Dokument](https://edit.chaxus.com/editor?new=docx&locale=de-DE) · [Neue Tabelle](https://edit.chaxus.com/editor?new=xlsx&locale=de-DE) · [Neue Präsentation](https://edit.chaxus.com/editor?new=pptx&locale=de-DE)

Oder selbst betreiben:

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

## 📄 Formate

| Art            | Bearbeiten                           | Öffnet außerdem             |
| -------------- | ------------------------------------ | --------------------------- |
| Dokumente      | `.docx`                              | `.doc` `.odt` `.rtf` `.txt` |
| Tabellen       | `.xlsx` `.csv`                       | `.xls` `.ods`               |
| Präsentationen | `.pptx`                              | `.ppt` `.odp`               |
| PDF            | kommentieren, ausfüllen, exportieren | `.pdf`                      |

Unterstützte Dokumente lassen sich als PDF exportieren.

Mehrsprachige Oberflächen, helle und dunkle Designs sowie schreibgeschützte Vorschauen werden ebenfalls unterstützt.

## 🔐 Lokale Bearbeitung und Datenverarbeitung

Wiederherstellungskopien bleiben nach dem letzten Bearbeiten oder Öffnen 7 Tage in diesem Browser. Lösche sie unter [Gespeicherte Dokumente](https://edit.chaxus.com/history). Sie sind kein Backup; exportiere wichtige Dateien.

Externe KI-Dienste erhalten die für deine Anfrage benötigten Inhalte. Gerätemodelle verarbeiten sie lokal. Diktieren kann einen Online-Sprachdienst nutzen; eingebettete Exporte verarbeitet die Host-App.

## Dokumentation und Integration

[Benutzerhandbuch](https://edit.chaxus.com/help) · [Hosting, URLs und Integration](docs/reference.md) · [Einbettungs-API](docs/embed-api.md) · [Schriften](docs/fonts.md)

Offline sind zwischengespeicherte Editor-Ressourcen nötig. Nicht gespeicherte Ressourcen und entfernte Dateien benötigen eine Verbindung.

## KI-Dokumentassistent (Experimental Beta)

Texte entwerfen und überarbeiten, Tabellendaten bearbeiten, Folien erstellen oder Fragen zur aktuellen PDF-Seite stellen. Änderungen vor dem Anwenden prüfen und bei Bedarf rückgängig machen.

Wähle ein Modell auf deinem Gerät oder verbinde deinen eigenen KI-Dienst. In unterstützten Browsern kannst du Eingaben diktieren.

**Experimental Beta.** Standardmäßig deaktiviert. Antworten und Änderungen können falsch sein; wichtige Ergebnisse prüfen.

<details>
<summary>Vier Demos ansehen</summary>

| Word                                                                                                                                                                             | Excel                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Entwerfen, einfügen, zusammenfassen und rückgängig machen](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9) | [![Ausfüllen, berechnen, sortieren und rückgängig machen](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c) |
| **Entwerfen, einfügen, zusammenfassen und rückgängig machen**                                                                                                                    | **Ausfüllen, berechnen, sortieren und rückgängig machen**                                                                                                                     |
| PowerPoint                                                                                                                                                                       | PDF                                                                                                                                                                           |
| [![Erstellen, duplizieren und rückgängig machen](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e)              | [![Lesen, Fragen stellen und Notizen prüfen](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9)                |
| **Erstellen, duplizieren und rückgängig machen**                                                                                                                                 | **Lesen, Fragen stellen und Notizen prüfen**                                                                                                                                  |

Vollständige Abläufe in normaler Geschwindigkeit, auf Englisch mit bereits geladenem lokalem Qwen3 4B. Antwortzeiten hängen von Modell und Gerät ab.

[Videos, Untertitel und Beschreibungen](docs/media/ai-demos/README.md)

PDF-Unterstützung gilt für auswählbaren Text und Seitennotizen, nicht für Texterkennung in Scans oder das Umschreiben des PDF-Inhalts.

</details>

## 🛠 Entwicklung

Aus dem Quellcode starten:

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install --frozen-lockfile
pnpm run dev
```

Feedback und Beiträge sind willkommen: [Issues](https://github.com/ranuts/document/issues) · [Pull requests](https://github.com/ranuts/document/pulls)

## 📚 Aufgebaut auf

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) und [web-apps](https://github.com/ONLYOFFICE/web-apps) — die OnlyOffice-Editoren
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — der WASM-Dokumentkonverter
- [ranui / ranuts](https://github.com/chaxus/ran) — das Designsystem und die Werkzeuge, mit denen diese Seite gebaut ist
- [se-office](https://github.com/Qihoo360/se-office), [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — Vorarbeiten dazu, OnlyOffice ohne Dokumentserver zu betreiben

## 📄 Lizenz

[AGPL-3.0](LICENSE) · [NOTICE](NOTICE)

<details>
<summary>Upstream-Hinweise und Marken</summary>

Dieses Projekt ist eine veränderte Version der ONLYOFFICE-Editoren (sdkjs und
web-apps, Copyright Ascensio System SIA). Die Oberfläche verwendet neutrale
Funktionsbezeichnungen ohne Produktlogos oder Markenwerbung. Urheberrechts- und
Lizenzhinweise, Änderungen und Quellcode-Links bleiben im Infofenster des Editors
und in [NOTICE](NOTICE) verfügbar. GUI-Materialien und Schriftarten Dritter
behalten ihre jeweiligen Lizenzen.

Der Verzicht auf Produktlogos orientiert sich an der veröffentlichten Auslegung
des AGPLv3-Abschnitts 7 durch die FSF. Diese ist kein Gerichtsurteil und keine
Garantie vollständiger Rechtskonformität. Die Position des ursprünglichen
Projekts und die Begründung sind in NOTICE dokumentiert.

ONLYOFFICE ist eine Marke von Ascensio System SIA. Dieses Projekt ist kein
offizielles ONLYOFFICE-Produkt und wird von Ascensio System SIA weder unterstützt
noch gesponsert; es besteht keine Verbindung. Namen in rechtlichen Hinweisen und
Quellverweisen kennzeichnen die zugrunde liegende Technik, nicht unsere Marke.

PWA-Installation und Browser-Tabs verwenden ein unabhängig gezeichnetes, neutrales
Dokumentsymbol ohne Upstream-Logo, Markenzeichen oder Projektinitialen.

</details>
