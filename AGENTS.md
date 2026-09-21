## Projekt

Dieses Repository ist ein moderner statischer Website-Startpunkt mit Astro, Tailwind CSS und TypeScript.

Die Website wird als statische Dateien auf Shared Hosting veröffentlicht. Das Produktionsverzeichnis ist `dist/`.

## Grundregeln

- Keinen laufenden Node.js-Server einführen.
- Keine Secrets, SSH-Schlüssel, `.env`-Dateien, Zugangsdaten oder Hosting-Passwörter committen.
- Die Website statisch, schnell, barrierearm und responsiv halten.
- Einfache Komponenten, semantisches HTML, saubere Typografie und wenige Abhängigkeiten bevorzugen.
- Inhalte nach Möglichkeit in Markdown oder MDX auslagern, wenn die Website wächst.
- Sichtbare Website-Texte deutsch halten; Überschriften und funktionale Labels sinnvoll benennen, beschreibende Platzhalter als Blindtext führen.

## Befehle

Diese Befehle verwenden, wenn sie verfügbar sind:

```bash
npm install
npm run dev
npm run build
npm run preview
npm run check
npm run deploy
```

Vor Abschluss einer Aufgabe ausführen:

```bash
npm run check
npm run build
```

Die npm-Skripte rufen Astro direkt auf.

## Deployment-Annahmen

Die Website wird lokal oder in CI gebaut und anschließend per ausdrücklich konfiguriertem SSH, FTP oder FTPS als Inhalt von `dist/` in den Webspace hochgeladen.

Linux, macOS und Windows verwenden denselben Befehl (OpenSSH ist nur für SSH erforderlich):

```bash
npm run deploy
```

Deployment-Variablen müssen aus der lokalen Shell, aus CI-Secrets oder aus einer nicht committeten `.env` kommen:

- `DEPLOY_PROTOCOL` erforderlich: `ssh`, `ftp` oder `ftps`; kein Standard
- `DEPLOY_USER`, `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_PATH` immer erforderlich
- `DEPLOY_PASSWORD` für FTP/FTPS erforderlich
- `DEPLOY_FTPS_MODE` für FTPS erforderlich: `explicit` oder `implicit`
- `DEPLOY_SSH_AUTH` für SSH erforderlich: `key` oder `agent`
- `DEPLOY_KEY` bei SSH mit `key` erforderlich; privater Schlüsselpfad oder Schlüsseldateiname unter `~/.ssh`

Es gibt keine automatischen Verbindungsdefaults. Bestehende SSH-Konfigurationen benötigen die neuen Pflichtfelder. Shell-/CI-Werte haben Vorrang vor `.env`. Das Deployment leert nach erfolgreichem Build das konkrete Zielverzeichnis vollständig und lädt den Inhalt von `dist/` hoch; das Ersetzen ist nicht atomar. FTPS muss Zertifikate prüfen, ohne Rückfall auf unverschlüsseltes FTP.

Bei Änderungen am Deployment zusätzlich `npm run test:deploy` ausführen. Gerüständerungen zuerst in `codex-website` entwickeln und mit Herkunftsverweis in Website-Repositories übernehmen; deren Inhalte und lokale Änderungen erhalten.

Nicht automatisch deployen, außer es wurde ausdrücklich angefragt. Keine Deployment-Secrets ausgeben und keine `.env` committen.

## Review-Hinweise

Bei Codeänderungen prüfen:

- Das Projekt baut weiterhin.
- Die Navigation funktioniert auf Desktop und Mobilgeräten.
- Seiten verwenden semantische Überschriften.
- Bilder haben sinnvolle `alt`-Texte.
- Die Lösung fügt keine unnötige Komplexität hinzu.
