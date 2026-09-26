---
title: 'Hilfe — den Online-Dokumenteneditor nutzen'
description: 'Dokumente öffnen, bearbeiten, speichern und wiederherstellen; Datenschutz und Offline-Voraussetzungen. Lokal bearbeiten ohne erforderlichen Upload.'
eyebrow: Hilfe
breadcrumb: Hilfe
h1: Hilfe
lead: 'DOCX, XLSX, PPTX und CSV ohne Office oder Konto im Browser öffnen, ansehen und bearbeiten. Der Kerneditor benötigt keinen Dokument-Upload; Offline-Nutzung hängt von zwischengespeicherten Ressourcen ab.'
---

## Öffnen und Anlegen

### Welche Dateiformate kann ich öffnen?

Word (`.docx`, älteres `.doc`), Excel (`.xlsx`, älteres `.xls`), PowerPoint (`.pptx`, älteres `.ppt`), kommagetrennte Werte (`.csv`) und PDF (`.pdf`). Wählen Sie eine Datei über **Öffnen**, ziehen Sie sie auf die Seite oder übergeben Sie eine URL mit `/editor?file=https://…` / `/editor?src=https://…` (der Server, der die Datei ausliefert, muss Cross-Origin-Anfragen erlauben).

### Wie lege ich ein neues Dokument an?

Das Öffnen, Bearbeiten und Konvertieren im Kerneditor erfolgt lokal im Browser, ohne einen erforderlichen Dokument-Upload. Bei aktivierter automatischer Sicherung bleiben Wiederherstellungskopien in der IndexedDB dieses Browsers für 7 Tage nach dem letzten Bearbeiten oder Öffnen. Das Schließen des Tabs löscht sie nicht. Unter /history können Sie Kopien löschen oder die automatische Sicherung deaktivieren. Browserspeicher kann gelöscht oder verdrängt werden; noch nicht gesicherte Änderungen können verloren gehen. Wiederherstellung ersetzt das Speichern der Datei nicht.

### Gibt es eine Größenbeschränkung?

Keine feste Grenze. Die praktische Obergrenze ist der Arbeitsspeicher Ihres Geräts, weil das gesamte Dokument lokal geparst und dargestellt wird.

## Bearbeiten und Speichern

### Wie speichere ich meine Änderungen?

In Chrome, Edge und anderen Browsern mit File System Access API wählen Sie beim ersten Speichern eine Datei; spätere Speichervorgänge schreiben in diese Datei zurück. Andere Browser laden eine Kopie herunter. Andere Formate exportieren Sie über Datei → Herunterladen als. Wiederherstellungskopien im Browser sind davon unabhängig.

### Warum ist die Schaltfläche „Speichern“ manchmal ausgegraut?

Sie wird aktiv, sobald der Editor das Dokument vollständig geladen hat und Sie etwas geändert haben. Bleibt sie nach dem Bearbeiten grau, wurde das Dokument nicht fertig geladen — prüfen Sie die Benachrichtigung auf einen Fehler und sehen Sie unten in den Abschnitt zu Fehlercodes.

### Kann ich zwischen Formaten umwandeln?

Bei der lokalen Kernbearbeitung: Ja, auf Ihrem Gerät: Dokument öffnen und unter **Herunterladen als** das Zielformat wählen. Word-Dokumente exportieren nach DOCX / PDF / TXT, Tabellen nach XLSX / CSV / PDF, Präsentationen nach PPTX / PDF. CSV-Dateien werden als Tabelle geöffnet und können wieder als CSV gespeichert werden.

### Meine CSV mit Umlauten oder chinesischen Zeichen erscheint anderswo als Zeichensalat. Und hier?

Der Editor erkennt die Kodierung der CSV vor dem Öffnen — zuerst striktes UTF-8, dann GB18030 (die „ANSI“-Kodierung, die Excel für chinesische Exporte nutzt), dann Latin-1 — sodass Dateien, die in anderen Werkzeugen zerfallen, hier korrekt öffnen. Gespeichert wird UTF-8 mit Byte Order Mark, das Excel ohne Assistenten öffnet.

## PDF

### Was kann ich mit einem PDF machen?

Öffnen und lesen (scrollen, zoomen, suchen), Kommentare und freie Textanmerkungen hinzufügen und es wieder als PDF herunterladen, das diese Anmerkungen behält. Ausfüllbare Formulare lassen sich ausfüllen.

### Kann ich den Text eines vorhandenen PDFs wie in Word umschreiben?

Bei der lokalen Kernbearbeitung: Nicht als frei fließenden Text — PDF ist ein Format mit festem Layout. Um den Wortlaut zu ändern, öffnen Sie die ursprüngliche DOCX / XLSX / PPTX und exportieren daraus ein neues PDF. Beide Schritte passieren auf Ihrem Gerät.

## Schreibgeschützt und Einbetten

### Kann ich ein Dokument schreibgeschützt öffnen?

Ja. Ergänzen Sie einen `/editor?file=`-Link um `&readonly=1` oder senden Sie `document:set-readonly` über die Embed-API. Der Schreibschutz lässt sich zur Laufzeit ein- und ausschalten, ohne das Dokument neu zu laden.

### Kann ich den Editor in meine eigene Web-App einbauen?

Ja — der Editor ist dafür gebaut, in einem iframe eingebettet und per `postMessage` gesteuert zu werden: Ihre Seite holt die Datei (mit eigener Authentifizierung), schickt sie ins iframe und bekommt die bearbeitete `File` zurück, die Sie hochladen können, wohin Sie wollen. Siehe die [Embed-API-Referenz](/de/help/embed-api) und die [Live-Demo](/embed-demo.html).

## KI-Agenten im Browser (WebMCP)

### Kann ein KI-Assistent in meinem Browser den Editor bedienen?

WebMCP-Werkzeuge bearbeiten und konvertieren lokal. Ein Browser-Agent kann jedoch Dokumenttext oder exportierte Dateien erhalten und an seinen eigenen KI-Dienst senden. Prüfen Sie seine Datenrichtlinie vor der Freigabe vertraulicher Inhalte.

### Welche Browser unterstützen es?

WebMCP ist ein Vorschlag der W3C Web Machine Learning Community Group und derzeit in Chrome hinter einem Origin Trial verfügbar. Firefox und Safari haben keine Unterstützung angekündigt. Wo der Browser die API nicht bereitstellt, wird nichts registriert und nichts ändert sich — es ist eine reine Ergänzung.

### Funktioniert es in einem eingebetteten Editor?

Nein, aus Prinzip. Tools werden nur registriert, wenn der Editor die oberste Seite ist. Ein Cross-Origin-iframe bräuchte vom einbettenden Dokument ein `allow="tools"`, was dem Sinn des Einbettens widerspricht — wenn Sie den Editor einbetten, steuern Sie ihn stattdessen über die [Embed-API](/de/help/embed-api).

### Kann der Agent den Text des Dokuments lesen?

Bei Textdokumenten ja: `get_document_text` gibt den Text zurück, sodass der Agent inhaltliche Fragen beantworten kann, ohne etwas zu exportieren. Tabellen und Präsentationen bieten auf dieser Engine kein Volltext-Lesen; das Tool sagt das ausdrücklich (statt eine leere Antwort zu liefern, die wie eine leere Datei aussähe) und verweist auf den Export.

## Offline und Installation

### Funktioniert es offline?

Offline-Bearbeitung setzt voraus, dass Browser, App, Editor-Engine, Konverter sowie benötigte Schrift- und Formatressourcen im Cache verfügbar bleiben. Ein Besuch oder eine PWA-Installation garantiert das nicht. Datei-URLs und Cloud-KI benötigen eine Verbindung; für lokales WebLLM muss das Modell bereits verfügbar sein.

### Wie bekomme ich die neueste Version?

Die Seite aktualisiert sich beim nächsten Besuch selbst. Wenn eine Seite auf einem alten Stand festzuhängen scheint, laden Sie hart neu (Strg+Umschalt+R / ⌘⇧R) oder heben Sie die Registrierung des Service Workers in den Website-Einstellungen des Browsers auf.

## Datenschutz

### Werden meine Dokumente irgendwohin hochgeladen?

Das Öffnen, Bearbeiten und Konvertieren im Kerneditor erfolgt lokal im Browser, ohne einen erforderlichen Dokument-Upload. Optionale Cloud-KI kann Prompts und von Werkzeugen bereitgestellte Dokumentinhalte an den gewählten Anbieter senden. WebLLM führt die Inferenz nach dem Modelldownload lokal aus. Eine einbettende Anwendung kann exportierte Dateien empfangen und nach ihrer eigenen Richtlinie hochladen.

### Was lädt die Seite aus dem Netz?

Die Seite lädt Anwendungscode, Editor-Ressourcen, Schriften und einen Cloudflare-Web-Analytics-Beacon. Datei-URLs, Modelldownloads und optionale Cloud-KI können zusätzliche Anfragen auslösen. Einbettende Anwendungen und Browser-Agenten bestimmen ihre eigene Datenverarbeitung.

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

### Was bleibt nach dem Schließen des Tabs?

Bei aktivierter automatischer Sicherung bleiben Wiederherstellungskopien in der IndexedDB dieses Browsers für 7 Tage nach dem letzten Bearbeiten oder Öffnen. Das Schließen des Tabs löscht sie nicht. Unter /history können Sie Kopien löschen oder die automatische Sicherung deaktivieren. Browserspeicher kann gelöscht oder verdrängt werden; noch nicht gesicherte Änderungen können verloren gehen. Wiederherstellung ersetzt das Speichern der Datei nicht.

### Wie verarbeiten Cloud-KI und einbettende Anwendungen Daten?

Optionale Cloud-KI kann Prompts und von Werkzeugen bereitgestellte Dokumentinhalte an den gewählten Anbieter senden. WebLLM führt die Inferenz nach dem Modelldownload lokal aus. Eine einbettende Anwendung kann exportierte Dateien empfangen und nach ihrer eigenen Richtlinie hochladen.
