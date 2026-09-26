---
title: 'Über diesen Editor — wer ihn baut und warum'
description: 'Über diesen quelloffenen Browser-Editor, seine Autoren, den Quellcode und die Datenverarbeitung. Lokal bearbeiten ohne erforderlichen Upload.'
eyebrow: Über uns
breadcrumb: Über diesen Editor
h1: Über diesen Editor
lead: Wer das hier baut, was es wirklich kann — und wie Sie beides selbst überprüfen.
---

## Was das hier ist

Ein **Editor für Office-Dokumente im Browser**. Sie öffnen eine Word- (DOCX), Excel- (XLSX), PowerPoint- (PPTX), CSV- oder PDF-Datei und bearbeiten sie direkt im Browser-Tab.

Das Öffnen, Bearbeiten und Konvertieren im Kerneditor erfolgt lokal im Browser, ohne einen erforderlichen Dokument-Upload. Der integrierte KI-Assistent ist noch nicht fertig und keine veröffentlichte Funktion. Eine einbettende Anwendung kann exportierte Dateien empfangen und nach ihrer eigenen Richtlinie hochladen.

Bei aktivierter automatischer Sicherung bleiben Wiederherstellungskopien in der IndexedDB dieses Browsers für 7 Tage nach dem letzten Bearbeiten oder Öffnen. Das Schließen des Tabs löscht sie nicht. Unter /history können Sie Kopien löschen oder die automatische Sicherung deaktivieren. Browserspeicher kann gelöscht oder verdrängt werden; noch nicht gesicherte Änderungen können verloren gehen. Wiederherstellung ersetzt das Speichern der Datei nicht.

## Wer das baut

Diese Seite wird von **ranuts** entwickelt und gepflegt — demselben Autor hinter dem [GitHub-Konto `ranuts`](https://github.com/ranuts) und den [ran-Bibliotheken für Komponenten und Utilities](https://ran.chaxus.com).

Es ist ein persönliches Open-Source-Projekt, kein Firmenprodukt. Dahinter stehen kein Vertriebsteam und kein Wagniskapital — deshalb gibt es auch keine Upsells, keine „kostenlose Stufe", die ausläuft, und keinen Grund für diese Seite, Ihre Dateien haben zu wollen.

## Wie Sie das alles überprüfen können

Behauptungen über Datenschutz sind billig. So können Sie sie selbst nachprüfen:

- **Lesen Sie den Quellcode.** Alles ist quelloffen unter **AGPL-3.0** auf [github.com/ranuts/document](https://github.com/ranuts/document). Die Lizenz verlangt, dass auch eine gehostete Abwandlung ihren Quellcode veröffentlicht.
- Prüfen Sie im Netzwerk-Tab das Öffnen, Bearbeiten und Speichern einer lokalen Datei. Testen Sie optionale KI, Datei-URLs und einbettende Anwendungen separat; deren Anfragen gehören nicht zur rein lokalen Kernbearbeitung.
- Zwischengespeicherte Editor-Ressourcen funktionieren offline; Datei-URLs benötigen eine Verbindung.
- **Hosten Sie es selbst.** Das Repository enthält, was Sie für eine eigene Instanz brauchen.

## Worauf es aufbaut

Die Bearbeitungs-Engine basiert auf **ONLYOFFICE**, kompiliert für den Browser. Dieses Projekt legt eine lokal-zuerst gedachte Hülle darum: Dateihandhabung, Formatkonvertierung, die Offline-Schicht, Einbettung und die Oberfläche, die Sie sehen.

Auf einer bestehenden Engine aufzubauen, ist eine bewusste Entscheidung. Dokumentformate — besonders DOCX und XLSX — sind große, unübersichtliche Spezifikationen; eine Implementierung von Grund auf würde Ihre Dateien subtil falsch darstellen. Eine ausgereifte Engine wiederzuverwenden heißt: **was Sie im Browser sehen, entspricht dem, was Sie anderswo sehen würden.**

## Grenzen, die man kennen sollte

Eine ehrliche Liste, denn eine Seite, die nur Stärken aufzählt, nützt nichts:

- **Große Dateien sind an Ihr Gerät gebunden.** Alles läuft im Browser, eine sehr große Tabelle wird also von Ihrem Arbeitsspeicher und Ihrer CPU begrenzt — nicht von einem Server, den Sie aufrüsten könnten.
- Bei der lokalen Kernbearbeitung: **Keine Synchronisierung, keine Zusammenarbeit.** Kein Server hält Ihr Dokument, also gibt es auch kein gleichzeitiges Bearbeiten und keinen Abgleich zwischen Geräten.
- **Die Wiedergabetreue ist sehr gut, aber nicht perfekt.** Komplexe Layouts, ungewöhnliche Schriften und Makros können von einer Desktop-Suite abweichen.

Wenn Ihnen davon etwas wichtiger ist, als die Datei lokal zu behalten, ist eine gehostete Suite das bessere Werkzeug — und das ist eine vernünftige Wahl.

## Kontakt

Fehlerberichte, Darstellungsprobleme und Funktionswünsche gehören am besten als Issue auf GitHub, wo sie öffentlich und nachvollziehbar bleiben. Die Wege zum Projekt stehen unter [Kontakt](/de/contact).
