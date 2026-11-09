# 📚 Wiki Ufficiale — Tralci di note

> **Gestionale Scuola di Musica per Come Tralci - Novara**  
> *Chiesa Evangelica Pentecostale e Missionaria Come Tralci - Novara*  
> *Sviluppato da Bruno Astemio con Antigravity*  
> Versione documentata: **v2.0**

---

## 📑 Indice dei Contenuti
1. [Panoramica e Filosofia del Software](#-panoramica-e-filosofia-del-software)
2. [Architettura e Stack Tecnologico](#-architettura-e-stack-tecnologico)
3. [Guida all'Installazione e Avvio](#-guida-allinstallazione-e-avvio)
4. [Manuale d'Uso dei Moduli](#-manuale-duso-dei-moduli)
   - [4.0 Dashboard Statistiche & Panoramica](#40-dashboard-statistiche--panoramica)
   - [4.1 Anagrafica Studenti](#41-anagrafica-studenti)
   - [4.2 Registro Presenze e Calendario](#42-registro-presenze-e-calendario)
   - [4.3 Pagamenti Rette e Ricevute](#43-pagamenti-rette-e-ricevute)
   - [4.4 Modulo Docenti e Liquidazioni](#44-modulo-docenti-e-liquidazioni)
   - [4.5 Prima Nota Cassa e Banca](#45-prima-nota-cassa-e-banca)
   - [4.6 Sincronizzazione Cloud Google Drive](#46-sincronizzazione-cloud-google-drive)
   - [4.7 Impostazioni di Sistema e Configurazione](#47-impostazioni-di-sistema-e-configurazione)
5. [Modello Dati e Persistenza](#-modello-dati-e-persistenza)
6. [Sicurezza, Backup e Ripristino](#-sicurezza-backup-e-ripristino)
7. [Guida per lo Sviluppatore & Creazione Installer](#-guida-per-lo-sviluppatore--creazione-installer)
8. [FAQ e Risoluzione dei Problemi](#-faq-e-risoluzione-dei-problemi)

---

## 🌟 Panoramica e Filosofia del Software

**Tralci di Note** è un gestionale monolitico leggero, progettato specificamente per le esigenze didattiche, amministrative e contabili della scuola di musica interna della comunità *Come Tralci - Novara*.

### Principi Guida:
- **Zero Dipendenze Runtime Esterne**: Il server locale opera esclusivamente con i moduli standard nativi di Node.js (`http`, `fs`, `path`, `crypto`, `tls`, `net`), garantendo stabilità a lungo termine, avvio istantaneo e nessuna vulnerabilità legata a pacchetti npm obsoleti.
- **Portabilità e Indipendenza dal Cloud**: Funziona al 100% offline su file locale `db.json`, con sincronizzazione opzionale su Google Drive per la condivisione tra più postazioni.
- **Doppia Modalità d'Uso**: Disponibile come applicazione Windows nativa installata (`.exe` confezionato con Electron) o come server locale leggero utilizzabile da qualsiasi browser web.
- **Precisione Amministrativa Italiana**: Generazione di ricevute numerate annualmente con conversione automatica dell'importo in lettere (es. `Sessanta/00`), calcolo automatico ritenute e prospetti liquidazioni.

---

## 🏗️ Architettura e Stack Tecnologico

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TRALCI DI NOTE (Desktop / Web)                      │
├───────────────────────────────────┬────────────────────────────────────┤
│         FRONTEND (Client)         │          BACKEND (Server)          │
│  - Vanilla HTML5 / CSS3 / ES6     │  - Node.js Built-in HTTP Server    │
│  - Single Page Application (SPA)  │  - Motore Crittografico & TLS      │
│  - Hash Router (#studenti, ecc.)  │  - Mailer SMTP Nativo              │
│  - Zero Framework (No React/Vue)  │  - Google Drive REST API Client    │
│  - Dialog Modali & Toast Nativo   │  - JSON Storage Atomico            │
├───────────────────────────────────┴────────────────────────────────────┤
│                       CONTAINER ELECTRON                               │
│  - Single Instance Lock (istanza singola)                              │
│  - Gestione Finestra e Menu Nativo Windows                             │
│  - Storage persistente in %APPDATA%\Tralci di Note\data                │
└────────────────────────────────────────────────────────────────────────┘
```

### Struttura Directory del Progetto:
```
Scuola di musica/
├── assets/                  # Icone e loghi ad alta risoluzione (.ico, .png)
├── data/                    # Database locale (db.json) e archivio backup
│   ├── backup/              # Copie di sicurezza giornaliere e pre-cloud
│   ├── changelog.json       # Storico versioni mostrato in Impostazioni
│   └── google-config.json   # Configurazione client Google Drive OAuth
├── dist/                    # Pacchetti installer Windows generati
├── lib/                     # Moduli logici server (zero dipendenze npm)
│   ├── cashbook.js          # Motore Prima Nota e stampa registri contabili
│   ├── googleDrive.js       # Client OAuth2 e sincronizzazione Google Drive API v3
│   ├── mailer.js            # Client SMTP nativo (TLS/STARTTLS/MIME/Allegati)
│   ├── receipt.js           # Generatore ricevute allievi e importo in lettere
│   ├── sheet.js             # Generatore fogli presenze orizzontali A4
│   └── teacherReceipt.js    # Generatore prospetti liquidazioni e fatture
├── public/                  # Interfaccia grafica SPA servita dal server
│   ├── app.js               # Logica applicativa frontend
│   ├── index.html           # Struttura principale
│   ├── styles.css           # Foglio di stile responsive con variabili CSS
│   └── logo.png / icon.png  # Risorse grafiche
├── scripts/
│   └── build-installer.js   # Script di packaging isolato su disco C:
├── Avvia gestionale.bat     # Launcher rapido modalità browser
├── Crea Installer.bat       # Launcher compilazione installer Windows
├── main.js                  # Entrypoint Electron Desktop
├── package.json             # Metadati e script di build
├── README.md                # Guida rapida
├── seed.js                  # Importatore dati iniziale
├── server.js                # Server HTTP, API REST e gestione DB
└── WIKI.md                  # Documentazione completa (questo documento)
```

---

## 🚀 Guida all'Installazione e Avvio

### Modalità 1: Applicazione Desktop Windows (Consigliata)
Non richiede Node.js né conoscenze tecniche:
1. Esegui il file `dist/Tralci di Note Setup 1.3.2.exe`.
2. Segui le istruzioni guidate per scegliere la cartella di installazione.
3. Al termine, verrà creata l'icona sul Desktop e nel menu Start.
4. I dati utente vengono conservati in:
   `%APPDATA%\Tralci di Note\data\db.json`

### Modalità 2: Modalità Locale / Browser Web
Ideale per sviluppo o esecuzione su server locale:
1. Fai doppio clic su `Avvia gestionale.bat` (oppure da terminale: `npm start`).
2. Si aprirà una finestra browser all'indirizzo:
   `http://localhost:3000`

---

## 📖 Manuale d'Uso dei Moduli

### 4.0 Dashboard Statistiche & Panoramica
- **Cruscotto Generale**: Schermata iniziale che riassume la situazione scolastica e finanziaria in tempo reale.
- **Entrate e Uscite Totali**: KPI card con Entrate complessive (rette allievi ed entrate extra), Uscite totali (liquidazioni maestre e spese generali) e Saldo/Utile netto con indicatore di gestione in attivo.
- **Filtro Periodo**: Visualizzazione dati per *Anno Scolastico*, *Mese Corrente* o *Tutto lo Storico*.
- **Età dei Partecipanti**:
  - Calcolo automatico in tempo reale dell'età anagrafica dalla data di nascita;
  - Visualizzazione dell'Età Media della scuola, dell'allievo più giovane e di quello più grande;
  - Grafico a barre orizzontali per fasce d'età (*Bambini <11a*, *Ragazzi 11-14a*, *Adolescenti 15-18a*, *Giovani Adulti 19-25a*, *Adulti >25a*) con chip interattivi per visualizzare e modificare direttamente i partecipanti;
  - Avviso intelligente per allievi con data di nascita mancante con scorciatoia di compilazione rapida.
- **Suddivisione Strumenti & Corsi**:
  - Conteggio allievi per strumento (Canto, Chitarra, Basso, Piano, ecc.);
  - Percentuale di iscritti sul totale e volume economico mensile generato per ciascun corso;
  - Barre visive comparative e chip con elenco degli allievi.
- **Rette del Mese Corrente**: Percentuale di riscossione in tempo reale con avviso immediato per gli allievi non ancora in regola e pulsante `💶 Registra Incasso` a un clic.
- **Flusso Mensile**: Prospetto tabellare di entrate vs uscite e saldo mese per mese dell'anno scolastico.
- **Organizzazione Lezioni**: Sintesi degli allievi distribuiti per giorno della settimana (Venerdì, Sabato, ecc.) e monitoraggio lezioni di recupero.
- **Stampa Report**: Pulsante `🖨️ Stampa Report` per ottenere una versione cartacea pulita o esportare in PDF.

### 4.1 Anagrafica Studenti
- **Visualizzazione**: Tabella con filtri per nome/cognome, strumento, giorno di lezione, età e stato (Attivo/Non attivo).
- **Nuovo Allievo**: Clicca su `➕ Nuovo Studente` e compila:
  - Nome e Cognome dell'allievo;
  - **Data di nascita**: Con calcolo e anteprima istantanea dell'età in anni (`🎂 Età: X anni`);
  - Strumento (selezionabile dall'elenco dinamico);
  - Giorno e Orario della lezione settimanale;
  - Intestatario della ricevuta (es. genitore per allievi minorenni);
  - Email e Telefono (fondamentali per l'invio ricevute);
  - Quota retta personalizzata (predefinita a 60 €).
- **Stato**: Gli studenti possono essere disattivati senza perdere lo storico dei pagamenti passati.

### 4.2 Registro Presenze e Calendario
- **Calendario Mensile Dinamico**: Mostra automaticamente i giorni del mese corrispondenti ai corsi attivi, evidenziando le chiusure/festività.
- **Stati di Presenza**:
  - `P` (Verde): **Presente**
  - `A` (Rosso): **Assente**
  - `G` (Arancione): **Assenza da recuperare** (comunicata per tempo dall'allievo)
  - `R` (Viola): **Lezione da recuperare** (assenza del maestro)
  - `REC` (Azzurro): **Lezione di recupero svolta**
- **Segnatura Rapida**: Clic su una cella per alternare lo stato; possibilità di segnare tutti i presenti della giornata con un solo clic.
- **Gestione Recuperi**: Finestra dedicata per pianificare data e orario di recupero per ciascun allievo.
- **Stampa Foglio Presenze Mensile**: Genera un prospetto PDF/stampa A4 orizzontale formattato, completo di calcolo saldi recuperi del mese e riporto dai mesi precedenti.
- **Prospetto Orario & Presenze Settimanale (Stampa A4)**: Generazione dedicata del foglio orario delle lezioni della settimana (pulsante `📋 Orario & Presenze Settimana`), integrando allievi di ruolo, recuperi e lezioni straordinarie.
- **Maschera Pre-Stampa Anti-Buchi**: Maschera interattiva per verificare e riorganizzare gli orari prima di stampare:
  - Cliccando su `⚡ Compatta orari` (giornaliero o settimanale), le lezioni confermate vengono accodate a intervalli continui di 45 minuti eliminando i buchi creati da assenze o ritardi;
  - Gli allievi segnati come `ASSENTE` liberano il loro orario e vengono evidenziati con cartiglio rosso dedicato;
  - Gli orari, le note, gli stati e l'ordine delle lezioni (`▲` / `▼`) possono essere modificati liberamente riga per riga;
  - Possibilità di aggiungere allievi straordinari (`➕ Aggiungi Allievo`) o ripristinare la pianificazione originaria da calendario.

### 4.3 Pagamenti Rette e Ricevute
- **Monitoraggio Rette**: Griglia con tutti i mesi dell'anno scolastico per ciascun allievo:
  - Verde: Retta pagata;
  - Grigio: Retta non ancora saldata;
  - Trattino: Allievo iscritto successivamente o periodo non attivo.
- **Registrazione Incasso**:
  - Clic sul mese desiderato per registrare il pagamento;
  - Assegnazione automatica del numero progressivo della ricevuta per l'anno in corso (es. `1/2026`, `2/2026`);
  - Conversione istantanea in lettere (es. `€ 60,00` → `Sessanta/00`);
  - Metodo di pagamento tracciato (Contanti, Bonifico, POS, ecc.);
  - Opzione per inviare subito la ricevuta via email con allegato HTML autonomo.
- **Sezione Ricevute**: Archivio storico consultabile, ricerca per intestatario o numero, anteprima grafica e ristampa.

### 4.4 Modulo Docenti e Liquidazioni
- **Anagrafica Docenti**: Dati anagrafici, codice fiscale, partita IVA, IBAN e percentuale compenso.
- **Liquidazione Rette Mensili**:
  - Riepilogo automatico delle rette allievi incassate per ciascun mese;
  - Calcolo del compenso spettante e quota scuola;
  - Emissione del **Prospetto di Liquidazione numerato**;
  - Tracciamento della fattura emessa dal docente (numero, data, importo, stato);
  - Collegamento automatico alla Prima Nota tra le uscite.

### 4.5 Prima Nota Cassa e Banca
- **Libro Giornale Unificato**:
  - **Entrate**: Incasso rette allievi (registrate automaticamente) + Entrate extra (quote associative, donazioni, saggi);
  - **Uscite**: Liquidazioni compensi docenti + Spese di gestione (affitto, utenze, cancelleria, spartiti, manutenzione);
- **Saldi Progressivi**: Calcolo istantaneo del saldo cassa e banca con totali parziali per periodo;
- **Stampa Prospetto Contabile**: Formato ufficiale stampabile per verifiche contabili e assemblee dell'associazione.

### 4.6 Sincronizzazione Cloud Google Drive
- **Funzionamento**: Memorizza il file `db.json` in una cartella dedicata su Google Drive (`Gestionale Scuola di Musica`).
- **Sincronizzazione Bidirezionale**:
  - **All'avvio**: Se il cloud contiene una versione più recente (es. modificata da un altro computer), scarica e aggiorna localmente dopo aver creato un backup di sicurezza;
  - **Durante l'uso**: Ogni salvataggio viene sincronizzato in background con debounce automatico (2,5 secondi);
  - **Pillola di Stato**: In testata è sempre visibile lo stato del collegamento e l'orario dell'ultimo allineamento.
- **Configurazione Facile & Portabilità tra PC**:
  - Rileva automaticamente i file `client_secret_*.json` e la configurazione `google-config.json`;
  - **Inclusione automatica nell'Installer**: Quando si crea il pacchetto `.exe` tramite `Crea Installer.bat`, il Client ID e il Client Secret vengono incorporati nell'installer senza includere i token di accesso personali;
  - **Avvio su un nuovo PC**: All'installazione su una nuova postazione, il gestionale precarica automaticamente gli ID Google, mostrando direttamente il pulsante **"🔑 Accedi con Google"** senza richiedere reinserimenti manuali di chiavi o codici.

### 4.7 Impostazioni di Sistema e Configurazione
- **Dati Associazione & Firmatari**: Denominazione (`Come Tralci - Novara`), indirizzo, CF/P.IVA, Nome e Cognome per la Segreteria (chiesa) e Nome e Cognome per il Maestro;
- **Anno Scolastico**: Date di inizio e fine anno (es. `2026-10-01` – `2027-06-30`);
- **Gestione Strumenti**: Possibilità di aggiungere, rinominare o eliminare strumenti (con aggiornamento a cascata sugli studenti);
- **Configurazione Email (SMTP)**: Server, porta (465 SSL o 587 STARTTLS), utente, password per le app e template dei messaggi;
- **Registro Versioni (Changelog)**: Cronologia interattiva integrata nel gestionale.

---

## 💾 Modello Dati e Persistenza

Tutti i dati sono strutturati in formato JSON all'interno di `data/db.json`:
- `students`: Array di oggetti allievo (`id`, `nome`, `cognome`, `strumento`, `giorno`, `orario`, `email`, `telefono`, `intestatario`, `retta`, `stato`, `dataIscrizione`);
- `payments`: Array delle ricevute rette (`id`, `studentId`, `mese`, `importo`, `data`, `metodo`, `numero`, `anno`, `emailInviata`, `note`);
- `attendance`: Mappa chiave-valore con formato `studentId|YYYY-MM-DD -> Valore` (`P`, `A`, `G`, `R`, `REC`);
- `recoveries`: Elenco lezioni di recupero programmate;
- `closures`: Date di chiusura e festività della scuola;
- `teachers`: Anagrafica insegnanti;
- `teacherPayments`: Prospetti di liquidazione compensi e dati fattura;
- `expenses`: Uscite varie della scuola;
- `incomeExtra`: Entrate extra scuola;
- `settings`: Parametri generali della scuola e configurazione email.

---

## 🛡️ Sicurezza, Backup e Ripristino

1. **Scrittura Atomica del Database**: Il salvataggio avviene prima su un file temporaneo (`db.json.tmp`) e poi tramite rinomina o scrittura protetta per prevenire corruzioni in caso di arresto anomalo.
2. **Backup Giornaliero Automatico**: Ad ogni avvio, viene creata una copia in `data/backup/db-[DATA].json`.
3. **Backup Preventivo Pre-Cloud**: Prima di qualsiasi sovrascrittura derivante da Google Drive, il sistema crea una copia `data/backup/db-pre-cloud-[TIMESTAMP].json`.
4. **Protezione Password SMTP**: Le password email non vengono mai restituite all'interfaccia web (viene mostrato solo il flag `hasPass: true`).

---

## 🛠️ Guida per lo Sviluppatore & Creazione Installer

### Prerequisiti:
- Node.js (versione 18 o superiore);
- Ambiente Windows per la generazione del pacchetto `.exe`.

### Comandi Disponibili:
- `npm start`: Avvia il server Node locale;
- `npm run electron`: Avvia l'applicazione desktop in modalità sviluppo;
- `npm run build:installer`: Compila l'installer Windows tramite script isolato su C:;
- Doppio clic su `Crea Installer.bat`: Compilazione rapida dell'installer con un clic.

### Note sulla Compilazione su Google Drive:
Poiché il progetto risiede sul virtual drive di Google Drive (`G:`), lo script `scripts/build-installer.js` clona temporaneamente i file in `%TEMP%\tralci-di-note-build` (disco C: NTFS), esegue `electron-builder` e riporta l'installer finale in `dist/`. Questo evita i classici errori di lock o permessi di Google Drive.

---

## ❓ FAQ e Risoluzione dei Problemi

#### 1. L'accesso a Google Drive segnala un errore di redirect URI
Verifica che nella schermata *Credenziali OAuth* di Google Cloud Console sia inserito come URI autorizzato:  
`http://localhost:3000/api/google/callback`

#### 2. L'invio delle email di ricevuta non funziona
Se utilizzi un account Gmail, Google richiede la creazione di una **Password per le app** (con autenticazione a 2 fattori attiva) da inserire nelle Impostazioni del gestionale al posto della password normale.

#### 3. Ho installato l'app con l'installer: dove sono i miei dati?
I dati dell'app installata si trovano in:  
`C:\Users\<TuoNome>\AppData\Roaming\ScuolaDiMusica\data\db.json`  
Puoi aprire direttamente la cartella dal menu dell'app: **File → Apri Cartella Dati Locale**.
