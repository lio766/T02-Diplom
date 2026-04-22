-- Initialize schema for agora_db
USE agora_db;

-- =========================
-- Rollen
-- =========================
CREATE TABLE IF NOT EXISTS Rollen (
  Rollen_Id INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

-- Seed Rollen
INSERT INTO Rollen (Name) VALUES ('Mitarbeiter')
  ON DUPLICATE KEY UPDATE Name = VALUES(Name);
INSERT INTO Rollen (Name) VALUES ('Genehmiger')
  ON DUPLICATE KEY UPDATE Name = VALUES(Name);
INSERT INTO Rollen (Name) VALUES ('Adminstrator')
  ON DUPLICATE KEY UPDATE Name = VALUES(Name);


-- =========================
-- Benutzer
-- =========================
CREATE TABLE IF NOT EXISTS Benutzer (
  Benutzer_Id INT AUTO_INCREMENT PRIMARY KEY,
  Keycloak_Id VARCHAR(38) NOT NULL,
  Vorname VARCHAR(100) NOT NULL,
  Nachname VARCHAR(100) NOT NULL,
  Email VARCHAR(255) NOT NULL UNIQUE,
  Rollen_Id INT NOT NULL,
  CONSTRAINT fk_benutzer_rolle
    FOREIGN KEY (Rollen_Id)
    REFERENCES Rollen (Rollen_Id)
) ENGINE=InnoDB;

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
-- Buchungen
-- =========================
CREATE TABLE IF NOT EXISTS Buchungen (
  Buchung_Id INT AUTO_INCREMENT PRIMARY KEY,
  Raum_Id INT NOT NULL,
  Benutzer_Id INT,
  Startzeit DATETIME NOT NULL,
  Endzeit DATETIME NOT NULL,
  Status VARCHAR(50) NOT NULL,
  Reminder_Sent_At DATETIME NULL,
  Erstellzeit DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Name VARCHAR(255) NOT NULL,
  Beschreibung TEXT,
  istGenehmigt TINYINT(1),
  CONSTRAINT fk_buchungen_raum
    FOREIGN KEY (Raum_Id)
    REFERENCES Raum (Raum_Id),
  CONSTRAINT fk_buchungen_benutzer
    FOREIGN KEY (Benutzer_Id)
    REFERENCES Benutzer (Benutzer_Id),
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

CREATE TABLE IF NOT EXISTS Genehmiger_Raum (
  Raum_Id INT NOT NULL,
  Benutzer_Id INT NOT NULL,
  PRIMARY KEY (Raum_Id, Benutzer_Id),
  CONSTRAINT fk_gr_raum
    FOREIGN KEY (Raum_Id)
    REFERENCES Raum (Raum_Id)
    ON DELETE CASCADE,
  CONSTRAINT fk_gr_benutzer
    FOREIGN KEY (Benutzer_Id)
    REFERENCES Benutzer (Benutzer_Id)
    ON DELETE CASCADE
) ENGINE=InnoDB;