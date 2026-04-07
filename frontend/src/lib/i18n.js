import { createI18n } from 'vue-i18n'

const messages = {
  de: {
    nav: {
      brand: 'AGORA',
      dashboard: 'Dashboard',
      booking: 'Buchen',
      calendar: 'Kalender',
      approvals: 'Genehmigungen',
      admin: 'Admin',
      wiki: 'Wiki',
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
         myCalendar: 'Mein Kalender',
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
         status: 'Status',
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
         status: 'Status',
         title: 'Titel / Teilnehmer',
         empty: 'Keine Buchungen gefunden.',
         unknownRoom: 'Unbekannt'
       },
       status: {
         pending: 'Geplant',
         approved: 'Genehmigt'
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
      occupied: 'Zeitfenster bereits genehmigt',
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
    bookingForm: {
      newBooking: 'Neue Buchung',
      close: 'Schließen',
      selectRoom: 'Raum',
      date: 'Datum',
      nameTitle: 'Name / Titel der Buchung',
      namePlaceholder: 'z.B. Team Meeting',
      description: 'Beschreibung',
      descriptionPlaceholder: 'Optionale Beschreibung der Buchung...',
      from: 'Von',
      to: 'Bis',
      addParticipants: 'Teilnehmer hinzufügen',
      searchPlaceholder: 'Name suchen...',
      noResults: 'Keine Ergebnisse',
      selected: 'Ausgewählt:',
      book: 'Buchen',
      loginFirst: 'Bitte zuerst einloggen.',
      loadUsersError: 'Fehler beim Laden der Benutzer',
      fillAllFields: 'Bitte alle erforderlichen Felder ausfüllen.',
      endTimeError: 'Endzeit muss nach der Startzeit liegen.',
      saved: 'Anfrage gesendet. Wartet auf Genehmigung.',
      occupied: 'Zeitfenster bereits genehmigt'
    },
    admin: {
      title: 'Admin Dashboard',
      subtitle: 'Verwaltung von Räumen und Ressourcen',
      accessRestricted: 'Zugriff beschränkt',
      loginRequiredText: 'Du musst eingeloggt sein, um Räume zu verwalten.',
      toLogin: 'Zum Login',
      createRoom: 'Neuen Raum anlegen',
      createRoomDesc: 'Erfasse die Details für einen neuen Raum.',
      assignApproversTitle: 'Genehmiger zu Räumen zuweisen',
      assignApproversDesc: 'Lege fest, welche Genehmiger Buchungen pro Raum prüfen dürfen.',
      selectRoom: 'Raum auswählen',
      approverUsers: 'Genehmiger',
      saveAssignments: 'Zuweisungen speichern',
      savingAssignments: 'Speichern...',
      assignSuccess: 'Genehmiger-Zuweisungen gespeichert.',
      noApproversFound: 'Es wurden keine Benutzer mit Genehmigerrolle gefunden.',
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
         capacity: 'z.B. 8',
         selectRoom: '-- Raum wählen --'
      },
      success: 'Raum erfolgreich angelegt',
      error: {
        required: 'Bezeichnung ist erforderlich.',
        locationRequired: 'Standort ist erforderlich.',
        capacity: 'Kapazität muss > 0 sein.',
        noAdmin: 'Keine Admin-Berechtigung.',
        saveRoom: 'Fehler beim Anlegen des Raums.',
        loadRooms: 'Fehler beim Laden der Räume.',
        loadApprovers: 'Fehler beim Laden der Genehmiger.',
        loadAssignments: 'Fehler beim Laden der Raumzuweisungen.',
        saveAssignments: 'Fehler beim Speichern der Raumzuweisungen.',
        selectRoom: 'Bitte zuerst einen Raum auswählen.'
      }
    },
    approvals: {
      title: 'Genehmigungen',
      subtitle: 'Offene Buchungsanfragen für Ihre zugewiesenen Räume.',
      noPermission: 'Keine Berechtigung',
      approverOnly: 'Dieser Bereich ist nur für Benutzer mit Genehmigerrolle verfügbar.',
      loading: 'Lädt...',
      refresh: 'Neu laden',
      empty: 'Aktuell gibt es keine offenen Genehmigungsanfragen.',
      untitled: 'Ohne Titel',
      room: 'Raum',
      bookingName: 'Buchung',
      requester: 'Angefragt von',
      date: 'Datum',
      actions: 'Aktionen',
      time: 'Zeit',
      statusLabel: 'Status',
      description: 'Beschreibung',
      close: 'Schließen',
      participants: 'Teilnehmer',
      noParticipants: 'Keine Teilnehmer vorhanden.',
      approve: 'Genehmigen',
      reject: 'Ablehnen',
      filters: {
        room: 'Raum filtern',
        date: 'Datum filtern',
        allRooms: 'Alle Räume',
        clear: 'Filter zurücksetzen'
      },
      status: {
        pending: 'Geplant'
      },
      success: {
        approved: 'Anfrage wurde genehmigt.',
        rejected: 'Anfrage wurde abgelehnt.'
      },
      error: {
        load: 'Fehler beim Laden der Genehmigungen.',
        decide: 'Fehler beim Verarbeiten der Entscheidung.'
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
      light: 'Hell',
      dark: 'Dunkel',
      highContrast: 'Hoher Kontrast '
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
    },
    wiki: {
      title: 'Wiki & Dokumentation',
      subtitle: 'Anleitungen und Tutorials',
      topics: {
        booking: 'Raum buchen / How to',
        calendar: 'Kalender nutzen',
        admin: 'Administration',
        faq: 'Häufige Fragen'
      },
      faqCategories: {
         general: 'Allgemein',
         booking: 'Buchung & Stornierung',
         account: 'Konto & Sicherheit'
      },
      faqItems: [
        { cat: 'account', q: 'Wie kann ich mein Passwort ändern?', a: 'Wenden Sie sich bitte an den Administrator, da die Benutzerverwaltung zentral gesteuert wird.' },
        { cat: 'booking', q: 'Kann ich eine Buchung stornieren?', a: 'Ja, klicken Sie im Kalender auf Ihre Buchung und wählen Sie "Löschen". Dies ist nur für eigene Buchungen möglich.' },
        { cat: 'general', q: 'Wer sieht meine Buchungen?', a: 'Alle Mitarbeiter können sehen, dass ein Raum belegt ist. Die Details sind für alle sichtbar.' },
        { cat: 'booking', q: 'Wie lange im Voraus kann ich buchen?', a: 'Raumbuchungen sind bis zu 6 Monate im Voraus möglich.' },
        { cat: 'general', q: 'Was passiert bei Doppelbelegungen?', a: 'Das System verhinder automatisch Doppelbelegungen. Sie erhalten eine Fehlermeldung.' }
      ],
      placeholders: {
        text: 'Lorem ipsum content for instruction text...',
        video: 'Video Tutorial Placeholder',
        image: 'Image Placeholder'
      }
    }
  },
  en: {
    nav: {
      brand: 'AGORA',
      dashboard: 'Dashboard',
      booking: 'Booking',
      calendar: 'Calendar',
      approvals: 'Approvals',
      admin: 'Admin',
      wiki: 'Wiki',
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
         myCalendar: 'My Calendar',
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
         status: 'Status',
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
         status: 'Status',
         title: 'Title / Participants',
         empty: 'No bookings found.',
         unknownRoom: 'Unknown'
       },
       status: {
         pending: 'Planned',
         approved: 'Approved'
       }
    },
    bookingForm: {
      newBooking: 'New Booking',
      close: 'Close',
      selectRoom: 'Room',
      date: 'Date',
      nameTitle: 'Name / Title of Booking',
      namePlaceholder: 'e.g. Team Meeting',
      description: 'Description',
      descriptionPlaceholder: 'Optional description...',
      from: 'From',
      to: 'To',
      addParticipants: 'Add Participants',
      searchPlaceholder: 'Search name...',
      noResults: 'No results',
      selected: 'Selected:',
      book: 'Book',
      loginFirst: 'Please log in first.',
      loadUsersError: 'Error loading users',
      fillAllFields: 'Please fill all required fields.',
      endTimeError: 'End time must be after start time.',
      saved: 'Request sent. Waiting for approval.',
      occupied: 'Time slot already approved'
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
      occupied: 'Time slot already approved',
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
      assignApproversTitle: 'Assign Approvers to Rooms',
      assignApproversDesc: 'Define which approvers can review bookings for each room.',
      selectRoom: 'Select Room',
      approverUsers: 'Approvers',
      saveAssignments: 'Save Assignments',
      savingAssignments: 'Saving...',
      assignSuccess: 'Approver assignments saved.',
      noApproversFound: 'No users with approver role found.',
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
         capacity: 'e.g. 8',
         selectRoom: '-- Select Room --'
      },
      success: 'Room created successfully',
      error: {
        required: 'Designation is required.',
        locationRequired: 'Location is required.',
        capacity: 'Capacity must be > 0.',
        noAdmin: 'No Admin permissions.',
        saveRoom: 'Error creating room.',
        loadRooms: 'Error loading rooms.',
        loadApprovers: 'Error loading approvers.',
        loadAssignments: 'Error loading room assignments.',
        saveAssignments: 'Error saving room assignments.',
        selectRoom: 'Please select a room first.'
      }
    },
    approvals: {
      title: 'Approvals',
      subtitle: 'Open booking requests for your assigned rooms.',
      noPermission: 'No Permission',
      approverOnly: 'This area is only available for users with approver role.',
      loading: 'Loading...',
      refresh: 'Refresh',
      empty: 'There are currently no open approval requests.',
      untitled: 'Untitled',
      room: 'Room',
      bookingName: 'Booking',
      requester: 'Requested by',
      date: 'Date',
      actions: 'Actions',
      time: 'Time',
      statusLabel: 'Status',
      description: 'Description',
      close: 'Close',
      participants: 'Participants',
      noParticipants: 'No participants provided.',
      approve: 'Approve',
      reject: 'Reject',
      filters: {
        room: 'Filter by room',
        date: 'Filter by date',
        allRooms: 'All rooms',
        clear: 'Clear filters'
      },
      status: {
        pending: 'Planned'
      },
      success: {
        approved: 'Request approved.',
        rejected: 'Request rejected.'
      },
      error: {
        load: 'Error loading approvals.',
        decide: 'Error processing decision.'
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
      light: 'Light',
      dark: 'Dark',
      highContrast: 'High Contrast'
    },
    lang: {
      toggle: 'Switch to German'
    },
    common: {
      cancel: 'Cancel',
      save: 'Save',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success'    },
    wiki: {
      title: 'Wiki & Documentation',
      subtitle: 'Guides and Tutorials',
      topics: {
        booking: 'How to Book',
        calendar: 'Using the Calendar',
        admin: 'Admin Guide',
        faq: 'FAQ'
      },
      faqCategories: {
         general: 'General',
         booking: 'Booking & Cancellation',
         account: 'Account & Security'
      },
      faqItems: [
          { cat: 'account', q: 'How can I change my password?', a: 'Please contact the administrator as user management is centrally controlled.' },
          { cat: 'booking', q: 'Can I cancel a booking?', a: 'Yes, click on your booking in the calendar and select "Delete". This is only possible for your own bookings.' },
          { cat: 'general', q: 'Who can see my bookings?', a: 'All employees can see that a room is occupied. The details are visible to everyone.' },
          { cat: 'booking', q: 'How far in advance can I book?', a: 'Room bookings are possible up to 6 months in advance.' },
          { cat: 'general', q: 'What happens with double bookings?', a: 'The system automatically prevents double bookings. You will receive an error message.' }
      ],
      placeholders: {
        text: 'Lorem ipsum content for instruction text...',
        video: 'Video Tutorial Placeholder',
        image: 'Image Placeholder'
      }    }
  }
}

export const SUPPORTED_LOCALES = ['de', 'en']

const i18n = createI18n({
  legacy: false, // use Composition API
  locale: 'de',
  fallbackLocale: 'de',
  globalInjection: true,
  messages
})

export default i18n
