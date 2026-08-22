---
title: WebMCP-Dokumenteneditor — KI-Agenten im Browser können ihn bedienen
description: Ein Dokumenteneditor, der WebMCP-Tools registriert, damit ein KI-Agent im Browser DOCX-, XLSX-, PPTX- und PDF-Dateien öffnen, lesen, umwandeln und exportieren kann, indem er sie direkt aufruft. Alles läuft auf Ihrem Gerät.
eyebrow: Für Browser-Agenten · WebMCP
h1: Ein Dokumenteneditor, den Browser-Agenten wirklich nutzen können
lead: Dieser Editor registriert **WebMCP**-Tools, sodass ein KI-Agent in Ihrem Browser Dokumente öffnen, lesen, umwandeln und exportieren kann, indem er sie aufruft — statt sich durch eine für Menschen gebaute Oberfläche zu klicken.
cta: Editor öffnen →
ctaHref: /de/
ogDescription: KI-Agenten im Browser können hier über WebMCP-Tools Dokumente öffnen, lesen, umwandeln und exportieren. Auf dem Gerät, ohne Upload.
breadcrumb: webmcp-document-editor
howTo: Einen KI-Agenten im Browser mit Ihren Dokumenten arbeiten lassen
appDescription: Ein Dokumenteneditor im Browser, der WebMCP-Tools für KI-Agenten im Browser bereitstellt; die gesamte Verarbeitung passiert auf dem Gerät.
---

## So funktioniert es

1. Nutzen Sie einen Browser, der die WebMCP-API bereitstellt (Chrome, im Origin Trial).
2. Öffnen Sie **den Editor** als normalen Tab — Tools werden nur auf der obersten Seite registriert.
3. Bitten Sie den KI-Agenten Ihres Browsers, ein Dokument zu öffnen, zu lesen, umzuwandeln oder zu exportieren.
4. Der Agent ruft die Tools direkt auf; die Arbeit passiert auf Ihrem Gerät und nichts wird hochgeladen.

Für einen KI-Agenten sind die meisten Web-Apps undurchsichtig. Er sieht eine Seite voller Schaltflächen, muss raten, welche eine Datei umwandelt, und hoffen, dass der Klick gesessen hat. WebMCP — ein Vorschlag der W3C Web Machine Learning Community Group — erlaubt einer Seite, das komplett zu überspringen: Sie erklärt, was sie kann, als strukturierte, aufrufbare Tools mit typisierten Eingaben. Dieser Editor erklärt sieben davon.

Die Tools sind open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly, get_document_state. Sie sind keine zweite Implementierung: Sie rufen denselben Code auf dem Gerät auf wie die Schaltflächen — denselben, den auch die Embed-API im iframe steuert. Ein Agent bekommt also genau die Fähigkeiten einer Person, mit derselben Garantie: Die Umwandlungsengine ist WebAssembly in Ihrem Tab, und die Datei verlässt das Gerät nie.

Genau diese Eigenschaft macht Agenten-Zugriff hier überhaupt vertretbar. Ein Dokument einem Agenten zu geben heißt sonst meist, es dem Server zu geben, mit dem dieser Agent spricht. Hier orchestriert der Agent nur, und das Dokument bleibt liegen: Es wird von der Festplatte in den Tab gelesen, im Tab umgewandelt und wieder herausgeschrieben. Ein Agent, der den Text eines Vertrags liest, um eine Frage dazu zu beantworten, lädt diesen Vertrag nirgendwohin.

Zwei Grenzen sind Absicht. Tools werden nur registriert, wenn der Editor die oberste Seite ist — ein Cross-Origin-iframe bräuchte vom einbettenden Dokument ein `allow="tools"`, was dem Sinn des Einbettens widerspricht; eingebettete Editoren werden deshalb über die postMessage-API gesteuert. Und das Lesen des Volltexts steht für Textdokumente zur Verfügung; Tabellen und Präsentationen bieten es auf dieser Engine nicht an, also sagt das Tool das ausdrücklich, statt eine leere Antwort zu liefern, die ein Agent für eine leere Datei halten könnte.

## Häufige Fragen

### Was ist WebMCP?

Ein Vorschlag der W3C Web Machine Learning Community Group, mit dem eine Webseite strukturierte Tools registrieren kann, die ein KI-Agent im Browser direkt aufruft, statt die Oberfläche deuten und anklicken zu müssen.

### Welche Tools registriert dieser Editor?

Sieben: open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly, get_document_state. Sie decken das Öffnen aus einer URL oder aus Bytes ab, das Anlegen eines neuen Dokuments, Exportieren und Umwandeln, das Lesen des Texts, das Umschalten auf schreibgeschützt und die Statusmeldung.

### Welche Browser unterstützen es?

WebMCP ist in Chrome hinter einem Origin Trial verfügbar. Firefox und Safari haben keine Unterstützung angekündigt. Wo die API fehlt, wird nichts registriert und nichts ändert sich.

### Wird mein Dokument hochgeladen, wenn ein Agent daran arbeitet?

Nein. Die Tools rufen denselben Code auf dem Gerät auf wie die Oberfläche — die Umwandlungsengine ist WebAssembly in Ihrem Browser-Tab, und die Datei verlässt Ihr Gerät nie.

### Kann ein Agent den Inhalt meines Dokuments lesen?

Bei Textdokumenten gibt get_document_text den Text zurück, sodass der Agent Fragen dazu beantworten kann, ohne etwas zu exportieren. Tabellen und Präsentationen haben auf dieser Engine kein Volltext-Lesen; das Tool meldet das, statt eine leere Antwort zu liefern.

### Funktioniert es, wenn der Editor in einer anderen Seite eingebettet ist?

Nein, aus Prinzip. Tools werden nur auf der obersten Seite registriert. Eingebettete Editoren werden stattdessen über die postMessage-Embed-API gesteuert.

### Kann ein Agent eine Datei in ein PDF umwandeln?

Ja. save_document nimmt ein Zielformat entgegen, ein Agent kann also eine DOCX, XLSX oder PPTX öffnen und ein PDF exportieren — alles auf dem Gerät.

### Brauche ich ein Konto oder einen API-Schlüssel?

Weder noch. Der Editor braucht kein Konto und ruft selbst keinen KI-Dienst auf — das Denken übernimmt der Agent Ihres Browsers, diese Seite stellt nur die Tools bereit.
