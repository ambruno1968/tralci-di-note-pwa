/* pwa.js - Strato PWA di "Tralci di note" per Chromebook / Chrome.
 * Fornisce, al posto del bridge nativo Android, le funzioni di stampa, condivisione,
 * salvataggio file e login Google (Google Identity Services) direttamente dal browser.
 * Tutti i dati restano nel browser (localStorage) e, se collegato, su Google Drive. */
(function () {
  'use strict';

  const CLIENT_ID = '1078975750372-qrvfio9nafjvqsmhhdtfdd8qjkteb187.apps.googleusercontent.com';
  const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' ');

  window.PWA_STANDALONE = true;

  // ---- Cache sincrona di WIKI.md (letta dalla Guida)
  const assetCache = {};
  fetch('WIKI.md').then(r => (r.ok ? r.text() : '')).then(t => { assetCache['WIKI.md'] = t; }).catch(() => {});

  // ---- Stile: nasconde il pulsante "Chiudi" (in una PWA si chiude dalla finestra)
  const st = document.createElement('style');
  st.textContent = '.btn-close-app{display:none!important}' +
    '#pwa-install{position:fixed;right:14px;bottom:80px;z-index:9999;background:#2563eb;color:#fff;border:0;' +
    'padding:10px 16px;border-radius:999px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}';
  document.head.appendChild(st);

  function toastMsg(msg, type) {
    const box = document.getElementById('toasts');
    if (!box) return alert(msg);
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    box.append(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ---- Stampa tramite iframe nascosto (nessun popup da sbloccare)
  function printHtml(html, title) {
    const old = document.getElementById('pwa-print-frame');
    if (old) old.remove();
    const fr = document.createElement('iframe');
    fr.id = 'pwa-print-frame';
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(fr);
    const doc = fr.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    if (title) { try { doc.title = String(title).replace(/_/g, ' '); } catch (_) {} }
    const go = () => {
      try { fr.contentWindow.focus(); fr.contentWindow.print(); }
      catch (e) { toastMsg('Stampa non riuscita: ' + e.message, 'err'); }
    };
    setTimeout(go, 400);
  }

  function saveFile(fileName, b64, mime) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toastMsg('File salvato in Download: ' + fileName);
  }

  // ---- Login Google (Google Identity Services, token model)
  let gisPromise = null;
  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new Error('Impossibile caricare Google Sign-In (connessione assente?)')); };
      document.head.appendChild(s);
    });
    return gisPromise;
  }

  function requestToken(prompt) {
    return loadGis().then(() => new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: resp => (resp && resp.access_token) ? resolve(resp) : reject(new Error((resp && (resp.error_description || resp.error)) || 'Accesso Google non riuscito')),
        error_callback: err => reject(new Error((err && (err.message || err.type)) || 'Accesso Google annullato'))
      });
      client.requestAccessToken({ prompt });
    }));
  }

  async function storeToken(resp, keepProfile) {
    const prev = window.gDriveClient.getTokenData() || {};
    const tokenData = {
      access_token: resp.access_token,
      expires_at: Date.now() + ((Number(resp.expires_in) || 3600) - 120) * 1000,
      token_type: resp.token_type || 'Bearer',
      scope: resp.scope,
      lastSync: prev.lastSync, lastSyncStatus: prev.lastSyncStatus,
      lastSyncAction: prev.lastSyncAction, lastSyncError: prev.lastSyncError
    };
    if (keepProfile) { tokenData.email = prev.email; tokenData.name = prev.name; tokenData.picture = prev.picture; }
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tokenData.access_token } });
      if (r.ok) { const u = await r.json(); tokenData.email = u.email; tokenData.name = u.name; tokenData.picture = u.picture; }
    } catch (_) {}
    window.gDriveClient.saveTokenData(tokenData);
    return tokenData;
  }

  async function signIn() {
    try {
      const resp = await requestToken('select_account');
      await storeToken(resp, false);
      try { await window.LocalDbEngine.handle('/api/google/sync', { method: 'POST', body: { direction: 'auto' } }); }
      catch (e) { console.warn('Sync iniziale:', e); }
      window.postMessage({ type: 'google-auth-success' }, '*');
    } catch (err) {
      window.postMessage({ type: 'google-auth-error', error: err.message || String(err) }, '*');
    }
  }

  async function silentRefresh() {
    try {
      const resp = await requestToken('');
      const t = await storeToken(resp, true);
      return t.access_token;
    } catch (e) {
      throw new Error('Sessione Google scaduta. Premi "Accedi a Google" per ricollegare l\'account.');
    }
  }

  window.PwaGoogle = { signIn, silentRefresh };

  // ---- Bridge compatibile con l'app (stesso contratto della versione Android)
  window.Android = {
    printHtml,
    printCurrentPage: () => window.print(),
    saveFile,
    shareText: (title, body) => {
      if (navigator.share) navigator.share({ title, text: body }).catch(() => {});
      else navigator.clipboard?.writeText(title + '\n' + body).then(() => toastMsg('Testo copiato negli appunti'));
    },
    sendEmail: (to, subject, body) => {
      location.href = 'mailto:' + encodeURIComponent(to || '') + '?subject=' + encodeURIComponent(subject || '') + '&body=' + encodeURIComponent(body || '');
    },
    readAssetFile: name => assetCache[name] || '',
    startGoogleOAuth: () => { signIn(); },
    closeApp: () => { try { window.close(); } catch (_) {} }
  };

  // ---- Service worker + pulsante "Installa"
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e)));
  }
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    if (document.getElementById('pwa-install')) return;
    const b = document.createElement('button');
    b.id = 'pwa-install';
    b.textContent = '📲 Installa app';
    b.onclick = async () => { b.remove(); deferred.prompt(); await deferred.userChoice; deferred = null; };
    document.body.appendChild(b);
  });
  window.addEventListener('appinstalled', () => { document.getElementById('pwa-install')?.remove(); });
})();
