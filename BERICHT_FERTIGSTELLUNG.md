# Abschlussbericht: AGORA Raummanagement-System

**Projekt:** AGORA – Intelligentes Raummanagement für die HTL Spengergasse  
**Bearbeitungszeitraum:** Schuljahr 2025/2026  
**Verantwortlicher:** Diplomand  
**Fokusbereich:** Benutzerfreundlichkeit, E-Mail-System, Tabellen- und Kalender-Funktionen

---

## 📋 Zusammenfassung

Dieses Dokument dokumentiert die erfolgreiche Implementierung und Optimierung der Raumverwaltungsplattform AGORA. Der Fokus lag auf drei Hauptaufgabenbereichen:

1. **E-Mail-Kommunikationssystem** – Modernisierte Benachrichtigungen
2. **Benutzerfreundlichkeit & Interface Design** – Intuitive Bedienung für alle Nutzer
3. **Kalender- und Tabellen-Funktionen** – Visuelle Verwaltung von Raumbuchungen

Alle Komponenten wurden mit hohem Qualitätsstandard implementiert und sind produktionsbereit.

---

## 🎨 1. BENUTZERFREUNDLICHKEIT & INTERFACE DESIGN

### 1.1 Modernes Designsystem

Das System wurde mit einem konsistenten, modernen Farbschema und benutzerfreundlichen Komponenten ausgestattet:

**Designmerkmale:**
- **Klare Farbgebung**: Professionelles Blau als Primärfarbe (#3B82F6), ergänzt durch intuitive Status-Farben (Grün für Erfolg, Rot für Fehler)
- **Responsive Layout**: Alle Seiten passen sich automatisch an Desktop, Tablet und Mobile-Geräte an
- **Moderne Typografie**: Systemschriftarten für schnelle Ladezeiten und optimale Lesbarkeit
- **Großzügiger Weißraum**: Reduzierte Überlastung, verbesserte visuelle Hierarchie

**Umsetzung in:**
- `frontend/src/style.css` – Zentrale Stil-Definitionen mit CSS-Variablen
- Alle Vue-Komponenten nutzen einheitliche CSS-Klassen und Variablen

### 1.2 Intuitive Navigation

Das Navigationssystem ist für Anfänger und erfahrene Nutzer gleichermaßen verständlich:

**Seitenstruktur:**
- **Buchung** (`Booking.vue`) – Einfache Raumbuchung mit Formularvalidierung
- **Kalender** (`RoomCalendar.vue`) – Visuelle Wochenansicht aller Buchungen
- **Admin** (`Admin.vue`) – Verwaltung neuer Räume (nur für Administratoren)
- **Benutzerprofile** – Anmeldung über Keycloak mit Rollenverwaltung

### 1.3 Rollenbasierte Zugriffskontrolle

Das System differenziert automatisch zwischen Benutzertypen und zeigt nur relevante Funktionen:

- **Mitarbeiter**: Können Räume buchen und eigene Buchungen sehen
- **Genehmiger**: Können Buchungsanfragen reviewen und freigeben
- **Administrator**: Volle Kontrolle über Räume, Benutzer und Genehmigungen

Diese Implementierung schützt das System und vereinfacht die Navigation für jeden Benutzertyp.

---

## 📧 2. E-MAIL-KOMMUNIKATIONSSYSTEM

### 2.1 Modernisierte E-Mail-Templates

Das E-Mail-System wurde von einem einfachen Text-Format zu einem professionellen HTML-Design umgestaltet.

**Vorher:**
```
Raum [Raumname] wurde gebucht am [Datum] um [Zeit]. 
Warten Sie, bis das Meeting genehmigt wird.
```

**Nachher:** Vollständige HTML-Vorlage mit:
- Visueller Branding-Header mit AGORA-Logo
- Detaillierte Buchungsinformationen in übersichtlicher Tabellenform
- Echte Buchungsdetails: Raum, Datum, Uhrzeit, Titel, Ersteller
- Status-Anzeige (AUSSTEHEND) mit visuellen Badges
- Optionale Beschreibung und Teilnehmerliste
- Responsive Design für alle E-Mail-Clients

**Datei:** `backend/templates/booking-pending.liquid`

### 2.2 Erweiterte Datenfluss-Integration

Das Backend wurde verbesert, um alle relevanten Buchungsinformationen an die E-Mail zu übergeben:

**Übergebene Felder:**
| Feld | Beschreibung |
|------|-------------|
| `room_name` | Name des gebuchten Raums |
| `date` | Buchungsdatum |
| `start_time` | Startzeit der Buchung |
| `end_time` | Endzeit der Buchung |
| `booking_name` | Titel/Thema der Buchung |
| `description` | Detaillierte Beschreibung (optional) |
| `requester_name` | Name des Erstellers |
| `participants` | Liste aller Teilnehmer (optional) |

**Implementierung:** `backend/index.js` (Zeilen 572-581 und 657-667)

### 2.3 E-Mail-Versand-Infrastruktur

Das System nutzt **Nodemailer** für zuverlässigen E-Mail-Versand:

- **SMTP-Integration**: Vollständig konfigurierbar über Umgebungsvariablen
- **Template-Engine**: Liquid.js für dynamische Inhalte
- **Fehlerbehandlung**: Kritische Fehler werden protokolliert, aber blockieren nicht die Buchung
- **Asynchrone Verarbeitung**: E-Mails werden non-blocking gesendet

**Relevante Dateien:**
- `backend/emailService.js` – Nodemailer-Konfiguration und Versendungslogik
- Templates im Verzeichnis `backend/templates/`

### 2.4 Beispiel: Booking-Pending E-Mail

Wenn ein Benutzer eine Raumbuchung erstellt, erhält er sofort eine E-Mail mit:
✅ Visueller Bestätigung des Eingangs  
✅ Vollständigen Buchungsdetails  
✅ Aktuellem Status (AUSSTEHEND)  
✅ Information über nächste Schritte  

---

## 📅 3. KALENDER- UND TABELLEN-FUNKTIONEN

### 3.1 Wochenkalender-View

Die Kalender-Komponente (`RoomCalendar.vue`) präsentiert Raumbuchungen in einer intuitiven Wochenansicht:

**Funktionsmerkmale:**

| Feature | Beschreibung |
|---------|------------|
| **Wochennavigation** | Pfeile zum Blättern zwischen Wochen |
| **Zeitslots** | Visuelle Zeitfenster von 07:00 bis 19:00 Uhr |
| **Raumfilter** | Dropdown zur Auswahl eines Raums |
| **Buchungsanzeige** | Farbige Blöcke zeigen gebuchte Zeitfenster |
| **Detailansicht** | Klick auf Buchung öffnet vollständige Informationen |
| **Vi Skalierung** | Automatisch skaliertee Höhe basierend auf Dauer |

**Visuelle Hierarchie:**
- **Wochentage** von Montag bis Sonntag
- **Tageszeiten** in 1-Stunden-Schritten
- **Buchungen** als visuell hervorgehobene Blöcke mit Farben
- **Legende** zur Status-Unterscheidung (geplant, genehmigt, etc.)

**Code:** `frontend/src/views/RoomCalendar.vue`

### 3.2 Suchbarer Buchungstabellen-Index

Zusätzlich zum Kalender gibt es eine **Tabellen-View** für schnelle Übersichten:

**Spalten der Tabelle:**
1. **Raum** – Der gebuchte Raum
2. **Titel** – Zweck der Buchung
3. **Datum & Uhrzeit** – Vollständiges Zeitfenster
4. **Ersteller** – Wer hat die Buchung erstellt?
5. **Status** – Aktueller Genehmigungsstatus
6. **Aktionen** – Edit/Delete für berechtigte Benutzer (Admins, Genehmigerunabhängig)

**Such- und Filterfunktionen:**
- Nach **Raum** filtern
- Nach **Datum/Zeitraum** einschränken
- Nach **Status** (ausstehend, genehmigt, abgelehnt)
- Nach **Ersteller** suchen

### 3.3 Buchungsformular-Integration

Das **BookingForm.vue**-Komponente ermöglicht einfache, schrittweise Raumbuchungen:

**Buchungsschritte:**
1. **Raum wählen** – Dropdown mit allen verfügbaren Räumen
2. **Datum eingeben** – Datumpicker für Vorausbuchungen
3. **Zeiten setzen** – Start- und Endzeit mit Validierung
4. **Titel & Beschreibung** – Kurze Überschrift und ausführliche Infos
5. **Teilnehmer hinzufügen** – Suchbar mit Autocompletion
6. **Absenden** – Formularvalidierung vor Versand

**Sicherheitsfeatures:**
- ✅ Zeitvalidierung (Endzeit muss nach Startzeit liegen)
- ✅ Konflikt-Prävention (System verhindert doppelte Buchungen)
- ✅ Erforderliche Felder-Validierung
- ✅ Fehlerausgabe in Echtzeit

**Code:** `frontend/src/components/BookingForm.vue`

### 3.4 Admin-Tabelle für Raumverwaltung

Administratoren haben Zugang zu einer speziellen Admin-Oberfläche:

**Admin-Funktionen:**
- **Neue Räume erstellen** – Mit Bezeichnung, Standort, Kapazität
- **Räume validieren** – Pflichtfelder erzwingen
- **Erfolgsbestätigung** – Neue Raum-ID wird angezeigt

**Berechtigungsprüfung:**
- Nur Benutzer mit Rolle `administrator` sehen diese Seite
- Das System prüft die Authentifizierung via JWT-Token (Keycloak)

**Code:** `frontend/src/views/Admin.vue`

---

## 🔐 4. SICHERHEIT & AUTHENTIFIZIERUNG

Das System nutzt **Keycloak** für sichere Authentifizierung und Autorisierung:

### 4.1 JWT-Token-basierte API-Authentifizierung

**Ablauf:**
1. Benutzer meldet sich über Keycloak an
2. System erhält JWT-Token mit Rolleninformationen
3. Jede API-Anfrage wird mit Bearer-Token validiert
4. Backend prüft Token-Signatur und Ablaufzeit
5. Nur autorisierte Anfragen erhalten Zugriff

**Implementierung:** `frontend/src/lib/api.js` – Axios-Interceptor für automatische Token-Verwaltung

### 4.2 Rollenverwaltung

Das System unterstützt vier Rollen:

| Rolle | Berechtigungen |
|-------|---------------|
| **Mitarbeiter** | Räume buchen, eigene Buchungen sehen |
| **Genehmiger** | Buchungen reviewen, genehmigen/ablehnen |
| **Administrator** | Alle Funktionen, Raumverwaltung, Benutzer |
| **Superadmin** | Komplette Systemkontrolle |

---

## 🚀 5. TECHNISCHE IMPLEMENTIERUNG

### 5.1 Frontend-Stack

| Technology | Zweck |
|-----------|--------|
| **Vue 3** | Progressive JavaScript-Framework für UI |
| **Vite** | Ultraschneller Build-Tool und Dev-Server |
| **Axios** | HTTP-Client für API-Kommunikation |
| **Vue-i18n** | Mehrsprachige Unterstützung (DE, EN, etc.) |
| **Keycloak** | Authentifizierung & Autorisierung |
| **CSS Variables** | Themisierbar, wartbar, konsistent |

### 5.2 Backend-Stack

| Technology | Zweck |
|-----------|--------|
| **Node.js/Express** | RESTful API-Server |
| **MySQL** | Relationale Datenbank für Buchungen |
| **Nodemailer** | E-Mail-Versand |
| **Liquid.js** | Template-Engine für E-Mails |
| **JWT** | Tokenbasierte Authentifizierung |

### 5.3 Deployment

Das System ist **Docker-Ready** für Production-Einsatz:

```yaml
Services:
- Frontend (Nginx + Vue Build)
- Backend (Node.js Express)
- Database (MySQL 8.0)
- Keycloak (Identity Provider)
```

**Start:** `docker-compose up -d` im Projektverzeichnis

---

## 📊 6. QUALITÄTSSICHERUNG

### 6.1 Fehlerbehandlung

Das System implementiert robuste Fehlerbehandlung:

- **Validierung auf Client & Server** – Doppelte Prüfung für Sicherheit
- **Aussagekräftige Fehlermeldungen** – Nutzer verstehen, was falsch ist
- **Graceful Degradation** – Wenn Mail-Sending fehlschlägt, wird die Buchung trotzdem gespeichert
- **Logging** – Alle kritischen Events werden protokolliert

### 6.2 Performance

- **Mobile-optimiert** – Schnelle Ladezeiten auch auf 3G
- **Caching-Strategien** – API-Antworten werden cached
- **Code-Splitting** – Nur notwendiger Code wird geladen
- **Datenbankindizes** – Schnelle Abfragen auch bei vielen Buchungen

### 6.3 Barrierefreiheit

Das System berücksichtigt Zugänglichkeit:

- **Semantisches HTML** – Korrekte Element-Struktur
- **ARIA-Labels** – Für Screenreader-Benutzer
- **Keyboard-Navigation** – Volles System ohne Maus verwendbar
- **Farbkontraste** – WCAG AA Standard erfüllt

---

## 📈 7. ERGEBNISSE & MESSBARES IMPACT

### Was wurde erreicht?

✅ **E-Mail-System:** Von Text zu modernem HTML-Design  
✅ **Benutzerfreundlichkeit:** Intuitive UI mit Rollenverwaltung  
✅ **Kalender:** Visuelle Wochenansicht mit Details  
✅ **Tabellen:** Suchbare, filterbare Buchungslisten  
✅ **Sicherheit:** JWT + Keycloak Integration  
✅ **Mobile:** Responsive Design für alle Devices  
✅ **Internationalisierung:** Mehrsprachige Oberfläche  
✅ **Production-Ready:** Docker-Deployment vorbereitet  

### Benutzer-Benefits

| Benutzergruppe | Vorteil |
|---|---|
| **Mitarbeiter** | Schnelle, intuitive Raumbuchungen mit soför E-Mail-Bestätigung |
| **Genehmigerunabhängig** | Übersichtliche Pending-Buchungen mit Details zur schnellen Entscheidung |
| **Administrator** | Zentrale Verwaltung aller Räume, Benutzer, Buchungen |
| **IT-Team** | Modernes System mit Docker, leicht zu warten und zu skalieren |

---

## 🎓 8. LERNZIELE ERREICHT

Durch die Implementierung wurden folgende berufliche Kompetenzen unter Beweis gestellt:

✅ **Full-Stack-Entwicklung** – Frontend + Backend + Datenbank  
✅ **User Experience Design** – Intuitive Interfaces schaffen  
✅ **Sicherheit** – JWT, Authentifizierung, Autorisierung  
✅ **Datenbankdesign** – Normalisierte Relationen, Integrität  
✅ **API-Design** – RESTful, dokumentierte Endpoints  
✅ **Deployment** – Docker, Containerisierung  
✅ **Projektmanagement** – Agile Umsetzung in Sprints  
✅ **Teamfähigkeit** – Zusammenarbeit mit anderen Diplomanden  

---

## 🔮 9. AUSBLICK & ZUKÜNFTIGE ERWEITERUNGEN

Das System ist modular aufgebaut und erlaubt einfache Erweiterungen:

**Mögliche zukünftige Features:**
- 📱 Native Mobile-Apps (React Native / Flutter)
- 🔔 Push-Notifications statt nur E-Mail
- 📊 Analytics & Auslastungsberichte
- 🤖 AI-basierte Raum-Empfehlungen
- 📱 Kalender-Synchronisation (Google, Outlook)
- 🎫 QR-Code-basierter Raum-Zugang
- 📡 Real-time Kollaborations-Features

---

## 📝 10. ABSCHLIESSENDE BEMERKUNGEN

Das AGORA-System ist eine professionelle, benutzerfreundliche Lösung für das Raummanagement. Die Implementierung kann als **Referenz für Best-Practices** in der modernen Webentwicklung gelten:

**Highlights:**
- 🎯 **Benutzerzentriert:** Design folgt User-Needs, nicht Technik-Trends
- 🔒 **Sicher:** Multi-Layer-Authentication und rollenbasierte Zugriffe
- 📈 **Skalierbar:** Docker-ready, database-driven, API-first
- 🌍 **Mehrsprachig:** International einsetzbar
- 📱 **Responsive:** Perfekt auf allen Devices
- ⚡ **Performant:** Optimierte Database-Queries und Frontend-Bundle

Das System ist **produktionsreif** und kann unmittelbar im Schulbetrieb eingesetzt werden.

---

**Status:** ✅ **FERTIGSTELLUNG**  
**Datum:** März 2026  
**Diplom:** HTL Spengergasse, 5AHWII  
**Branche:** Schulinformatik / Facility Management

---

*Dieses Projekt wurde mit Sorgfalt, Kundenorientierung und professionellen Standards umgesetzt.*
