# Paperless NGX MCP Server

Ein Model Context Protocol (MCP) Server für Paperless NGX, der als Remote-Server läuft und von überall erreichbar ist – auch von der Claude Mobile App.

## Überblick

Dieser MCP Server verbindet Claude mit deinem Paperless NGX Dokumentenmanagementsystem über HTTP. Im Gegensatz zu lokalen MCP-Servern, die nur auf dem Desktop funktionieren, läuft dieser Server auf deinem eigenen Server (z.B. neben Paperless selbst) und ist von überall aus erreichbar.

Das bedeutet: Du kannst von deinem Handy aus dein Dokumentenarchiv durchsuchen, Metadaten aktualisieren und deine Dokumente verwalten – direkt durch Claude.

## Features

Der Server bietet umfassende Dokumentenverwaltung mit Volltextsuche über alle Dokumente, dem Abrufen von Dokumentdetails inklusive OCR-Text, dem Aktualisieren von Metadaten wie Titel, Tags und Korrespondent, sowie dem Löschen von Dokumenten mit Sicherheitsabfrage.

Für die Organisation deiner Dokumente kannst du Tags mit Farben und Auto-Matching-Regeln verwalten, Korrespondenten erstellen und auflisten, sowie Dokumenttypen für die Kategorisierung nutzen.

Erweiterte Funktionen umfassen das Ausführen gespeicherter Ansichten (Saved Views), das Abrufen von Systemstatistiken, und KI-generierte Metadaten-Vorschläge für neue Dokumente.

## Voraussetzungen

Du benötigst einen Server mit Docker und Docker Compose installiert. Dieser Server sollte Netzwerkzugriff auf deine Paperless NGX Installation haben. Außerdem brauchst du einen API-Token von Paperless NGX mit entsprechenden Berechtigungen.

## Schnellstart mit Docker

Der einfachste Weg, den Server zu starten, ist mit Docker Compose.

Zuerst klonst oder kopierst du das Projekt auf deinen Server:

```bash
mkdir -p ~/mcp-servers/paperless-ngx
cd ~/mcp-servers/paperless-ngx
# Kopiere alle Dateien hierher
```

Dann erstellst du eine `.env` Datei aus dem Template:

```bash
cp .env.example .env
nano .env
```

Trage deine Werte ein:

```
PAPERLESS_URL=https://paperless.deine-domain.de
PAPERLESS_TOKEN=dein-api-token-hier
```

Jetzt kannst du den Container starten:

```bash
docker-compose up -d
```

Der Server läuft nun auf Port 3000. Prüfe den Status mit:

```bash
docker-compose logs -f
curl http://localhost:3000/health
```

## Verbindung mit Claude

### Claude.ai Web & Mobile (Remote MCP)

Um den Server mit Claude.ai zu verbinden, musst du ihn zunächst über das Internet erreichbar machen. Das kann über einen Reverse Proxy wie Nginx oder Traefik erfolgen. Achte dabei unbedingt auf HTTPS-Verschlüsselung.

In deiner Nginx-Konfiguration könnte das so aussehen:

```nginx
server {
    listen 443 ssl;
    server_name mcp-paperless.deine-domain.de;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Sobald der Server von außen erreichbar ist, kannst du ihn in Claude.ai als MCP-Server hinzufügen. Gehe dazu in die Claude.ai Einstellungen und füge einen neuen MCP-Server mit der URL `https://mcp-paperless.deine-domain.de/mcp` hinzu.

### Claude Desktop (Optional)

Für lokale Verwendung mit Claude Desktop kannst du den Server auch im stdio-Modus betreiben. Füge dazu folgende Konfiguration zu deiner `claude_desktop_config.json` hinzu:

```json
{
  "mcpServers": {
    "paperless-ngx": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "PAPERLESS_URL=https://paperless.example.com",
        "-e", "PAPERLESS_TOKEN=dein-token",
        "-e", "TRANSPORT=stdio",
        "paperless-ngx-mcp-server"
      ]
    }
  }
}
```

## Verfügbare Tools

Der Server stellt 14 Tools für die Dokumentenverwaltung bereit.

Für Dokumente gibt es `paperless_search_documents` für die Volltextsuche mit Filtern, `paperless_get_document` zum Abrufen von Details, `paperless_update_document` zum Ändern von Metadaten, `paperless_delete_document` zum dauerhaften Löschen, `paperless_get_document_download_url` zum Generieren von Download-Links, und `paperless_get_suggestions` für KI-Metadaten-Vorschläge.

Für Tags stehen `paperless_list_tags` zum Auflisten und `paperless_create_tag` zum Erstellen zur Verfügung.

Korrespondenten werden mit `paperless_list_correspondents` aufgelistet und mit `paperless_create_correspondent` erstellt.

Dokumenttypen können über `paperless_list_document_types` angezeigt und mit `paperless_create_document_type` angelegt werden.

Für gespeicherte Ansichten gibt es `paperless_list_saved_views` und `paperless_execute_saved_view` zum Ausführen.

Die Systemstatistiken werden mit `paperless_get_statistics` abgerufen.

## Beispiel-Anfragen an Claude

Hier sind einige Beispiele, wie du mit Claude und dem Paperless MCP Server interagieren kannst:

"Suche nach allen Rechnungen von Deutsche Telekom aus 2024."

"Zeig mir die Details zu Dokument Nummer 42 und lies mir den Inhalt vor."

"Erstelle einen neuen Tag namens 'Steuer 2025' mit roter Farbe."

"Welche Dokumente sind noch im Inbox-Tag und warten auf Verarbeitung?"

"Gib mir die Statistiken meines Paperless-Archivs."

"Führe die gespeicherte Ansicht 'Unbezahlte Rechnungen' aus."

## Sicherheitshinweise

Der MCP Server hat vollen Zugriff auf dein Paperless NGX System entsprechend der Token-Berechtigungen. Beachte daher folgende Sicherheitsempfehlungen.

Verwende ausschließlich HTTPS für die externe Erreichbarkeit. Speichere deinen API-Token niemals im Code, sondern nutze Umgebungsvariablen. Beschränke die Token-Berechtigungen in Paperless auf das Notwendige. Setze eine Firewall ein und beschränke den Zugriff auf vertrauenswürdige IPs wenn möglich. Überwache die Container-Logs regelmäßig auf ungewöhnliche Aktivitäten.

## Lokale Entwicklung

Für die Entwicklung ohne Docker kannst du den Server direkt mit Node.js starten.

Installiere zuerst die Abhängigkeiten:

```bash
npm install
```

Setze die Umgebungsvariablen:

```bash
export PAPERLESS_URL="https://dein-paperless-server.de"
export PAPERLESS_TOKEN="dein-token"
```

Starte den Server im Entwicklungsmodus mit automatischem Reload:

```bash
npm run dev
```

Oder baue und starte die Produktionsversion:

```bash
npm run build
npm start
```

## Projektstruktur

Das Projekt ist wie folgt organisiert:

```
paperless-ngx-mcp-server/
├── src/
│   ├── index.ts           # Haupteinstiegspunkt, Transport-Setup
│   ├── constants.ts       # Konfiguration und Konstanten
│   ├── types.ts           # TypeScript Typdefinitionen
│   ├── schemas/
│   │   └── index.ts       # Zod Validierungsschemas
│   ├── services/
│   │   ├── paperless-api.ts  # HTTP Client für Paperless API
│   │   └── formatters.ts     # Markdown/JSON Formatierung
│   └── tools/
│       └── index.ts       # MCP Tool-Implementierungen
├── Dockerfile             # Container-Build-Definition
├── docker-compose.yml     # Deployment-Konfiguration
├── package.json           # Node.js Projektdatei
└── tsconfig.json          # TypeScript-Konfiguration
```

## Troubleshooting

Wenn der Container nicht startet, prüfe die Logs mit `docker-compose logs` auf Fehlermeldungen. Stelle sicher, dass PAPERLESS_URL und PAPERLESS_TOKEN korrekt gesetzt sind.

Bei Verbindungsfehlern zu Paperless überprüfe, ob der Container Netzwerkzugang zum Paperless-Server hat. Bei Docker-Netzwerken kann es nötig sein, die interne Docker-IP oder den Hostnamen zu verwenden.

Bei Authentifizierungsfehlern (401) ist der API-Token wahrscheinlich ungültig oder abgelaufen. Erstelle einen neuen Token in den Paperless-Einstellungen.

Bei Berechtigungsfehlern (403) hat der Token möglicherweise nicht die nötigen Rechte für die gewünschte Operation. Prüfe die Token-Berechtigungen.

## Lizenz

MIT License
