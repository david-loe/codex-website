# Website Starter

Moderner statischer Website-Startpunkt mit Astro, TypeScript und Tailwind CSS.

Die Website wird als statische Dateien in `dist/` gebaut und eignet sich für klassisches Shared Hosting. Es wird kein laufender Node.js-Server benötigt.

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Der Entwicklungsserver gibt eine lokale URL aus, normalerweise `http://localhost:4321`.

## Befehle

```bash
npm run dev
npm run check
npm run build
npm run preview
npm run deploy
```

- `npm run dev` startet den Astro-Entwicklungsserver.
- `npm run check` führt Astro- und TypeScript-Prüfungen aus.
- `npm run build` erzeugt die Produktionsdateien in `dist/`.
- `npm run preview` zeigt den Produktionsbuild lokal an.
- `npm run deploy` baut die Website und lädt `dist/` per OpenSSH hoch.

Astro-Telemetrie kann bei Bedarf lokal mit `npm exec astro telemetry disable` deaktiviert werden.

## Inhalt

Die sichtbaren Texte sind auf Deutsch angelegt. Überschriften und funktionale UI-Labels sind sinnvoll benannt; beschreibende Inhalte sind als Blindtext vorbereitet.

Startseiten und Inhaltsseiten liegen in `src/pages/`:

- `/`
- `/about/`
- `/services/`
- `/contact/`
- `/impressum/`
- `/datenschutz/`

## Deployment

Das Deployment ist optional und wird nicht automatisch ausgeführt. Benötigt werden OpenSSH `ssh` und `scp` im `PATH`.

Variablen können aus der Shell, aus CI-Secrets oder aus einer lokalen, nicht versionierten `.env` kommen:

- `DEPLOY_USER`
- `DEPLOY_HOST`
- `DEPLOY_PATH`
- `DEPLOY_KEY` optional

Beispiel:

```bash
DEPLOY_USER=beispiel DEPLOY_HOST=example.com DEPLOY_PATH=/pfad/zum/webspace npm run deploy
```

`DEPLOY_KEY` kann ein absoluter oder relativer Pfad zu einem privaten Schlüssel oder ein Dateiname unter `~/.ssh` sein.

Keine Zugangsdaten, SSH-Schlüssel oder `.env`-Dateien committen.
