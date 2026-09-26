---
title: 'WebMCP-Dokumenteneditor — KI-Agenten im Browser können ihn bedienen'
description: 'Browser-Agenten öffnen, lesen, konvertieren und exportieren Dokumente lokal per WebMCP. Die Weitergabe von Daten bestimmt der Agent.'
eyebrow: Für Browser-Agenten · WebMCP
h1: Ein Dokumenteneditor, den Browser-Agenten wirklich nutzen können
lead: Dieser Editor registriert **WebMCP**-Tools, sodass ein KI-Agent in Ihrem Browser Dokumente öffnen, lesen, umwandeln und exportieren kann, indem er sie aufruft — statt sich durch eine für Menschen gebaute Oberfläche zu klicken.
cta: Editor öffnen →
ctaHref: /de/
ogDescription: 'Browser-Agenten öffnen, lesen, konvertieren und exportieren Dokumente lokal per WebMCP. Die Weitergabe von Daten bestimmt der Agent.'
breadcrumb: webmcp-document-editor
howTo: Einen KI-Agenten im Browser mit Ihren Dokumenten arbeiten lassen
appDescription: 'Browser-Agenten öffnen, lesen, konvertieren und exportieren Dokumente lokal per WebMCP. Die Weitergabe von Daten bestimmt der Agent.'
---

## So funktioniert es

1. Nutzen Sie einen Browser, der die WebMCP-API bereitstellt (Chrome, im Origin Trial).
2. Öffnen Sie **den Editor** als normalen Tab — Tools werden nur auf der obersten Seite registriert.
3. Bitten Sie den KI-Agenten Ihres Browsers, ein Dokument zu öffnen, zu lesen, umzuwandeln oder zu exportieren.
4. WebMCP-Werkzeuge bearbeiten und konvertieren lokal. Ein Browser-Agent kann jedoch Dokumenttext oder exportierte Dateien erhalten und an seinen eigenen KI-Dienst senden. Prüfen Sie seine Datenrichtlinie vor der Freigabe vertraulicher Inhalte.

Für einen KI-Agenten sind die meisten Web-Apps undurchsichtig. Er sieht eine Seite voller Schaltflächen, muss raten, welche eine Datei umwandelt, und hoffen, dass der Klick gesessen hat. WebMCP — ein Vorschlag der W3C Web Machine Learning Community Group — erlaubt einer Seite, das komplett zu überspringen: Sie erklärt, was sie kann, als strukturierte, aufrufbare Tools mit typisierten Eingaben. Dieser Editor erklärt sieben davon.

open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly, get_document_state. WebMCP-Werkzeuge bearbeiten und konvertieren lokal. Ein Browser-Agent kann jedoch Dokumenttext oder exportierte Dateien erhalten und an seinen eigenen KI-Dienst senden. Prüfen Sie seine Datenrichtlinie vor der Freigabe vertraulicher Inhalte.

Optionale Cloud-KI kann Prompts und von Werkzeugen bereitgestellte Dokumentinhalte an den gewählten Anbieter senden. WebLLM führt die Inferenz nach dem Modelldownload lokal aus. Eine einbettende Anwendung kann exportierte Dateien empfangen und nach ihrer eigenen Richtlinie hochladen.

Zwei Grenzen sind Absicht. Tools werden nur registriert, wenn der Editor die oberste Seite ist — ein Cross-Origin-iframe bräuchte vom einbettenden Dokument ein `allow="tools"`, was dem Sinn des Einbettens widerspricht; eingebettete Editoren werden deshalb über die postMessage-API gesteuert. Und das Lesen des Volltexts steht für Textdokumente zur Verfügung; Tabellen und Präsentationen bieten es auf dieser Engine nicht an, also sagt das Tool das ausdrücklich, statt eine leere Antwort zu liefern, die ein Agent für eine leere Datei halten könnte.

## Häufige Fragen

### Was ist WebMCP?

Ein Vorschlag der W3C Web Machine Learning Community Group, mit dem eine Webseite strukturierte Tools registrieren kann, die ein KI-Agent im Browser direkt aufruft, statt die Oberfläche deuten und anklicken zu müssen.

### Welche Tools registriert dieser Editor?

Sieben: open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly, get_document_state. Sie decken das Öffnen aus einer URL oder aus Bytes ab, das Anlegen eines neuen Dokuments, Exportieren und Umwandeln, das Lesen des Texts, das Umschalten auf schreibgeschützt und die Statusmeldung.

### Welche Browser unterstützen es?

WebMCP ist in Chrome hinter einem Origin Trial verfügbar. Firefox und Safari haben keine Unterstützung angekündigt. Wo die API fehlt, wird nichts registriert und nichts ändert sich.

### Wird mein Dokument hochgeladen, wenn ein Agent daran arbeitet?

WebMCP-Werkzeuge bearbeiten und konvertieren lokal. Ein Browser-Agent kann jedoch Dokumenttext oder exportierte Dateien erhalten und an seinen eigenen KI-Dienst senden. Prüfen Sie seine Datenrichtlinie vor der Freigabe vertraulicher Inhalte.

### Kann ein Agent den Inhalt meines Dokuments lesen?

Bei Textdokumenten gibt get_document_text den Text zurück, sodass der Agent Fragen dazu beantworten kann, ohne etwas zu exportieren. Tabellen und Präsentationen haben auf dieser Engine kein Volltext-Lesen; das Tool meldet das, statt eine leere Antwort zu liefern.

### Funktioniert es, wenn der Editor in einer anderen Seite eingebettet ist?

Nein, aus Prinzip. Tools werden nur auf der obersten Seite registriert. Eingebettete Editoren werden stattdessen über die postMessage-Embed-API gesteuert.

### Kann ein Agent eine Datei in ein PDF umwandeln?

Ja. save_document nimmt ein Zielformat entgegen, ein Agent kann also eine DOCX, XLSX oder PPTX öffnen und ein PDF exportieren — alles auf dem Gerät.

### Brauche ich ein Konto oder einen API-Schlüssel?

Für die WebMCP-Werkzeuge brauchen Sie weder Konto noch API-Schlüssel. Das Öffnen, Bearbeiten und Konvertieren im Kerneditor erfolgt lokal im Browser, ohne einen erforderlichen Dokument-Upload. Optionale Cloud-KI kann Prompts und von Werkzeugen bereitgestellte Dokumentinhalte an den gewählten Anbieter senden. WebLLM führt die Inferenz nach dem Modelldownload lokal aus. Eine einbettende Anwendung kann exportierte Dateien empfangen und nach ihrer eigenen Richtlinie hochladen.
