---
title: Hilfe — den Online-Dokumenteneditor nutzen
description: Wie Sie Word-, Excel-, PowerPoint-, CSV- und PDF-Dateien im Browser öffnen, bearbeiten und speichern, ohne sie hochzuladen; schreibgeschützt und eingebettet, Offline-Nutzung, Datenschutzgrenzen, Fehlercodes und Selbst-Hosting.
eyebrow: Hilfe
breadcrumb: Hilfe
h1: Hilfe
lead: Praktische Antworten zur Nutzung des Editors. Alles läuft in Ihrem Browser-Tab; Ihre Dateien werden nie hochgeladen.
---

## Öffnen und Anlegen

### Welche Dateiformate kann ich öffnen?

Word (`.docx`, älteres `.doc`), Excel (`.xlsx`, älteres `.xls`), PowerPoint (`.pptx`, älteres `.ppt`), kommagetrennte Werte (`.csv`) und PDF (`.pdf`). Wählen Sie eine Datei über **Öffnen**, ziehen Sie sie auf die Seite oder übergeben Sie eine URL mit `/editor?file=https://…` / `/editor?src=https://…` (der Server, der die Datei ausliefert, muss Cross-Origin-Anfragen erlauben).

### Wie lege ich ein neues Dokument an?

Nutzen Sie **Neues Word / Neues Excel / Neues PowerPoint** auf der Startseite oder öffnen Sie direkt `/editor?new=docx`, `/editor?new=xlsx`, `/editor?new=pptx`. Auf einem Server entsteht dabei nichts: Das leere Dokument existiert nur in Ihrem Tab, bis Sie es herunterladen.

### Gibt es eine Größenbeschränkung?

Keine feste Grenze. Die praktische Obergrenze ist der Arbeitsspeicher Ihres Geräts, weil das gesamte Dokument lokal geparst und dargestellt wird.

## Bearbeiten und Speichern

### Wie speichere ich meine Änderungen?

Drücken Sie **Strg+S / ⌘S** oder nutzen Sie **Datei → Herunterladen als**. Weil es keinen Server gibt, heißt „Speichern“ hier: Der Browser gibt Ihnen die Datei; sie landet unter dem ursprünglichen Namen in Ihrem Download-Ordner. Wählen Sie unter **Herunterladen als** ein anderes Format, um umzuwandeln (etwa DOCX → PDF, XLSX → CSV).

### Warum ist die Schaltfläche „Speichern“ manchmal ausgegraut?

Sie wird aktiv, sobald der Editor das Dokument vollständig geladen hat und Sie etwas geändert haben. Bleibt sie nach dem Bearbeiten grau, wurde das Dokument nicht fertig geladen — prüfen Sie die Benachrichtigung auf einen Fehler und sehen Sie unten in den Abschnitt zu Fehlercodes.

### Kann ich zwischen Formaten umwandeln?

Ja, auf Ihrem Gerät: Dokument öffnen und unter **Herunterladen als** das Zielformat wählen. Word-Dokumente exportieren nach DOCX / PDF / TXT, Tabellen nach XLSX / CSV / PDF, Präsentationen nach PPTX / PDF. CSV-Dateien werden als Tabelle geöffnet und können wieder als CSV gespeichert werden.

### Meine CSV mit Umlauten oder chinesischen Zeichen erscheint anderswo als Zeichensalat. Und hier?

Der Editor erkennt die Kodierung der CSV vor dem Öffnen — zuerst striktes UTF-8, dann GB18030 (die „ANSI“-Kodierung, die Excel für chinesische Exporte nutzt), dann Latin-1 — sodass Dateien, die in anderen Werkzeugen zerfallen, hier korrekt öffnen. Gespeichert wird UTF-8 mit Byte Order Mark, das Excel ohne Assistenten öffnet.

## PDF

### Was kann ich mit einem PDF machen?

Öffnen und lesen (scrollen, zoomen, suchen), Kommentare und freie Textanmerkungen hinzufügen und es wieder als PDF herunterladen, das diese Anmerkungen behält. Ausfüllbare Formulare lassen sich ausfüllen.

### Kann ich den Text eines vorhandenen PDFs wie in Word umschreiben?

Nicht als frei fließenden Text — PDF ist ein Format mit festem Layout. Um den Wortlaut zu ändern, öffnen Sie die ursprüngliche DOCX / XLSX / PPTX und exportieren daraus ein neues PDF. Beide Schritte passieren auf Ihrem Gerät.

## Schreibgeschützt und Einbetten

### Kann ich ein Dokument schreibgeschützt öffnen?

Ja. Ergänzen Sie einen `/editor?file=`-Link um `&readonly=1` oder senden Sie `document:set-readonly` über die Embed-API. Der Schreibschutz lässt sich zur Laufzeit ein- und ausschalten, ohne das Dokument neu zu laden.

### Kann ich den Editor in meine eigene Web-App einbauen?

Ja — der Editor ist dafür gebaut, in einem iframe eingebettet und per `postMessage` gesteuert zu werden: Ihre Seite holt die Datei (mit eigener Authentifizierung), schickt sie ins iframe und bekommt die bearbeitete `File` zurück, die Sie hochladen können, wohin Sie wollen. Siehe die [Embed-API-Referenz](/de/help/embed-api) und die [Live-Demo](/embed-demo.html).

## KI-Agenten im Browser (WebMCP)

### Kann ein KI-Assistent in meinem Browser den Editor bedienen?

Ja, wo der Browser es unterstützt. Der Editor registriert eine Reihe von WebMCP-Tools, sodass ein KI-Agent im Browser Dokumente öffnen, umwandeln, lesen und exportieren kann, indem er sie direkt aufruft, statt sich durch die Oberfläche zu klicken. Alles läuft weiterhin auf Ihrem Gerät — der Agent löst denselben lokalen Code aus wie die Schaltflächen, und nichts wird hochgeladen.

Die Tools sind `open_document_url`, `open_document_buffer`, `create_document`, `save_document`, `get_document_text`, `set_readonly` und `get_document_state`.

### Welche Browser unterstützen es?

WebMCP ist ein Vorschlag der W3C Web Machine Learning Community Group und derzeit in Chrome hinter einem Origin Trial verfügbar. Firefox und Safari haben keine Unterstützung angekündigt. Wo der Browser die API nicht bereitstellt, wird nichts registriert und nichts ändert sich — es ist eine reine Ergänzung.

### Funktioniert es in einem eingebetteten Editor?

Nein, aus Prinzip. Tools werden nur registriert, wenn der Editor die oberste Seite ist. Ein Cross-Origin-iframe bräuchte vom einbettenden Dokument ein `allow="tools"`, was dem Sinn des Einbettens widerspricht — wenn Sie den Editor einbetten, steuern Sie ihn stattdessen über die [Embed-API](/de/help/embed-api).

### Kann der Agent den Text des Dokuments lesen?

Bei Textdokumenten ja: `get_document_text` gibt den Text zurück, sodass der Agent inhaltliche Fragen beantworten kann, ohne etwas zu exportieren. Tabellen und Präsentationen bieten auf dieser Engine kein Volltext-Lesen; das Tool sagt das ausdrücklich (statt eine leere Antwort zu liefern, die wie eine leere Datei aussähe) und verweist auf den Export.

## Offline und Installation

### Funktioniert es offline?

Ja. Nach dem ersten Besuch wird der Editor von einem Service Worker zwischengespeichert; Sie können ihn über die Adressleiste des Browsers als App (PWA) installieren und Dokumente ohne Verbindung öffnen. Beim ersten Öffnen eines Dokuments mit vielen Schriften wird das Netz einmal gebraucht, um diese Schriften zu laden; danach sind auch sie im Cache.

### Wie bekomme ich die neueste Version?

Die Seite aktualisiert sich beim nächsten Besuch selbst. Wenn eine Seite auf einem alten Stand festzuhängen scheint, laden Sie hart neu (Strg+Umschalt+R / ⌘⇧R) oder heben Sie die Registrierung des Service Workers in den Website-Einstellungen des Browsers auf.

## Datenschutz

### Werden meine Dokumente irgendwohin hochgeladen?

Nein. Das Dokument wird von Ihrer Festplatte in den Browser-Tab gelesen und dort mit WebAssembly verarbeitet. Auf dieser Website gibt es keinen Upload-Endpunkt. Sie können das im Netzwerk-Panel des Browsers beim Öffnen und Speichern überprüfen — und der Quellcode ist unter AGPL-3.0 offen.

### Was lädt die Seite aus dem Netz?

Nur die Anwendung selbst: das JavaScript des Editors, den WebAssembly-Konverter, Schriften und die eigenen Assets der Seite — alles von der Origin dieser Website — sowie einen datenschutzfreundlichen Cloudflare-Web-Analytics-Beacon (keine Cookies, kein seitenübergreifendes Tracking). Wenn Sie den optionalen KI-Assistenten mit Ihrem eigenen API-Schlüssel aktivieren, gehen dessen Anfragen direkt von Ihrem Browser an den gewählten Anbieter; nichts läuft über diese Website.

## Fehler

### Was bedeuten die Fehlercodes in der Benachrichtigung?

- **-85** — der Dateiinhalt passt nicht zur Endung (etwa eine HTML-Seite, die als `.xls` gespeichert wurde, oder eine `.docx`, die eigentlich eine `.doc` ist). Benennen Sie die Datei um oder exportieren Sie sie neu.
- **-82** — die Datei konnte nicht umgewandelt werden; sie ist möglicherweise beschädigt, passwortgeschützt oder in einer Variante, die die Engine nicht unterstützt.
- **-24 / -25** — ein Skript des Editors konnte nicht geladen werden, meist ein Netzwerk-Aussetzer oder ein veralteter Cache. Hart neu laden und erneut versuchen.
- **80** — der Export ist im Konverter fehlgeschlagen. Versuchen Sie ein anderes Zielformat; falls es bleibt, melden Sie es bitte mit Dateityp und Schritten.

### Etwas scheint kaputt zu sein. Wo melde ich das?

Öffnen Sie ein Issue auf [GitHub](https://github.com/ranuts/document/issues) mit Browser und Version, dem Dateityp und — sofern nicht vertraulich — einer Datei, die das Problem reproduziert. Eine minimale Reproduktion ist mehr wert als eine Beschreibung.

## Selbst hosten

### Kann ich eine eigene Kopie betreiben?

Ja. Es ist eine statische Website, jeder Webserver genügt: `docker run -d -p 8080:80 ghcr.io/ranuts/document:latest`, oder mit `pnpm run build` bauen und den Ordner `dist/` ausliefern. Optionen für HTTPS und Basic Auth stehen in der [README](https://github.com/ranuts/document#readme), was jede Version geändert hat in den [Änderungen](/de/changelog).
