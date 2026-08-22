---
title: Einen Dokumenteneditor in die eigene Website einbetten — iframe + postMessage-API
description: Einen Editor für DOCX, XLSX, PPTX und CSV mit einem iframe und einer postMessage-API in Ihre Web-App einbetten. Auth und Dateien bleiben in Ihrer App — der Editor sieht Ihre Tokens nie. Quelloffen (AGPL-3.0), selbst hostbar, White-Label.
eyebrow: Für Entwickler · Einbetten
h1: Einen Dokumenteneditor in Ihre Web-App einbetten
lead: 'Ergänzen Sie Ihr Produkt um einen Editor für **DOCX, XLSX, PPTX und CSV** — mit einem einzigen iframe und einer **postMessage**-API. Ihre App behält Auth, Dateizugriff und Upload; der Editor bearbeitet nur und sieht die Tokens Ihrer Nutzer nie.'
cta: Live-Demo öffnen →
ctaHref: /embed-demo.html
ogDescription: Einen DOCX/XLSX/PPTX/CSV-Editor mit einem iframe in Ihre App einbetten. Auth bleibt in Ihrer App, der Editor sieht Ihre Tokens nie. Quelloffen und selbst hostbar.
breadcrumb: Embed Document Editor
howTo: Einen Dokumenteneditor in die eigene Website einbetten
appDescription: Ein Dokumenteneditor im Browser, der sich per iframe und postMessage-API in Ihre eigene Web-App einbetten lässt.
---

Der Editor läuft vollständig im Browser mit der WebAssembly-Engine von OnlyOffice, Dokumente werden also auf dem Client dargestellt und bearbeitet — Sie betreiben keinen Dokumentenserver. Das empfohlene Muster hält die Grenze sauber: **Die Eltern-App übernimmt Authentifizierung, Laden und Speichern; das iframe übernimmt nur das Bearbeiten.** Tokens, Cookies und Geschäfts-APIs bleiben in Ihrer App.

## Mit einem iframe einbinden

```html
<iframe
  id="documentEditor"
  src="https://edit.chaxus.com/editor?embed=1&embedOrigin=https://your-app.example.com"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

Danach sprechen Sie per `postMessage` mit ihm. Jeder Befehl trägt eine `id`, damit Sie ihn der Antwort zuordnen können, und jedes Editor-Ereignis ist eine `document:*`-Nachricht:

```js
// eine Datei öffnen, die Ihre App bereits geholt hat (Auth bleibt bei Ihnen)
iframe.contentWindow.postMessage(
  { id, type: 'document:open-buffer', payload: { fileName: 'report.xlsx', buffer } },
  'https://edit.chaxus.com',
);

// die bearbeitete Datei zurückverlangen und selbst hochladen
iframe.contentWindow.postMessage({ id, type: 'document:save', payload: { targetExt: 'XLSX' } }, editorOrigin);
// → der Editor antwortet mit { type: 'document:saved', payload: { fileName, file } }
```

## Was Sie bekommen

- Ein iframe und eine kleine **postMessage**-API aus Befehl und Antwort — kein SDK zu installieren
- Öffnen aus einer **URL, einer File oder einem ArrayBuffer**, den Ihre App mit eigenen Zugangsdaten geholt hat
- Zurückspeichern nach **XLSX, DOCX, PPTX oder CSV**, zurückgegeben als `File`, das Ihre App hochlädt
- Schreibgeschützter Modus, Origin-Sperre pro Nachricht (`embedOrigin`) und eine Statusabfrage
- Kein Dokumentenserver zu betreiben — bearbeitet wird zu 100% clientseitig mit WebAssembly
- Quelloffen (AGPL-3.0) und selbst hostbar — betten Sie ihn unter Ihrer eigenen Domain ein

## So funktioniert es

1. Fügen Sie das iframe auf `/editor?embed=1` ein, passend zu Ihrem Layout dimensioniert.
2. Warten Sie auf das Ereignis `document:ready` und senden Sie dann `document:open-url`, `open-file` oder `open-buffer`.
3. Die Nutzerin bearbeitet direkt; die Datei verlässt den Browser nur, wenn Ihre App sie irgendwohin sendet.
4. Senden Sie `document:save`; der Editor gibt die bearbeitete Datei über `document:saved` zurück, die Ihre App mit eigener Auth hochlädt.

## Schreibgeschützt und Vorschau

Öffnen Sie ein Dokument schreibgeschützt (als Betrachter, als Prüfschritt, als gesperrter Datensatz), indem Sie `readonly: true` an den Öffnen-Befehl übergeben, und wechseln Sie jederzeit mit `document:set-readonly` — ohne Neuladen, das Dokument bleibt an der Stelle des Nutzers. Im schreibgeschützten Modus ist Bearbeiten deaktiviert und `document:save` antwortet mit `document:error`; `document:get-state` meldet das aktuelle `readonly`-Flag.

```js
// gesperrt öffnen, später entsperren
send('document:open-url', { url, readonly: true });
send('document:set-readonly', { readonly: false });
```

## Häufige Fragen

### Wie bette ich den Dokumenteneditor ein?

Fügen Sie ein iframe auf `/editor?embed=1` ein und steuern Sie es mit der postMessage-API zum Öffnen und Speichern. Eine funktionierende Demo liegt unter [/embed-demo.html](/embed-demo.html).

### Sieht der Editor die Auth-Tokens meiner Nutzer?

Nein. Auth, Dateiabruf und Upload bleiben in Ihrer App — Ihre App holt die Datei mit eigenen Zugangsdaten und übergibt die Bytes an den Editor, Tokens und Cookies gelangen also nie ins iframe.

### Welche Dateiformate beherrscht der eingebettete Editor?

DOCX, XLSX, PPTX und CSV, clientseitig bearbeitet mit der WebAssembly-Engine von OnlyOffice. Der Speicherbefehl exportiert nach XLSX, DOCX, PPTX oder CSV.

### Kann ich ihn selbst hosten oder als White-Label nutzen?

Ja. Er ist quelloffen unter AGPL-3.0 und wird als statische Dateien ausgeliefert, Sie können also eine eigene Kopie hosten und unter Ihrer Domain einbetten.

### Wie beschränke ich, welche Seite mit dem Editor sprechen darf?

Ergänzen Sie die iframe-URL um `embedOrigin`, um den Nachrichtenaustausch auf eine Origin zu beschränken, und prüfen Sie `event.origin` zusätzlich in Ihrem eigenen Message-Handler.

### Kann ich ein Dokument schreibgeschützt zeigen oder später sperren?

Ja. Übergeben Sie beim Öffnen `readonly: true` oder senden Sie jederzeit `document:set-readonly` — es wechselt im laufenden Editor ohne Neuladen, und Speichern wird währenddessen abgelehnt.
