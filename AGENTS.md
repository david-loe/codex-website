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

Die Website wird lokal oder in CI gebaut und anschließend per SSH als Inhalt von `dist/` in den Webspace hochgeladen.

Linux, macOS und Windows mit OpenSSH verwenden denselben Befehl:

```bash
npm run deploy
```

Deployment-Variablen müssen aus der lokalen Shell, aus CI-Secrets oder aus einer nicht committeten `.env` kommen:

- `DEPLOY_USER`
- `DEPLOY_HOST`
- `DEPLOY_PATH`
- `DEPLOY_KEY` optional; erlaubt sind privater Schlüsselpfad oder Schlüsseldateiname unter `~/.ssh`

Nicht automatisch deployen, außer es wurde ausdrücklich angefragt. Keine Deployment-Secrets ausgeben und keine `.env` committen.

## Review-Hinweise

Bei Codeänderungen prüfen:

- Das Projekt baut weiterhin.
- Die Navigation funktioniert auf Desktop und Mobilgeräten.
- Seiten verwenden semantische Überschriften.
- Bilder haben sinnvolle `alt`-Texte.
- Die Lösung fügt keine unnötige Komplexität hinzu.
