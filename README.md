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
npm run test:deploy
npm run build
npm run preview
npm run deploy
```

- `npm run dev` startet den Astro-Entwicklungsserver.
- `npm run check` führt Astro- und TypeScript-Prüfungen aus.
- `npm run build` erzeugt die Produktionsdateien in `dist/`.
- `npm run preview` zeigt den Produktionsbuild lokal an.
- `npm run deploy` baut die Website und lädt den Inhalt von `dist/` per SSH, FTP oder FTPS hoch.
- `npm run test:deploy` prüft die Deployment-Konfiguration und Fehlerbehandlung ohne Hosting-Zugriff.

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

Das Deployment ist optional und wird nicht automatisch ausgeführt. Auf Linux, macOS und Windows wird es mit `npm run deploy` gestartet. SSH benötigt OpenSSH `ssh` und `scp` im `PATH`; FTP/FTPS nutzt die npm-Abhängigkeit `basic-ftp` im passiven Modus. Auf dem Webspace läuft weiterhin nur die statische Website.

### Konfiguration

Alle Verbindungsangaben müssen ausdrücklich gesetzt werden. Es gibt kein Standardprotokoll, keinen Standardport und keine automatische Wahl der Authentifizierung. Vorhandene SSH-Konfigurationen müssen um `DEPLOY_PROTOCOL`, `DEPLOY_PORT` und `DEPLOY_SSH_AUTH` ergänzt werden.

Variablen können aus der Shell, aus CI-Secrets oder aus einer lokalen, nicht versionierten `.env` im Projektverzeichnis kommen. Bereits gesetzte Shell-/CI-Werte haben Vorrang, auch wenn sie leer sind. `.env.example` enthält ausschließlich leere Felder und Erläuterungen.

| Variable | Erforderlicher Wert |
| --- | --- |
| `DEPLOY_PROTOCOL` | `ssh`, `ftp` oder `ftps` |
| `DEPLOY_HOST` | Hostname oder IPv4-Adresse, ohne Protokoll und Port |
| `DEPLOY_PORT` | Expliziter Port zwischen 1 und 65535 |
| `DEPLOY_USER` | Benutzername |
| `DEPLOY_PATH` | Konkretes Webverzeichnis, absolut oder relativ zum Anmeldeverzeichnis |
| `DEPLOY_PASSWORD` | Bei FTP/FTPS: Passwort |
| `DEPLOY_FTPS_MODE` | Bei FTPS: `explicit` (STARTTLS) oder `implicit` (TLS ab Verbindungsaufbau) |
| `DEPLOY_SSH_AUTH` | Bei SSH: `key` oder `agent` |
| `DEPLOY_KEY` | Bei SSH mit `key`: privater Schlüsselpfad oder Dateiname unter `~/.ssh` |

Für SSH sind 22, für FTP und explizites FTPS 21 sowie für implizites FTPS 990 übliche Ports. Maßgeblich ist der vom Hosting-Anbieter genannte Port; das Skript setzt keinen davon automatisch.

Beispiel für eine lokale `.env` mit explizitem FTPS (Platzhalter ersetzen):

```dotenv
DEPLOY_PROTOCOL=ftps
DEPLOY_HOST=ftp.example.com
DEPLOY_PORT=21
DEPLOY_USER=beispiel
DEPLOY_PATH=/web/site
DEPLOY_PASSWORD='hier-das-passwort-eintragen'
DEPLOY_FTPS_MODE=explicit
```

Für unverschlüsseltes FTP ausdrücklich `DEPLOY_PROTOCOL=ftp` setzen und `DEPLOY_FTPS_MODE` weglassen. FTPS prüft Zertifikat und Hostnamen und fällt bei TLS-Fehlern nicht auf FTP zurück. FTP überträgt auch das Passwort unverschlüsselt.

Beispiel für SSH mit Schlüsseldatei:

```dotenv
DEPLOY_PROTOCOL=ssh
DEPLOY_HOST=example.com
DEPLOY_PORT=22
DEPLOY_USER=beispiel
DEPLOY_PATH=/web/site
DEPLOY_SSH_AUTH=key
DEPLOY_KEY=website_ed25519
```

Relative Schlüsselpfade beziehen sich auf das Projektverzeichnis. Ein reiner Dateiname wird zusätzlich unter `~/.ssh` gesucht. Bei `key` wird ausschließlich die angegebene Schlüsseldatei verwendet; bei `agent` ausschließlich der SSH-Agent. Für passwortgeschützte Schlüssel den Schlüssel vorab in den Agent laden und `DEPLOY_SSH_AUTH=agent` setzen. Benutzer- und systemweite SSH-Konfigurationsdateien werden mit `-F none` nicht geladen; Host, Port und Authentifizierung stammen aus der Deployment-Konfiguration. Die OpenSSH-Hostschlüsselprüfung bleibt aktiv; der Host muss für einen nicht interaktiven Lauf bereits vertrauenswürdig eingerichtet sein.

Passwörter werden unverändert verwendet. In `.env` Passwörter mit führenden oder abschließenden Leerzeichen in einfache oder doppelte Anführungszeichen setzen. Der einfache Parser entfernt nur die äußeren Anführungszeichen; er expandiert keine Variablen oder Backslash-Escapes. Zeilenumbrüche und NUL-Zeichen sind in FTP-Passwörtern nicht erlaubt.

### Ablauf und Zielverzeichnis

1. Konfiguration prüfen und die Website bauen.
2. Prüfen, dass `dist/` existiert und nicht leer ist.
3. Zielverzeichnis anlegen bzw. betreten und **dessen gesamten Inhalt löschen**, einschließlich zusätzlicher Serverdateien.
4. Den vollständigen Inhalt von `dist/`, einschließlich Unterverzeichnissen und versteckten Dateien, hochladen.

Das Ziel muss ausschließlich für diese Website bestimmt sein. `/`, `.` und Pfade mit `.`- oder `..`-Segmenten sind nicht erlaubt. Für SSH sind im Zielpfad nur Buchstaben, Ziffern, `_`, `.`, `/` und `-` erlaubt; ein führendes `-` ist ausgeschlossen. FTP-Pfade dürfen auch Leerzeichen enthalten. Ein FTP-Konto, dessen Website direkt im Login-Wurzelverzeichnis `/` liegt, benötigt ein eigenes Unterverzeichnis als Deployment-Ziel.

Das Ersetzen ist nicht atomar: Während des Uploads kann die Website vorübergehend unvollständig sein. Ein Abbruch nach dem Leeren kann ein leeres oder teilweise befülltes Ziel hinterlassen. Nach Beheben der Ursache erneut deployen. Build-, Verbindungs-, Lösch- und Uploadfehler liefern einen Fehlerstatus; nach einem Löschfehler erfolgt kein Upload.

Keine Zugangsdaten, SSH-Schlüssel oder `.env`-Dateien committen.

### Gerüst aktualisieren

Allgemeine Änderungen an Build, Deployment und Werkzeugen zuerst in `codex-website` entwickeln und dort separat committen. Website-spezifische Inhalte und Gestaltung bleiben in den Website-Repositories. Geeignete Gerüst-Commits dort gezielt mit `git fetch upstream` und `git cherry-pick -x <commit>` übernehmen, danach `npm install`, `npm run test:deploy`, `npm run check` und `npm run build` ausführen. Inhalte unter `src/`, `public/` und projektspezifischen Inhaltsverzeichnissen bei einem reinen Deployment-Update nicht verändern.
