import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

const messages = {
  de: {
    nav: {
      brand: 'AGORA',
      dashboard: 'Dashboard',
      booking: 'Buchen',
      calendar: 'Kalender',
      admin: 'Admin',
      login: 'Anmelden',
      register: 'Konto erstellen',
      logout: 'Abmelden',
      guest: 'Gast',
      user: 'Benutzer',
      openMenu: 'Benutzermenü öffnen'
    },
    days: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    calendar: {
       toolbar: {
         prevWeek: 'Vorherige Woche',
         today: 'Heute',
         nextWeek: 'Nächste Woche',
         booking: 'Buchung',
         calendar: 'Kalender',
         table: 'Tabelle'
       },
       messages: {
         noBookingSelected: 'Keine Buchung ausgewählt.',
         loginRequired: 'Bitte zuerst einloggen.',
         adminRequired: 'Keine Admin-Berechtigung.',
         fillAllFields: 'Bitte alle Felder ausfüllen.',
         endTimeAfterStartTime: 'Endzeit muss nach der Startzeit liegen.',
         saved: 'Gespeichert.',
         changesSaved: 'Änderungen gespeichert.',
         confirmDelete: 'Buchung wirklich löschen?',
         notFound: 'Buchung nicht gefunden',
         deleteError: 'Fehler beim Löschen',
         loadRoomsError: 'Fehler beim Laden der Räume',
         loadBookingsError: 'Fehler beim Laden der Buchungen',
         occupied: 'Belegt',
       },
       modal: {
         title: 'Buchungsdetails',
         room: 'Raum',
         date: 'Datum',
         start: 'Start',
         end: 'Ende',
         participants: 'Teilnehmer',
         participantsHint: 'Komma/Zeilenumbruch getrennt.',
         save: 'Speichern',
         saving: 'Speichern...',
         delete: 'Löschen',
         deleting: 'Löschen...',
         close: 'Schließen',
         participantsList: 'Teilnehmer',
         noParticipants: 'Keine Teilnehmer gelistet.',
         timeRange: 'Zeitraum'
       },
       table: {
         date: 'Datum',
         time: 'Zeit',
         room: 'Raum',
         title: 'Titel / Teilnehmer',
         empty: 'Keine Buchungen gefunden.',
         unknownRoom: 'Unbekannt'
       }
    },
    booking: {
      title: 'Raumbuchung',
      subtitle: 'Buchen Sie einen Raum für Ihre Veranstaltung',
      loginRequired: 'Zum Buchen müssen Sie eingeloggt sein.',
      loginBtn: 'Jetzt anmelden',
      loggedInAs: 'Eingeloggt als:',
      viewCalendar: 'Kalender ansehen →',
      details: 'Details',
      room: 'Raum',
      selectRoom: '-- Raum wählen --',
      date: 'Datum',
      startTime: 'Startzeit',
      endTime: 'Endzeit',
      participantsTitle: 'Teilnehmer',
      addParticipant: 'Teilnehmer hinzufügen',
      searchPlaceholder: 'Name oder E-Mail suchen…',
      searching: '⏳ Suche läuft…',
      alreadyAdded: 'Bereits hinzugefügt',
      noResults: 'Keine Ergebnisse gefunden',
      removeParticipant: 'Teilnehmer entfernen',
      occupied: 'Zeitfenster belegt',
      saveError: 'Fehler beim Speichern',
      success: 'Buchung gespeichert.',
      required: '*'
    },
    login: {
      title: 'Anmelden',
      welcome: 'Willkommen,',
      toBooking: 'Zur Buchung',
      toCalendar: 'Zum Kalender',
      logout: 'Logout',
      email: 'E-Mail',
      password: 'Passwort',
      submit: 'Anmelden',
      register: 'Registrieren',
      backHome: '← Zurück zur Startseite',
      error: {
        email: 'Bitte E-Mail angeben.',
        password: 'Bitte Passwort angeben.',
        failed: 'Login fehlgeschlagen'
      },
      success: 'Login erfolgreich.',
      loggedOut: 'Abgemeldet.'
    },
    register: {
      title: 'Registrieren',
      firstname: 'Vorname',
      lastname: 'Nachname',
      email: 'E-Mail',
      password: 'Passwort',
      passwordRepeat: 'Passwort wiederholen', // Assuming field exists or should
      department: 'Abteilung (optional)',
      submit: 'Registrieren',
      submitting: '⏳ Wird registriert…',
      backToLogin: 'Bereits registriert? Anmelden', // Hypothetical
      error: {
        namesRequired: 'Vorname und Nachname sind erforderlich.',
        emailRequired: 'E-Mail ist erforderlich.',
        passwordRequired: 'Passwort ist erforderlich.',
        passwordLength: 'Passwort muss mindestens 6 Zeichen lang sein.',
        passwordMismatch: 'Passwörter stimmen nicht überein.',
        failed: 'Registrierung fehlgeschlagen'
      },
      success: 'Registrierung erfolgreich. Du bist jetzt als Mitarbeiter eingeloggt.'
    },
    admin: {
      title: 'Admin Dashboard',
      subtitle: 'Verwaltung von Räumen und Ressourcen',
      accessRestricted: 'Zugriff beschränkt',
      loginRequiredText: 'Du musst eingeloggt sein, um Räume zu verwalten.',
      toLogin: 'Zum Login',
      createRoom: 'Neuen Raum anlegen',
      createRoomDesc: 'Erfasse die Details für einen neuen Raum.',
      roomName: 'Bezeichnung',
      location: 'Standort',
      capacity: 'Kapazität (Personen)',
      submit: 'Raum anlegen',
      submitting: 'Wird angelegt...',
      reset: 'Zurücksetzen',
      noPermission: 'Keine Berechtigung',
      adminOnly: 'Dieser Bereich ist nur für Administratoren zugänglich.',
      placeholder: {
         roomName: 'z.B. Meetingraum A',
         location: 'z.B. 1. Stock',
         capacity: 'z.B. 8'
      },
      success: 'Raum erfolgreich angelegt',
      error: {
        required: 'Bezeichnung ist erforderlich.',
        locationRequired: 'Standort ist erforderlich.',
        capacity: 'Kapazität muss > 0 sein.',
        noAdmin: 'Keine Admin-Berechtigung.'
      }
    },
    home: {
      dashboard: {
        welcome: 'Willkommen zurück,',
        whatToDo: 'Was möchten Sie heute erledigen?',
        bookRoom: 'Raum buchen',
        bookRoomDesc: 'Erstellen Sie eine neue Raumbuchung für Ihr Meeting.',
        calendarOverview: 'Kalenderübersicht',
        calendarOverviewDesc: 'Prüfen Sie Raumverfügbarkeiten in der Wochenansicht.',
        administration: 'Verwaltung',
        administrationDesc: 'Räume und Benutzer verwalten.'
      },
      landing: {
        badge: 'Neu: Version 2.0',
        title: 'Raummanagement',
        titleSuffix: 'einfach & effizient.',
        subtitle: 'Die moderne Lösung für Schulen und Unternehmen. Verwalten Sie Räume, organisieren Sie Meetings und behalten Sie den Überblick.',
        ctaStart: 'Jetzt starten',
        ctaRegister: 'Kostenlos registrieren →',
        floating: {
           room: 'Meetingraum A',
           confirmed: 'Bestätigt'
        }
      },
      features: {
        fast: 'Schnell',
        fastDesc: 'Buchen Sie Räume in Sekunden ohne Papierkram.',
        mobile: 'Mobil',
        mobileDesc: 'Optimiert für Desktop, Tablet und Smartphone.',
        secure: 'Sicher',
        secureDesc: 'Rollenbasierte Zugriffsrechte und Datenschutz.'
      }
    },
    theme: {
      light: 'Hellen Modus aktivieren',
      dark: 'Dunklen Modus aktivieren',
    },
    lang: {
      toggle: 'Sprache zu Englisch ändern'
    },
    // Common terms that might be used elsewhere if converted
    common: {
      cancel: 'Abbrechen',
      save: 'Speichern',
      loading: 'Lädt...',
      error: 'Fehler',
      success: 'Erfolg'
    }
  },
  en: {
    nav: {
      brand: 'AGORA',
      dashboard: 'Dashboard',
      booking: 'Booking',
      calendar: 'Calendar',
      admin: 'Admin',
      login: 'Login',
      register: 'Create Account',
      logout: 'Logout',
      guest: 'Guest',
      user: 'User',
      openMenu: 'Open User Menu'
    },
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    calendar: {
       toolbar: {
         prevWeek: 'Previous Week',
         today: 'Today',
         nextWeek: 'Next Week',
         booking: 'Booking',
         calendar: 'Calendar',
         table: 'Table'
       },
       messages: {
         noBookingSelected: 'No booking selected.',
         loginRequired: 'Please login first.',
         adminRequired: 'No admin permissions.',
         fillAllFields: 'Please fill all fields.',
         endTimeAfterStartTime: 'End time must be after start time.',
         saved: 'Saved.',
         changesSaved: 'Changes saved.',
         confirmDelete: 'Really delete booking?',
         notFound: 'Booking not found',
         deleteError: 'Error deleting',
         loadRoomsError: 'Error loading rooms',
         loadBookingsError: 'Error loading bookings',
         occupied: 'Occupied',
       },
       modal: {
         title: 'Booking Details',
         room: 'Room',
         date: 'Date',
         start: 'Start',
         end: 'End',
         participants: 'Participants',
         participantsHint: 'Comma/newline separated.',
         save: 'Save',
         saving: 'Saving...',
         delete: 'Delete',
         deleting: 'Deleting...',
         close: 'Close',
         participantsList: 'Participants',
         noParticipants: 'No participants listed.',
         timeRange: 'Time Range'
       },
       table: {
         date: 'Date',
         time: 'Time',
         room: 'Room',
         title: 'Title / Participants',
         empty: 'No bookings found.',
         unknownRoom: 'Unknown'
       }
    },
    booking: {
      title: 'Room Booking',
      subtitle: 'Book a room for your event',
      loginRequired: 'You must be logged in to book.',
      loginBtn: 'Login now',
      loggedInAs: 'Logged in as:',
      viewCalendar: 'View Calendar →',
      details: 'Details',
      room: 'Room',
      selectRoom: '-- Select Room --',
      date: 'Date',
      startTime: 'Start Time',
      endTime: 'End Time',
      participantsTitle: 'Participants',
      addParticipant: 'Add Participant',
      searchPlaceholder: 'Search name or email…',
      searching: '⏳ Searching…',
      alreadyAdded: 'Already added',
      noResults: 'No results found',
      removeParticipant: 'Remove Participant',
      occupied: 'Time slot occupied',
      saveError: 'Error saving',
      success: 'Booking saved.',
      required: '*'
    },
    login: {
      title: 'Login',
      welcome: 'Welcome,',
      toBooking: 'To Booking',
      toCalendar: 'To Calendar',
      logout: 'Logout',
      email: 'E-Mail',
      password: 'Password',
      submit: 'Login',
      register: 'Register',
      backHome: '← Back to Home',
      error: {
        email: 'Please provide email.',
        password: 'Please provide password.',
        failed: 'Login failed'
      },
      success: 'Login successful.',
      loggedOut: 'Logged out.'
    },
    register: {
      title: 'Register',
      firstname: 'Firstname',
      lastname: 'Lastname',
      email: 'E-Mail',
      password: 'Password',
      passwordRepeat: 'Repeat Password',
      department: 'Department (optional)',
      submit: 'Register',
      submitting: '⏳ Registering…',
      backToLogin: 'Already registered? Login',
      error: {
        namesRequired: 'First and Lastname are required.',
        emailRequired: 'E-Mail is required.',
        passwordRequired: 'Password is required.',
        passwordLength: 'Password must be at least 6 characters.',
        passwordMismatch: 'Passwords do not match.',
        failed: 'Registration failed'
      },
      success: 'Registration successful. You are now logged in.'
    },
    admin: {
      title: 'Admin Dashboard',
      subtitle: 'Manage rooms and resources',
      accessRestricted: 'Access Restricted',
      loginRequiredText: 'You must be logged in to manage rooms.',
      toLogin: 'To Login',
      createRoom: 'Create New Room',
      createRoomDesc: 'Enter details for a new room.',
      roomName: 'Designation',
      location: 'Location',
      capacity: 'Capacity (People)',
      submit: 'Create Room',
      submitting: 'Creating...',
      reset: 'Reset',
      noPermission: 'No Permission',
      adminOnly: 'This area is restricted to administrators.',
      placeholder: {
         roomName: 'e.g. Meeting Room A',
         location: 'e.g. 1st Floor',
         capacity: 'e.g. 8'
      },
      success: 'Room created successfully',
      error: {
        required: 'Designation is required.',
        locationRequired: 'Location is required.',
        capacity: 'Capacity must be > 0.',
        noAdmin: 'No Admin permissions.'
      }
    },
    home: {
      dashboard: {
        welcome: 'Welcome back,',
        whatToDo: 'What would you like to do today?',
        bookRoom: 'Book Room',
        bookRoomDesc: 'Create a new room booking for your meeting.',
        calendarOverview: 'Calendar Overview',
        calendarOverviewDesc: 'Check room availability in weekly view.',
        administration: 'Administration',
        administrationDesc: 'Manage rooms and users.'
      },
      landing: {
        badge: 'New: Version 2.0',
        title: 'Room Management',
        titleSuffix: 'simple & efficient.',
        subtitle: 'The modern solution for schools and companies. Manage rooms, organize meetings and keep track.',
        ctaStart: 'Start now',
        ctaRegister: 'Register for free →',
        floating: {
           room: 'Meeting Room A',
           confirmed: 'Confirmed'
        }
      },
      features: {
        fast: 'Fast',
        fastDesc: 'Book rooms in seconds without paperwork.',
        mobile: 'Mobile',
        mobileDesc: 'Optimized for desktop, tablet and smartphone.',
        secure: 'Secure',
        secureDesc: 'Role-based access rights and data protection.'
      }
    },
    theme: {
      light: 'Enable Light Mode',
      dark: 'Enable Dark Mode',
    },
    lang: {
      toggle: 'Switch to German'
    },
    common: {
      cancel: 'Cancel',
      save: 'Save',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success'
    }
  }
}

export const SUPPORTED_LOCALES = ['de', 'en']

const i18n = createI18n({
  legacy: false, // use Composition API
  locale: localStorage.getItem('lang') || 'de', 
  fallbackLocale: 'en',
  globalInjection: true,
  messages
})

export default i18n
