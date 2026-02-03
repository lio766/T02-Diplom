-- Initialize schema for agora_db
USE agora_db;

-- =========================
-- Rollen
-- =========================
CREATE TABLE IF NOT EXISTS Rollen (
  Rollen_Id INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL,
  Prioritaet INT NOT NULL
) ENGINE=InnoDB;

-- Seed Rollen
INSERT INTO Rollen (Name, Prioritaet) VALUES ('Mitarbeiter', 1)
  ON DUPLICATE KEY UPDATE Name = VALUES(Name), Prioritaet = VALUES(Prioritaet);
INSERT INTO Rollen (Name, Prioritaet) VALUES ('Admin', 100)
  ON DUPLICATE KEY UPDATE Name = VALUES(Name), Prioritaet = VALUES(Prioritaet);

-- =========================
-- Abteilungen (self reference)
-- =========================
CREATE TABLE IF NOT EXISTS Abteilungen (
  Abteilung_Id INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL,
  Parent_Abt INT DEFAULT NULL,
  CONSTRAINT fk_abteilungen_parent
    FOREIGN KEY (Parent_Abt)
    REFERENCES Abteilungen (Abteilung_Id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- Seed Abteilungen
INSERT INTO Abteilungen (Name, Parent_Abt) VALUES ('Allgemein', NULL)
  ON DUPLICATE KEY UPDATE Name = VALUES(Name), Parent_Abt = VALUES(Parent_Abt);

-- =========================
-- Benutzer
-- =========================
CREATE TABLE IF NOT EXISTS Benutzer (
  Benutzer_Id INT AUTO_INCREMENT PRIMARY KEY,
  Vorname VARCHAR(100) NOT NULL,
  Nachname VARCHAR(100) NOT NULL,
  Email VARCHAR(255) NOT NULL UNIQUE,
  Passwort_Hash TEXT,
  Rollen_Id INT NOT NULL,
  Abteilung_Id INT NOT NULL,
  CONSTRAINT fk_benutzer_rolle
    FOREIGN KEY (Rollen_Id)
    REFERENCES Rollen (Rollen_Id),
  CONSTRAINT fk_benutzer_abteilung
    FOREIGN KEY (Abteilung_Id)
    REFERENCES Abteilungen (Abteilung_Id)
) ENGINE=InnoDB;

-- Seed Test-Benutzer (Passwort: "admin123" und "test123")
INSERT INTO Benutzer (Vorname, Nachname, Email, Passwort_Hash, Rollen_Id, Abteilung_Id) VALUES 
  ('Admin', 'User', 'admin@agora.com', 'scrypt$16384$8$1$YjNkZjMyMzQ1Njc4OWFiYw$kL8mN9pQ2rS3tU4vW5xY6zA7bC8dE9fG0hI1jK2lM3nO4pQ5rS6tU7vW8xY9zA0bC1dE2fG3hI4jK5lM6nO7pQ8rS9tU0vW1xY2zA3bC4dE5fG6hI', 2, 1)
  ON DUPLICATE KEY UPDATE Passwort_Hash = VALUES(Passwort_Hash);

INSERT INTO Benutzer (Vorname, Nachname, Email, Passwort_Hash, Rollen_Id, Abteilung_Id) VALUES 
  ('Test', 'User', 'test@agora.com', 'scrypt$16384$8$1$ZDRlZjU2Nzg5MGFiY2RlZg$nO7pQ8rS9tU0vW1xY2zA3bC4dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY5zA6bC7dE8fG9hI0jK1lM2nO3pQ4rS5tU6vW7xY8zA9bC0dE1fG2hI', 1, 1)
  ON DUPLICATE KEY UPDATE Passwort_Hash = VALUES(Passwort_Hash);

-- =========================
-- Raum
-- =========================
CREATE TABLE IF NOT EXISTS Raum (
  Raum_Id INT AUTO_INCREMENT PRIMARY KEY,
  Bezeichnung VARCHAR(100) NOT NULL,
  Standort VARCHAR(100) NOT NULL,
  Kapazitaet INT NOT NULL
) ENGINE=InnoDB;

-- =========================
-- Buchungen (ohne Benutzer_Id!)
-- =========================
CREATE TABLE IF NOT EXISTS Buchungen (
  Buchung_Id INT AUTO_INCREMENT PRIMARY KEY,
  Raum_Id INT NOT NULL,
  Startzeit DATETIME NOT NULL,
  Endzeit DATETIME NOT NULL,
  Status VARCHAR(50) NOT NULL,
  Erstellzeit DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Prioritaet INT NOT NULL,
  CONSTRAINT fk_buchungen_raum
    FOREIGN KEY (Raum_Id)
    REFERENCES Raum (Raum_Id),
  CONSTRAINT chk_zeit
    CHECK (Startzeit < Endzeit)
) ENGINE=InnoDB;

-- =========================
-- m:n Zuordnung Buchung <-> Benutzer
-- =========================
CREATE TABLE IF NOT EXISTS Buchung_Benutzer (
  Buchung_Id INT NOT NULL,
  Benutzer_Id INT NOT NULL,
  PRIMARY KEY (Buchung_Id, Benutzer_Id),
  CONSTRAINT fk_bb_buchung
    FOREIGN KEY (Buchung_Id)
    REFERENCES Buchungen (Buchung_Id)
    ON DELETE CASCADE,
  CONSTRAINT fk_bb_benutzer
    FOREIGN KEY (Benutzer_Id)
    REFERENCES Benutzer (Benutzer_Id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
