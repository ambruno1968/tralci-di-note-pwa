# Tralci di note – PWA per Chromebook / Chrome

App web installabile (PWA), identica alla versione PC: funziona offline, dati nel browser,
sincronizzazione opzionale con Google Drive. **Non serve modalità sviluppatore né file da installare.**

## Come funziona
- `docs/` = l'app pronta (generata da `build-pwa.js`; non modificarla a mano).
- Sorgenti condivisi con il PC: `app.js`, `styles.css`, logo, guida. Dopo ogni modifica al progetto PC:
  `node build-pwa.js` e ripubblica `docs/`.
- Motore dati senza server: `localDbEngine.js` (dal progetto Android). Stampa/PDF, condivisione,
  login Google sono forniti da `src-pwa/pwa.js`.

## 1) Pubblicazione (una volta sola) – GitHub Pages, gratis, HTTPS
1. Crea un repository **privato o pubblico** (es. `tralci-di-note-pwa`) con il contenuto di questa cartella.
   La PWA non contiene dati dell'archivio né client secret.
2. Su GitHub: *Settings → Pages → Branch: `main`, folder: `/docs`*.
3. L'indirizzo sarà `https://<utente>.github.io/tralci-di-note-pwa/`.

## 2) Login Google (una volta sola, Google Cloud Console)
Progetto del Client ID già usato dall'app → *API e servizi → Credenziali → il Client ID OAuth*:
- **Origini JavaScript autorizzate**: aggiungi `https://<utente>.github.io` (e `http://localhost:8080` per i test).
- Il tipo del client deve essere **Applicazione web**. Se è "Desktop", crea un nuovo Client ID Web e sostituisci
  `CLIENT_ID` in `src-pwa/pwa.js` e `BUNDLED_CLIENT_ID` in `driveClient.js` (Android), poi `node build-pwa.js`.
- Schermata consenso OAuth: aggiungi il tuo account Google come utente di prova (se l'app è in "Test").

## 3) Installazione sul Chromebook (30 secondi)
1. Apri Chrome e vai all'indirizzo della PWA.
2. Clicca l'icona **Installa** nella barra degli indirizzi (o il pulsante blu **📲 Installa app**),
   oppure menu ⋮ → *Trasmetti, salva e condividi → Installa pagina come app*.
3. L'app compare nel lanciatore come "Tralci di note", in finestra propria.
4. Primo avvio: **Impostazioni → Accedi a Google** per scaricare il tuo archivio da Drive
   (oppure *Impostazioni → Ripristina backup* da un file `.json` esportato dal PC).

> Il login Google dura 1 ora; l'app lo rinnova da sola finché sei collegato a Google nel browser.
> Se compare "Sessione scaduta", premi di nuovo **Accedi a Google**.

## Prova sul PC
Doppio clic su `Prova PWA in locale.bat` → http://localhost:8080 (installabile anche da lì).

## IWA (Isolated Web App)?
Valutata e **scartata**: richiede un pacchetto firmato (.swbn) e l'installazione tramite policy
amministrativa/modalità sviluppatore su ChromeOS (o app store scolastico). Per un Chromebook
personale/scolastico la PWA dà lo stesso risultato con un clic.

## Limiti attuali
- Il motore dati è quello Android: alcune logiche aggiornate del PC lato server
  (es. generazione orario settimanale di default) vanno allineate nel passaggio Android.
- Stampa: apre il dialogo di Chrome → scegli *Salva come PDF*.

