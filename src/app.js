'use strict';
/* Tralci di Note — Come Tralci - Novara
 * Sviluppato da Bruno Astemio con Antigravity per Come Tralci - Novara
 */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const WD = { 'Domenica': 0, 'Lunedì': 1, 'Martedì': 2, 'Mercoledì': 3, 'Giovedì': 4, 'Venerdì': 5, 'Sabato': 6 };
const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const STRUMENTI_DEFAULT = ['Canto', 'Basso', 'Piano', 'Chitarra'];
const getStrumenti = () => (Array.isArray(S?.settings?.strumenti) && S.settings.strumenti.length ? S.settings.strumenti : STRUMENTI_DEFAULT);
const METODI = ['Contanti', 'Bonifico bancario', 'POS / Carta', 'Satispay', 'Assegno', 'Altro'];
const SPESE_CAT = ['Materiale didattico', 'Affitto / Utenze', 'Cancelleria e stampe', 'Manutenzione strumenti', 'SIAE / Diritti', 'Spese bancarie', 'Varie'];
const ENTRATE_CAT = ['Quota iscrizione annuale', 'Saggio / Concerto', 'Donazione / Contributo', 'Rimborso', 'Varie'];
const APP_VERSION = '3.0';
const PRES = {
  P: { label: 'Presente', cls: 'p' },
  A: { label: 'Assente', cls: 'a' },
  G: { label: 'Assenza da recuperare', cls: 'g' },
  R: { label: 'Lezione da recuperare (assenza maestro)', cls: 'r' },
  REC: { label: 'Lezione di recupero', cls: 'rec' },
};
const NEXT = { '': 'P', P: 'A', A: 'G', G: 'R', R: '', REC: '' };

// ---------------------------------------------------------------- utilità
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euro = n => '€ ' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const meseLabel = ym => { if (!ym || !ym.includes('-')) return ym || ''; const [y, m] = ym.split('-').map(Number); return `${MESI[m - 1]} ${y}`; };
const dataIt = d => (d ? d.split('-').reverse().join('/') : '');
const fullName = s => `${s.nome} ${s.cognome || ''}`.trim();

// Calcolo età allievo data la data di nascita (YYYY-MM-DD)
const calcAge = (birthDateStr, refDate = new Date()) => {
  if (!birthDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) return null;
  const [by, bm, bd] = birthDateStr.split('-').map(Number);
  const nowY = refDate.getFullYear();
  const nowM = refDate.getMonth() + 1;
  const nowD = refDate.getDate();
  let age = nowY - by;
  if (nowM < bm || (nowM === bm && nowD < bd)) {
    age--;
  }
  return age >= 0 ? age : null;
};

// --- Anno scolastico configurabile ---
const schoolYearRange = () => {
  const s = S?.settings?.annoScolasticoInizio || '2026-10-01';
  const e = S?.settings?.annoScolasticoFine || '2027-06-30';
  return { start: s, end: e };
};

// Genera tutti i mesi compresi tra inizio e fine anno scolastico
const getSchoolMonths = () => {
  const { start, end } = schoolYearRange();
  const [y1, m1] = start.split('-').map(Number);
  const [y2, m2] = end.split('-').map(Number);
  const list = [];
  let curY = y1, curM = m1;
  while (curY < y2 || (curY === y2 && curM <= m2)) {
    list.push(`${curY}-${pad(curM)}`);
    curM++;
    if (curM > 12) { curM = 1; curY++; }
  }
  return list.length ? list : [`${y1}-${pad(m1)}`];
};

const isOutOfSchoolYear = dStr => {
  const { start, end } = schoolYearRange();
  if (start && dStr < start) return true;
  if (end && dStr > end) return true;
  return false;
};

const schoolYearLabel = () => {
  const { start, end } = schoolYearRange();
  return `${dataIt(start)} – ${dataIt(end)}`;
};

const giornoIdx = s => { const i = GIORNI.indexOf(s.giorno); return i < 0 ? 99 : i; };
const sorted = list => [...list].sort((a, b) => (giornoIdx(a) - giornoIdx(b))
  || String(a.orario || '').localeCompare(String(b.orario || '')) || fullName(a).localeCompare(fullName(b)));
const field = (label, name, val, attrs = '') => `<label>${label}<input name="${name}" value="${esc(val)}" ${attrs}></label>`;
const opt = (v, sel, label = v) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(label)}</option>`;

let S = null; // stato completo caricato dal server
const ui = {
  tab: location.hash.slice(1) || 'dashboard',
  dashPeriod: 'anno', // 'anno' | 'mese' | 'tutto'
  search: '',
  presMese: today().slice(0, 7),
  ricSearch: '',
  pnSearch: '',
  pnSubTab: 'registro', // 'registro' | 'liquidazioni' | 'spese'
  pnTipo: '', // '' | 'ENTRATA' | 'USCITA'
  pnMese: '',
  guidaSearch: '',
  guidaSection: 'all',
};

const studentById = id => S.students.find(s => s.id === id);
const paymentById = id => S.payments.find(p => p.id === id);
const teacherPaymentById = id => (S.teacherPayments || []).find(p => p.id === id);
const expenseById = id => (S.expenses || []).find(e => e.id === id);
const incomeExtraById = id => (S.incomeExtra || []).find(i => i.id === id);
const smtpOk = () => !!(S.settings.smtp.host && S.settings.smtp.user && S.settings.smtp.hasPass);

let G_DRIVE = null;
let isSyncing = false;
let justSynced = false;
let justSyncedTimeout = null;
let syncWatchTimer = null;
let syncWatchCount = 0;

function formatSyncTime(isoStr, withSeconds = true) {
  if (!isoStr) return 'Mai';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return 'Mai';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timePart = d.toLocaleTimeString('it-IT', withSeconds ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Oggi alle ${timePart}`;
  } else if (isYesterday) {
    return `Ieri alle ${timePart}`;
  } else {
    const datePart = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${datePart} alle ${timePart}`;
  }
}

function triggerJustSynced() {
  justSynced = true;
  if (justSyncedTimeout) clearTimeout(justSyncedTimeout);
  justSyncedTimeout = setTimeout(() => {
    justSynced = false;
    renderCloudPill();
  }, 4500);
  renderCloudPill();
}

function triggerSyncWatch() {
  if (!G_DRIVE?.connected || !G_DRIVE?.autoSync) return;
  isSyncing = true;
  renderCloudPill();
  if (syncWatchTimer) clearInterval(syncWatchTimer);
  const initialSync = G_DRIVE.lastSync;
  syncWatchCount = 0;

  syncWatchTimer = setInterval(async () => {
    syncWatchCount++;
    try {
      const status = await api('GET', '/api/google/status');
      G_DRIVE = status;
      // Se l'upload è completato (il timestamp di lastSync è avanzato oppure non è più in corso dopo almeno 3 iterazioni)
      if (status.lastSync !== initialSync || (syncWatchCount >= 3 && !status.syncInProgress)) {
        clearInterval(syncWatchTimer);
        syncWatchTimer = null;
        isSyncing = false;
        triggerJustSynced();
        return;
      }
    } catch (_) {}

    if (syncWatchCount >= 18) {
      clearInterval(syncWatchTimer);
      syncWatchTimer = null;
      isSyncing = false;
      renderCloudPill();
    }
  }, 800);
}

async function api(method, url, body) {
  // Supporto nativo per ambiente Android standalone (solo se in esecuzione su app Android nativa)
  if (window.Android && window.LocalDbEngine) {
    await window.LocalDbEngine.init();
    return window.LocalDbEngine.handle(url, { method, body });
  }
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Errore ${r.status}`);

  // Se è una modifica ai dati e la sincronizzazione cloud è attiva, avvia subito l'indicatore visivo
  const m = String(method).toUpperCase();
  if ((m === 'POST' || m === 'PUT' || m === 'DELETE') && !url.includes('/api/google/') && !url.includes('/test-email')) {
    triggerSyncWatch();
  }

  return j;
}

async function loadGoogleStatus() {
  try {
    G_DRIVE = await api('GET', '/api/google/status');
    renderCloudPill();
  } catch (e) {
    console.warn('Stato Google Drive non caricabile:', e.message);
  }
}

function renderCloudPill() {
  const slot = $('#cloud-status-slot');
  if (!slot) return;
  if (!G_DRIVE) {
    slot.innerHTML = '';
    return;
  }
  if (isSyncing || G_DRIVE.syncInProgress) {
    slot.innerHTML = `
      <div class="cloud-pill syncing" data-act="cloud-menu" title="Sincronizzazione Google Drive in corso... Clicca per dettagli">
        <span class="dot"></span>
        <span>Sincronizzazione Drive...</span>
        <span class="cloud-spinner-icon">🔄</span>
      </div>`;
    return;
  }
  if (justSynced && G_DRIVE.lastSync) {
    const timeStr = new Date(G_DRIVE.lastSync).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    slot.innerHTML = `
      <div class="cloud-pill just-synced" data-act="cloud-menu" title="Sincronizzazione completata con successo!">
        <span class="dot"></span>
        <span>✓ Sincronizzato (${timeStr})</span>
      </div>`;
    return;
  }
  if (G_DRIVE.connected) {
    let timeStr = 'Attivo';
    if (G_DRIVE.lastSync) {
      const d = new Date(G_DRIVE.lastSync);
      const isToday = d.toDateString() === new Date().toDateString();
      timeStr = isToday
        ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : `${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }
    const fullTooltip = `Google Drive collegato (${esc(G_DRIVE.accountEmail || 'Account')})\nUltimo sync: ${formatSyncTime(G_DRIVE.lastSync)}\nClicca per dettagli o sincronizzazione immediata`;
    slot.innerHTML = `
      <div class="cloud-pill connected" data-act="cloud-menu" title="${fullTooltip}">
        <span class="dot"></span>
        <span>Drive: ${timeStr}</span>
        <button type="button" class="cloud-quick-btn" data-act="cloud-quick-sync" title="Forza sincronizzazione immediata adesso">🔄</button>
      </div>`;
  } else {
    slot.innerHTML = `<div class="cloud-pill offline" data-act="cloud-menu" title="Tocca per collegare il tuo account Google Drive."><span class="dot"></span><span>Accedi a Google</span></div>`;
  }
}

function formatSyncError(errStr) {
  if (!errStr) return '';
  const urlMatch = errStr.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    const url = urlMatch[0];
    const cleanMsg = errStr.replace(url, '').replace(/Enable it by visiting.*retry\./i, '').replace(/then retry\./i, '').trim();
    return `${esc(cleanMsg)} <br><a href="${esc(url)}" target="_blank" style="display:inline-block;margin-top:6px;font-weight:bold;color:#2563eb;text-decoration:underline;">👉 Clicca qui per abilitare Google Drive API nel tuo progetto Google Cloud</a>`;
  }
  return esc(errStr);
}

function openCloudMenu() {
  const isConn = G_DRIVE?.connected;
  const email = G_DRIVE?.accountEmail;
  const lastSyncFormatted = formatSyncTime(G_DRIVE?.lastSync);
  const folder = G_DRIVE?.folderName || 'Gestionale Scuola di Musica';
  const isCurrentlySyncing = isSyncing || G_DRIVE?.syncInProgress;

  openDialog({
    title: '☁️ Sincronizzazione Google Drive',
    body: `
      <div class="cloud-status-box ${isConn ? 'active' : 'inactive'}">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:28px;">${isConn ? (isCurrentlySyncing ? '🔄' : '🟢') : '⚪'}</span>
          <div>
            <b>${isConn ? 'Account Google Collegato' : 'Non Collegato'}</b>
            <div class="muted small">${isConn ? `${esc(email)} · Cartella Cloud: <b>${esc(folder)}</b>` : 'La sincronizzazione con il cloud non è ancora attiva.'}</div>
          </div>
        </div>
        ${isConn ? `
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:13px;">
            <div>Ultima sincronizzazione: <b>${lastSyncFormatted}</b> ${G_DRIVE?.lastSyncAction ? `<span class="badge ${G_DRIVE.lastSyncStatus === 'error' ? 'due' : 'ok'} small" style="margin-left:6px;">${G_DRIVE.lastSyncAction === 'download' ? 'scaricato da Drive' : 'salvato su Drive'}</span>` : ''}</div>
            <div class="muted small" style="margin-top:4px;">Sincronizzazione automatica: <b>${G_DRIVE?.autoSync ? 'Attiva (si attiva automaticamente ad ogni modifica)' : 'Disattivata'}</b></div>
          </div>
        ` : ''}
        ${isCurrentlySyncing ? `<div style="color:var(--brand);font-weight:600;font-size:13px;margin-top:8px;">⏳ Sincronizzazione in corso...</div>` : ''}
        ${G_DRIVE?.lastSyncError ? `<div style="color:var(--due);font-size:12.5px;margin-top:6px;line-height:1.4;">${formatSyncError(G_DRIVE.lastSyncError)}</div>` : ''}
      </div>

      ${isConn ? `
        <div class="menu-list">
          <button type="button" class="btn primary" data-act="cloud-sync" data-dir="auto" ${isCurrentlySyncing ? 'disabled' : ''}>🔄 Sincronizza ora (Automatico)</button>
          <button type="button" class="btn" data-act="cloud-sync" data-dir="upload" ${isCurrentlySyncing ? 'disabled' : ''}>⬆️ Carica dati locali su Google Drive (forza upload)</button>
          <button type="button" class="btn" data-act="cloud-sync" data-dir="download" ${isCurrentlySyncing ? 'disabled' : ''}>⬇️ Scarica e ripristina dati da Google Drive</button>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px;align-items:center;">
          <a class="btn small" href="#impostazioni" data-close>⚙️ Gestisci Impostazioni Drive</a>
          <span class="spacer"></span>
          <button type="button" class="btn danger small" data-act="cloud-disconnect">Disconnetti Google</button>
        </div>
      ` : `
        <p class="muted small">
          Collega il tuo account Google per mantenere sincronizzati studenti, rette, presenze e prima nota su Google Drive.
        </p>
        <div style="margin-top:16px;display:flex;gap:10px;align-items:center;">
          <button type="button" class="btn primary" data-act="cloud-connect">🔑 Accedi con Google</button>
          <span class="spacer"></span>
          <button type="button" class="btn" data-close>Chiudi</button>
        </div>
      `}
    `,
    actions: isConn ? `<button type="button" class="btn" data-close>Chiudi</button>` : ''
  });
}

async function syncGoogle(direction = 'auto') {
  if ($('#settings-form')) {
    await persistSettingsFromDom();
  }
  if (!G_DRIVE?.connected) {
    toast('Collega prima il tuo account Google nelle Impostazioni', 'err');
    return;
  }
  isSyncing = true;
  renderCloudPill();
  toast(direction === 'upload' ? 'Caricamento su Google Drive in corso...' :
        direction === 'download' ? 'Download da Google Drive in corso...' :
        'Sincronizzazione in corso...');
  try {
    const res = await api('POST', '/api/google/sync', { direction });
    if (!res.ok && res.error) {
      toast(res.error, 'err');
    } else {
      toast(res.action === 'upload' ? '✅ Dati caricati su Google Drive con successo!' :
            res.action === 'download' ? '✅ Dati aggiornati da Google Drive con successo!' :
            '✅ Sincronizzazione completata!');
      closeDialog();
      triggerJustSynced();
      await reload();
    }
  } catch (err) {
    toast('Errore sincronizzazione: ' + err.message, 'err');
  } finally {
    isSyncing = false;
    await loadGoogleStatus();
    renderCloudPill();
  }
}

async function connectGoogle() {
  try {
    const res = await api('GET', '/api/google/auth-url');
    if (res && res.startedOnAndroid) {
      closeDialog();
      toast('Seleziona il tuo account Google per completare il collegamento.');
      return;
    }
    if (!res.authUrl) throw new Error('Impossibile ottenere URL di autenticazione');
    const w = window.open(res.authUrl, 'google_auth_window', 'width=560,height=680,menubar=no,toolbar=no');
    toast('Accedi con il tuo account Google nel browser per completare il collegamento.');

    // Polling attivo dello stato per rilevare il completamento dell'accesso nel browser
    let attempts = 0;
    const pollTimer = setInterval(async () => {
      attempts++;
      try {
        const st = await api('GET', '/api/google/status');
        if (st && st.connected) {
          clearInterval(pollTimer);
          closeDialog();
          toast('🎉 Account Google collegato con successo!');
          await reload();
        }
      } catch (_) {}
      if (attempts >= 45) clearInterval(pollTimer);
    }, 2000);
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function disconnectGoogle() {
  if (!confirm('Vuoi disconnettere l\'account Google? I dati locali rimarranno sul computer, ma la sincronizzazione cloud verrà interrotta.')) return;
  await api('POST', '/api/google/disconnect');
  closeDialog();
  toast('Account Google disconnesso');
  await reload();
}

async function reload() {
  S = await api('GET', '/api/state');
  await loadGoogleStatus();
  render();
}

function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), type === 'err' ? 7000 : 3500);
}


function openDialog({ title, body, actions, onSubmit, isWide = false }) {
  const d = $('#dlg');
  d.className = isWide ? 'dlg-wide' : '';
  d.style.width = '';
  d.style.height = '';
  d.innerHTML = `<form class="dlg-form ${isWide ? 'dlg-wide' : ''}" novalidate>
    <header>
      <h3>${title}</h3>
      <button type="button" class="btn-icon-subtle" data-dlg-expand title="Ingrandisci / Schermo intero">⛶</button>
      <button type="button" class="x" data-close aria-label="Chiudi">×</button>
    </header>
    <div class="dlg-body">${body}</div>
    <footer>${actions}</footer></form>`;
  const f = $('form', d);
  f.onsubmit = async e => {
    e.preventDefault();
    if (!f.reportValidity()) return;
    const data = Object.fromEntries(new FormData(f));
    const btns = $$('button', f); btns.forEach(b => { b.disabled = true; });
    try { await onSubmit?.(data, e.submitter?.value || ''); } catch (err) { toast(err.message, 'err'); } finally { btns.forEach(b => { b.disabled = false; }); }
  };
  $$('[data-close]', d).forEach(b => { b.onclick = () => d.close(); });
  const expandBtn = $('[data-dlg-expand]', d);
  if (expandBtn) {
    expandBtn.onclick = () => {
      d.classList.toggle('dlg-fullscreen');
      expandBtn.textContent = d.classList.contains('dlg-fullscreen') ? '🗗' : '⛶';
    };
  }
  d.showModal();
  return d;
}
const closeDialog = () => { const d = $('#dlg'); if (d.open) d.close(); };

function asyncPrompt({
  title = 'Richiesta dato',
  message = '',
  bodyHtml = '',
  value = '',
  placeholder = '',
  confirmText = 'Conferma',
  confirmIcon = '',
  cancelText = 'Annulla',
  inputType = 'text',
  required = false
}) {
  return new Promise(resolve => {
    let d = $('#dlg-prompt');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'dlg-prompt';
      d.className = 'dlg-prompt';
      document.body.appendChild(d);
    }
    d.className = 'dlg-prompt';
    d.innerHTML = `<form class="dlg-form" method="dialog" novalidate>
      <header>
        <h3>${esc(title)}</h3>
        <button type="button" class="x" data-prompt-close aria-label="Chiudi">×</button>
      </header>
      <div class="dlg-body">
        ${bodyHtml || `
          ${message ? `<p class="muted" style="margin-top:0;margin-bottom:12px;font-size:14px;line-height:1.4">${esc(message)}</p>` : ''}
          <input type="${inputType}" id="prompt-input" name="promptVal" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''} style="width:100%;font-size:15px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;box-sizing:border-box;">
        `}
      </div>
      <footer>
        <span class="spacer"></span>
        <button type="button" class="btn" data-prompt-close>${esc(cancelText)}</button>
        <button type="submit" class="btn primary" id="prompt-ok-btn">${confirmIcon ? confirmIcon + ' ' : ''}${esc(confirmText)}</button>
      </footer>
    </form>`;

    let finished = false;
    const finish = val => {
      if (finished) return;
      finished = true;
      if (d.open) d.close();
      resolve(val);
    };

    const form = $('form', d);
    const input = $('#prompt-input', d);

    $$('[data-prompt-close]', d).forEach(b => {
      b.onclick = () => finish(null);
    });

    form.onsubmit = e => {
      e.preventDefault();
      if (required && input && !input.value.trim()) {
        input.focus();
        toast('Compila il campo richiesto', 'err');
        return;
      }
      const val = input ? input.value : (new FormData(form)).get('promptVal');
      finish(val !== null && val !== undefined ? String(val) : '');
    };

    d.oncancel = e => {
      e.preventDefault();
      finish(null);
    };

    d.showModal();
    if (input) {
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
    }
  });
}
window.prompt = () => null;

function shareReceiptNative(id) {
  const p = paymentById(id);
  if (!p) { toast('Ricevuta non trovata', 'err'); return; }
  const s = studentById(p.studentId) || { nome: '', cognome: '', strumento: '' };
  const st = S.settings || {};
  const allievo = fullName(s);
  const importo = '€ ' + (p.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 });
  const shareTitle = `Ricevuta n. ${p.numero}/${p.anno} - ${allievo}`;
  const shareBody = `Tralci di Note - Ricevuta n. ${p.numero}/${p.anno}\nAllievo: ${allievo}\nMese: ${meseLabel(p.mese)}\nImporto: ${importo}\nMetodo: ${p.metodo || 'Contanti'}\nScuola: ${st.scuola || 'Come Tralci Novara'}`;

  if (window.Android && typeof window.Android.shareText === 'function') {
    window.Android.shareText(shareTitle, shareBody);
    toast('Condivisione avviata');
    return;
  }

  if (navigator.share) {
    navigator.share({ title: shareTitle, text: shareBody }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(shareBody);
    toast('Testo ricevuta copiato negli appunti');
  }
}

function openReceipt(id, autoPrint) {
  if (window.Android && typeof window.Android.printHtml === 'function') {
    const p = paymentById(id);
    const s = studentById(p?.studentId) || { nome: '', cognome: '' };
    const html = window.PrintTemplates ? window.PrintTemplates.renderReceiptHtml(p, s, S.settings) : '';
    if (html) {
      window.Android.printHtml(html, `Ricevuta_${p.numero}_${p.anno}`);
      return;
    }
  }
  const w = window.open(`/receipt/${id}${autoPrint ? '?print=1' : ''}`, '_blank');
  if (!w) toast('Il browser ha bloccato la finestra: consenti i popup per localhost', 'err');
}
function openTeacherPayment(id, autoPrint) {
  if (window.Android && typeof window.Android.printHtml === 'function') {
    const tp = teacherPaymentById(id);
    if (!tp) { toast('Prospetto non trovato', 'err'); return; }
    const html = window.PrintTemplates ? window.PrintTemplates.renderSettlementReceiptHtml(tp, S.settings) : '';
    if (html) {
      window.Android.printHtml(html, `Prospetto_${tp.numero}_${tp.anno}`);
      return;
    }
  }
  const w = window.open(`/teacher-payment/${id}${autoPrint ? '?print=1' : ''}`, '_blank');
  if (!w) toast('Il browser ha bloccato la finestra: consenti i popup per localhost', 'err');
}
function openCashbookPrint() {
  const { start, end } = schoolYearRange();
  if (window.Android && typeof window.Android.printHtml === 'function' && window.PrintTemplates?.renderCashbookHtml) {
    const html = window.PrintTemplates.renderCashbookHtml(S, {
      da: start,
      a: end,
      tipoFiltro: ui.pnTipo ? (ui.pnTipo === 'ENTRATA' ? 'E' : 'U') : ''
    });
    window.Android.printHtml(html, `PrimaNota_${start}_${end}`);
    return;
  }
  const url = `/prima-nota/stampa?da=${encodeURIComponent(start)}&a=${encodeURIComponent(end)}${ui.pnTipo ? '&tipo=' + (ui.pnTipo === 'ENTRATA' ? 'E' : 'U') : ''}&print=1`;
  const w = window.open(url, '_blank');
  if (!w) toast('Il browser ha bloccato la finestra: consenti i popup per localhost', 'err');
}

// ---------------------------------------------------------------- render
const VIEWS = {
  dashboard: viewDashboard,
  studenti: viewStudenti,
  pagamenti: viewPagamenti,
  presenze: viewPresenze,
  ricevute: viewRicevute,
  primanota: viewPrimaNota,
  impostazioni: viewImpostazioni,
  guida: viewGuida
};

function render() {
  if (!VIEWS[ui.tab]) ui.tab = 'dashboard';
  const ver = S?.version || APP_VERSION;
  const verEl = $('#app-version');
  if (verEl) verEl.textContent = `v${ver}`;
  const fVer = $('#footer-version');
  if (fVer) fVer.textContent = `v${ver}`;
  const snEl = $('#school-name');
  if (snEl) snEl.textContent = S?.settings?.scuola || '';
  $$('.tabs a').forEach(a => {
    const isAct = a.dataset.tab === ui.tab;
    a.classList.toggle('active', isAct);
    if (isAct && typeof a.scrollIntoView === 'function') {
      try { a.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch (_) {}
    }
  });
  $('#view').innerHTML = VIEWS[ui.tab]();
  if (ui.tab === 'impostazioni') {
    const sf = $('#settings-form');
    if (sf) {
      sf.onsubmit = e => { e.preventDefault(); saveSettings().catch(err => toast(err.message, 'err')); };
      sf.addEventListener('input', () => scheduleAutoSaveSettings());
      sf.addEventListener('change', () => { persistSettingsFromDom().catch(() => {}); });
    }
  }
}

// ---------------------------------------------------------------- DASHBOARD STATISTICHE
function viewDashboard() {
  const allStudents = S.students || [];
  const activeStudents = allStudents.filter(s => s.stato === 'Attivo');
  const allEntries = getCashbookEntries();
  const curMese = today().slice(0, 7);
  const { start: yrStart, end: yrEnd } = schoolYearRange();

  // Filtro periodo: 'anno' (anno scolastico) | 'mese' (mese corrente) | 'tutto' (tutto lo storico)
  const period = ui.dashPeriod || 'anno';
  let filteredEntries = allEntries;
  if (period === 'anno') {
    filteredEntries = allEntries.filter(e => (!yrStart || e.data >= yrStart) && (!yrEnd || e.data <= yrEnd));
  } else if (period === 'mese') {
    filteredEntries = allEntries.filter(e => (e.data || '').startsWith(curMese));
  }

  const totEntrate = filteredEntries.reduce((a, x) => a + x.entrata, 0);
  const totUscite = filteredEntries.reduce((a, x) => a + x.uscita, 0);
  const saldo = totEntrate - totUscite;

  // Rette vs Extra
  const totRette = filteredEntries.filter(e => e.tipo === 'ENTRATA' && e.categoria === 'Retta allievo').reduce((a, x) => a + x.entrata, 0);
  const totExtra = filteredEntries.filter(e => e.tipo === 'ENTRATA' && e.categoria !== 'Retta allievo').reduce((a, x) => a + x.entrata, 0);

  // Liquidazioni vs Spese
  const totLiquidazioni = filteredEntries.filter(e => e.tipo === 'USCITA' && e.categoria === 'Liquidazione rette').reduce((a, x) => a + x.uscita, 0);
  const totSpese = filteredEntries.filter(e => e.tipo === 'USCITA' && e.categoria !== 'Liquidazione rette').reduce((a, x) => a + x.uscita, 0);

  // Mese corrente
  const entrateMese = allEntries.filter(e => (e.data || '').startsWith(curMese) && e.tipo === 'ENTRATA').reduce((a, x) => a + x.entrata, 0);
  const usciteMese = allEntries.filter(e => (e.data || '').startsWith(curMese) && e.tipo === 'USCITA').reduce((a, x) => a + x.uscita, 0);

  // --- STATISTICHE ETÀ DEGLI ALLIEVI ---
  const withBirth = activeStudents.filter(s => s.dataNascita && calcAge(s.dataNascita) !== null);
  const withoutBirth = activeStudents.filter(s => !s.dataNascita || calcAge(s.dataNascita) === null);
  const studentAges = withBirth.map(s => ({ student: s, age: calcAge(s.dataNascita) }));
  
  const avgAge = studentAges.length
    ? (studentAges.reduce((a, x) => a + x.age, 0) / studentAges.length).toFixed(1)
    : null;
  const youngest = studentAges.length
    ? [...studentAges].sort((a, b) => a.age - b.age)[0]
    : null;
  const oldest = studentAges.length
    ? [...studentAges].sort((a, b) => b.age - a.age)[0]
    : null;

  // Fasce d'età
  const ageBrackets = [
    { key: 'u10', label: 'Bambini (< 11 anni)', color: 'fill-emerald', items: studentAges.filter(x => x.age < 11) },
    { key: 'm11_14', label: 'Ragazzi (11 – 14 anni)', color: 'fill-blue', items: studentAges.filter(x => x.age >= 11 && x.age <= 14) },
    { key: 's15_18', label: 'Adolescenti (15 – 18 anni)', color: 'fill-purple', items: studentAges.filter(x => x.age >= 15 && x.age <= 18) },
    { key: 'g19_25', label: 'Giovani Adulti (19 – 25 anni)', color: 'fill-amber', items: studentAges.filter(x => x.age >= 19 && x.age <= 25) },
    { key: 'o25', label: 'Adulti (> 25 anni)', color: 'fill-rose', items: studentAges.filter(x => x.age > 25) },
  ];
  const maxBracketCount = Math.max(1, ...ageBrackets.map(b => b.items.length));

  // --- SUDDIVISIONE STRUMENTI E ALLIEVI ---
  const instrumentMap = {};
  getStrumenti().forEach(inst => { instrumentMap[inst] = []; });
  activeStudents.forEach(s => {
    const inst = s.strumento || 'Altro';
    if (!instrumentMap[inst]) instrumentMap[inst] = [];
    instrumentMap[inst].push(s);
  });
  const instrumentStats = Object.entries(instrumentMap)
    .filter(([_, list]) => list.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([inst, list]) => {
      const count = list.length;
      const perc = activeStudents.length ? Math.round((count / activeStudents.length) * 100) : 0;
      const monthlyTotal = list.reduce((a, s) => a + (s.retta || 0), 0);
      return { inst, count, perc, monthlyTotal, students: list };
    });
  const maxInstrumentCount = Math.max(1, ...instrumentStats.map(i => i.count));
  const instrumentColors = ['fill-blue', 'fill-emerald', 'fill-purple', 'fill-amber', 'fill-cyan', 'fill-indigo', 'fill-rose'];

  // --- SUDDIVISIONE PER GIORNO DELLA SETTIMANA ---
  const dayMap = {};
  GIORNI.forEach(g => { dayMap[g] = []; });
  activeStudents.forEach(s => {
    if (s.giorno && dayMap[s.giorno]) dayMap[s.giorno].push(s);
  });
  const dayStats = GIORNI.map(g => ({ giorno: g, students: dayMap[g] || [] })).filter(d => d.students.length > 0);

  // --- RETTE MESE CORRENTE ---
  const paidThisMonth = activeStudents.filter(s => S.payments.some(p => p.studentId === s.id && p.mese === curMese));
  const unpaidThisMonth = activeStudents.filter(s => !S.payments.some(p => p.studentId === s.id && p.mese === curMese));
  const tuitionCollectionRate = activeStudents.length
    ? Math.round((paidThisMonth.length / activeStudents.length) * 100)
    : 0;

  // --- RECUPERI & ASSENZE ---
  const pendingRecoveries = (S.recoveries || []).length;

  // --- TREND MENSILE ENTRATE & USCITE (Mesi Anno Scolastico) ---
  const schoolMonths = getSchoolMonths();
  const monthlyFlows = schoolMonths.map(m => {
    const e = allEntries.filter(x => (x.data || '').startsWith(m) && x.tipo === 'ENTRATA').reduce((a, x) => a + x.entrata, 0);
    const u = allEntries.filter(x => (x.data || '').startsWith(m) && x.tipo === 'USCITA').reduce((a, x) => a + x.uscita, 0);
    return { mese: m, entrate: e, uscite: u, saldo: e - u };
  });

  return `
  <div class="dash-header">
    <div class="dash-title-group">
      <h2>📊 Dashboard Statistiche &amp; Panoramica</h2>
      <div class="muted small" style="margin-top:2px;">
        Scuola: <b>${esc(S.settings.scuola)}</b> · Anno scolastico: <b>${schoolYearLabel()}</b>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <div class="segmented-ctrl">
        <button class="${period === 'anno' ? 'active' : ''}" data-act="dash-period" data-period="anno">Anno Scolastico</button>
        <button class="${period === 'mese' ? 'active' : ''}" data-act="dash-period" data-period="mese">Mese Corrente</button>
        <button class="${period === 'tutto' ? 'active' : ''}" data-act="dash-period" data-period="tutto">Tutto lo Storico</button>
      </div>
      <button class="btn small" data-act="dash-print" title="Stampa o salva in PDF la schermata statistiche">🖨️ Stampa Report</button>
      <button class="btn small primary" data-act="dash-refresh">🔄 Aggiorna</button>
    </div>
  </div>

  ${withoutBirth.length > 0 ? `
    <div class="dash-banner warn">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;">🎂</span>
        <div>
          <b>Data di nascita mancante per ${withoutBirth.length} ${withoutBirth.length === 1 ? 'allievo' : 'allievi'} attivi</b>
          <div class="small" style="margin-top:2px;color:#78350f;">
            Aggiungi la data di nascita nella scheda allievi per completare le statistiche sull'età:
            ${withoutBirth.map(s => `<button type="button" class="dash-chip" style="margin:2px 3px 0 0;" data-act="student-edit" data-id="${s.id}">✏️ ${esc(fullName(s))}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>
  ` : ''}

  <!-- TOP STATS KPI CARDS -->
  <div class="dash-stats-grid">
    <div class="dash-kpi">
      <div class="dash-kpi-icon">💰</div>
      <div class="k">Entrate Totali</div>
      <div class="v ok">${euro(totEntrate)}</div>
      <div class="sub">
        Rette: <b>${euro(totRette)}</b> ${totExtra > 0 ? `· Extra: <b>${euro(totExtra)}</b>` : ''}
        ${period !== 'mese' ? `<div style="font-size:11px;color:#059669;margin-top:2px;">Mese corr.: ${euro(entrateMese)}</div>` : ''}
      </div>
    </div>

    <div class="dash-kpi">
      <div class="dash-kpi-icon">💸</div>
      <div class="k">Uscite Totali</div>
      <div class="v due">${euro(totUscite)}</div>
      <div class="sub">
        Docenti: <b>${euro(totLiquidazioni)}</b> ${totSpese > 0 ? `· Spese: <b>${euro(totSpese)}</b>` : ''}
        ${period !== 'mese' ? `<div style="font-size:11px;color:#dc2626;margin-top:2px;">Mese corr.: ${euro(usciteMese)}</div>` : ''}
      </div>
    </div>

    <div class="dash-kpi">
      <div class="dash-kpi-icon">📈</div>
      <div class="k">Saldo / Utile Netto</div>
      <div class="v ${saldo >= 0 ? 'bal' : 'due'}">${euro(saldo)}</div>
      <div class="sub">
        ${saldo >= 0 ? '<span style="color:#059669;font-weight:700;">● Gestione in attivo</span>' : '<span style="color:#dc2626;font-weight:700;">● Disavanzo temporaneo</span>'}
        <div style="font-size:11px;margin-top:2px;">Entrate nette – uscite complessive</div>
      </div>
    </div>

    <div class="dash-kpi">
      <div class="dash-kpi-icon">👥</div>
      <div class="k">Partecipanti Allievi</div>
      <div class="v" style="color:#0f172a;">${activeStudents.length} <span style="font-size:16px;font-weight:600;color:#64748b;">attivi</span></div>
      <div class="sub">
        ${allStudents.length > activeStudents.length ? `Su ${allStudents.length} iscritti storici · ` : ''}
        Età media: <b>${avgAge ? avgAge + ' anni' : 'n.d.'}</b>
      </div>
    </div>

    <div class="dash-kpi">
      <div class="dash-kpi-icon">🎯</div>
      <div class="k">Rette ${meseLabel(curMese)}</div>
      <div class="v ${tuitionCollectionRate === 100 ? 'ok' : tuitionCollectionRate >= 70 ? 'bal' : 'due'}">${tuitionCollectionRate}%</div>
      <div class="sub">
        <b>${paidThisMonth.length}</b> su <b>${activeStudents.length}</b> allievi hanno saldato
        ${unpaidThisMonth.length > 0 ? `<div style="font-size:11px;color:#dc2626;margin-top:2px;">⚠️ ${unpaidThisMonth.length} in sospeso</div>` : '<div style="font-size:11px;color:#059669;margin-top:2px;">✅ Tutte le rette saldate!</div>'}
      </div>
    </div>
  </div>

  <!-- SEZIONI PRINCIPALI A 2 COLONNE -->
  <div class="dash-sections-grid">
    
    <!-- 1. ETÀ DEI PARTECIPANTI ALLIEVI -->
    <div class="dash-widget">
      <div class="dash-widget-head">
        <h3>🎂 Età dei Partecipanti &amp; Anagrafica</h3>
        <span class="tag" style="background:#f0f9ff;color:#0284c7;border-color:#bae6fd;">
          ${withBirth.length} di ${activeStudents.length} con data
        </span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;padding:12px 14px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:18px;">
        <div style="text-align:center;">
          <div class="muted small" style="text-transform:uppercase;font-size:11px;font-weight:700;">Età Media</div>
          <div style="font-size:20px;font-weight:800;color:#0284c7;margin-top:2px;">
            ${avgAge !== null ? `${avgAge} <span style="font-size:12px;font-weight:600;">anni</span>` : '–'}
          </div>
        </div>
        <div style="text-align:center;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:0 6px;">
          <div class="muted small" style="text-transform:uppercase;font-size:11px;font-weight:700;">Più Giovane</div>
          <div style="font-size:13.5px;font-weight:700;color:#0f172a;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${youngest ? fullName(youngest.student) : ''}">
            ${youngest ? `${esc(fullName(youngest.student))} <span style="color:#059669;">(${youngest.age}a)</span>` : '–'}
          </div>
        </div>
        <div style="text-align:center;">
          <div class="muted small" style="text-transform:uppercase;font-size:11px;font-weight:700;">Più Grande</div>
          <div style="font-size:13.5px;font-weight:700;color:#0f172a;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${oldest ? fullName(oldest.student) : ''}">
            ${oldest ? `${esc(fullName(oldest.student))} <span style="color:#7c3aed;">(${oldest.age}a)</span>` : '–'}
          </div>
        </div>
      </div>

      <h4 style="margin:0 0 10px;font-size:13px;text-transform:uppercase;color:#475569;letter-spacing:0.04em;">Distribuzione per Fasce d'Età</h4>
      <div class="chart-bar-list">
        ${ageBrackets.map(b => {
          const count = b.items.length;
          const perc = withBirth.length ? Math.round((count / withBirth.length) * 100) : 0;
          const barWidth = Math.round((count / maxBracketCount) * 100);
          return `
          <div class="chart-bar-item">
            <div class="chart-bar-labels">
              <span><b>${b.label}</b></span>
              <span class="extra"><b>${count}</b> allievi (${perc}%)</span>
            </div>
            <div class="chart-bar-track">
              <div class="chart-bar-fill ${b.color}" style="width:${barWidth}%;"></div>
            </div>
            ${count > 0 ? `
              <div class="dash-chips">
                ${b.items.map(x => `
                  <button type="button" class="dash-chip" data-act="student-edit" data-id="${x.student.id}" title="Clicca per modificare ${esc(fullName(x.student))}">
                    ${esc(fullName(x.student))} (${x.age}a · ${esc(x.student.strumento || '')})
                  </button>
                `).join('')}
              </div>
            ` : '<div class="muted small" style="font-style:italic;margin-top:2px;">Nessun allievo in questa fascia</div>'}
          </div>`;
        }).join('')}
      </div>

      ${withoutBirth.length > 0 ? `
        <div style="margin-top:16px;padding-top:12px;border-top:1px dashed #e2e8f0;font-size:12.5px;color:#64748b;">
          ⚠️ <b>${withoutBirth.length} allievi</b> non compaiono nel grafico perché la loro data di nascita non è stata ancora inserita.
          <a href="#studenti" style="font-weight:600;margin-left:4px;">Vai all'elenco studenti ➔</a>
        </div>
      ` : `
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:12.5px;color:#059669;font-weight:600;">
          ✨ Ottimo! Tutti gli allievi attivi hanno la data di nascita registrata.
        </div>
      `}
    </div>

    <!-- 2. SUDDIVISIONE STRUMENTI E ALLIEVI -->
    <div class="dash-widget">
      <div class="dash-widget-head">
        <h3>🎸 Suddivisione Strumenti &amp; Allievi</h3>
        <span class="tag">${instrumentStats.length} strumenti attivi</span>
      </div>

      <div class="chart-bar-list" style="margin-bottom:18px;">
        ${instrumentStats.map((item, idx) => {
          const colorCls = instrumentColors[idx % instrumentColors.length];
          const barWidth = Math.round((item.count / maxInstrumentCount) * 100);
          return `
          <div class="chart-bar-item">
            <div class="chart-bar-labels">
              <span><b style="font-size:14px;">🎵 ${esc(item.inst)}</b></span>
              <span class="extra">
                <b>${item.count}</b> allievi (${item.perc}%) · <span style="color:#059669;font-weight:700;">${euro(item.monthlyTotal)}/mese</span>
              </span>
            </div>
            <div class="chart-bar-track" style="height:14px;">
              <div class="chart-bar-fill ${colorCls}" style="width:${barWidth}%;"></div>
            </div>
            <div class="dash-chips">
              ${item.students.map(s => {
                const sAge = calcAge(s.dataNascita);
                return `
                <button type="button" class="dash-chip" data-act="student-edit" data-id="${s.id}" title="Clicca per aprire la scheda di ${esc(fullName(s))}">
                  👤 ${esc(fullName(s))}${sAge !== null ? ` (${sAge}a)` : ''} · ${esc(s.giorno || '')}
                </button>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>

      <div style="margin-top:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;font-weight:700;color:#1e293b;">Potenziale Rette Mensili Totale:</span>
          <span style="font-size:16px;font-weight:800;color:#059669;">
            ${euro(activeStudents.reduce((a, s) => a + (s.retta || 0), 0))} / mese
          </span>
        </div>
      </div>
    </div>

  </div>

  <!-- SEZIONI SECONDARIE: FLUSSI MENSILI + ORGANIZZAZIONE & RETTE IN SOSPESO -->
  <div class="dash-sections-grid">

    <!-- 3. RENDICONTO FINANZIARIO & TREND MENSILE -->
    <div class="dash-widget">
      <div class="dash-widget-head">
        <h3>💶 Flusso Mensile Entrate vs Uscite</h3>
        <a href="#primanota" class="btn small">📒 Vai a Prima Nota</a>
      </div>

      <table class="tbl" style="margin-top:4px;">
        <thead>
          <tr>
            <th>Mese</th>
            <th class="num">Entrate</th>
            <th class="num">Uscite</th>
            <th class="num">Saldo Mese</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyFlows.map(f => {
            const isCur = f.mese === curMese;
            return `
            <tr style="${isCur ? 'background:#eff6ff;font-weight:600;' : ''}">
              <td>
                <b>${meseLabel(f.mese)}</b>${isCur ? ' <span class="tag" style="padding:1px 6px;font-size:10.5px;">Corrente</span>' : ''}
              </td>
              <td class="num" style="color:#059669;font-weight:700;">${euro(f.entrate)}</td>
              <td class="num" style="color:#dc2626;font-weight:700;">${euro(f.uscite)}</td>
              <td class="num" style="color:${f.saldo >= 0 ? '#2563eb' : '#dc2626'};font-weight:800;">
                ${euro(f.saldo)}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>Totale Anno</td>
            <td class="num" style="color:#059669;">${euro(monthlyFlows.reduce((a, x) => a + x.entrate, 0))}</td>
            <td class="num" style="color:#dc2626;">${euro(monthlyFlows.reduce((a, x) => a + x.uscite, 0))}</td>
            <td class="num" style="color:#2563eb;">${euro(monthlyFlows.reduce((a, x) => a + x.saldo, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- 4. ORGANIZZAZIONE LEZIONI & STATO PAGAMENTI -->
    <div class="dash-widget">
      <div class="dash-widget-head">
        <h3>📅 Organizzazione Lezioni &amp; Rette da Saldare</h3>
        <a href="#pagamenti" class="btn small">💶 Calendario Rette</a>
      </div>

      <h4 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;color:#475569;letter-spacing:0.04em;">
        Distribuzione Allievi per Giorno
      </h4>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
        ${dayStats.map(d => `
          <div style="flex:1;min-width:130px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;">
            <div style="font-weight:700;font-size:13.5px;color:#0f172a;">${esc(d.giorno)}</div>
            <div style="font-size:18px;font-weight:800;color:#2563eb;margin-top:2px;">
              ${d.students.length} <span style="font-size:12px;font-weight:500;color:#64748b;">allievi</span>
            </div>
            <div class="muted small" style="margin-top:4px;">
              ${d.students[0]?.orario ? `Dalle ${d.students[0].orario.split('–')[0]?.trim() || ''}` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <h4 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;color:#475569;letter-spacing:0.04em;">
        Rette Mese di ${meseLabel(curMese)} in Sospeso
      </h4>
      ${unpaidThisMonth.length > 0 ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;margin-bottom:14px;">
          <div style="font-weight:700;color:#991b1b;margin-bottom:8px;font-size:13px;">
            ⚠️ Ci sono ${unpaidThisMonth.length} allievi che non hanno ancora registrato il pagamento di ${meseLabel(curMese)}:
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${unpaidThisMonth.map(s => `
              <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #fee2e2;">
                <div>
                  <b>${esc(fullName(s))}</b>
                  <span class="muted small">(${esc(s.strumento || '')} · ${euro(s.retta)})</span>
                </div>
                <button type="button" class="btn small primary" data-act="pay-new" data-sid="${s.id}" data-mese="${curMese}">
                  💶 Registra Incasso
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 14px;color:#065f46;font-size:13px;font-weight:600;margin-bottom:14px;">
          ✅ Tutte le rette per il mese di ${meseLabel(curMese)} sono state regolarmente saldate!
        </div>
      `}

      <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-top:auto;">
        <div>
          <span style="font-size:13px;font-weight:700;color:#1e293b;">📅 Lezioni di Recupero nel Calendario:</span>
          <div class="muted small">${pendingRecoveries ? `${pendingRecoveries} recuperi registrati` : 'Nessun recupero pendente'}</div>
        </div>
        <a href="#presenze" class="btn small">Vai a Presenze</a>
      </div>

    </div>

  </div>
  `;
}

// ---------------------------------------------------------------- STUDENTI
function viewStudenti() {
  const q = ui.search.trim().toLowerCase();
  const list = sorted(S.students).filter(s => {
    if (!q) return true;
    const age = calcAge(s.dataNascita);
    const ageStr = age !== null ? `${age} anni` : '';
    const bStr = s.dataNascita ? dataIt(s.dataNascita) : '';
    return [fullName(s), s.strumento, s.giorno, s.email, s.telefono, s.intestatario, ageStr, bStr]
      .join(' ').toLowerCase().includes(q);
  });
  const attivi = S.students.filter(s => s.stato === 'Attivo').length;
  return `
  <div class="toolbar">
    <h2>Studenti <span class="muted">· ${attivi} attivi su ${S.students.length}</span></h2>
    <span class="spacer"></span>
    <input id="search" type="search" placeholder="Cerca nome, strumento, età, nascita…" value="${esc(ui.search)}">
    <button class="btn" data-act="manage-strumenti">🎸 Gestione Strumenti</button>
    <button class="btn primary" data-act="student-new">+ Nuovo studente</button>
  </div>
  <div class="card"><table class="tbl">
    <thead><tr><th>Allievo</th><th>Età / Nascita</th><th>Strumento</th><th>Lezione</th><th>Contatti</th><th class="num">Retta</th><th>Stato</th><th></th></tr></thead>
    <tbody>${list.map(s => {
      const age = calcAge(s.dataNascita);
      return `
      <tr class="${s.stato !== 'Attivo' ? 'dim' : ''}">
        <td><b>${esc(fullName(s))}</b>${s.intestatario ? `<div class="muted small">Ricevuta a: ${esc(s.intestatario)}</div>` : ''}</td>
        <td>${age !== null ? `<span style="font-weight:700;color:#0284c7;">🎂 ${age} anni</span><div class="muted small">${dataIt(s.dataNascita)}</div>` : '<span class="muted small" title="Clicca Modifica per inserire la data di nascita">🎂 Non inserita</span>'}</td>
        <td>${s.strumento ? `<span class="tag">${esc(s.strumento)}</span>` : ''}</td>
        <td>${esc(s.giorno)}<div class="muted small">${esc(s.orario)}</div></td>
        <td>${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '<span class="muted small">nessuna email</span>'}
            ${s.telefono ? `<div class="small">${esc(s.telefono)}</div>` : ''}</td>
        <td class="num">${euro(s.retta)}</td>
        <td><span class="badge ${s.stato === 'Attivo' ? 'ok' : 'off'}">${esc(s.stato)}</span></td>
        <td class="right"><button class="btn small" data-act="student-edit" data-id="${s.id}">Modifica</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="8" class="empty">Nessuno studente trovato</td></tr>'}
    </tbody>
  </table></div>`;
}

function studentDialog(id) {
  const isNew = !id;
  const s = isNew ? { stato: 'Attivo', retta: S.settings.rettaDefault, dataIscrizione: today(), dataNascita: '' } : studentById(id);
  const strumenti = [...new Set([...getStrumenti(), s.strumento].filter(Boolean))];
  const curAge = calcAge(s.dataNascita);
  openDialog({
    title: isNew ? 'Nuovo studente' : 'Modifica studente',
    body: `
    <div class="grid2">
      ${field('Nome *', 'nome', s.nome, 'required autofocus')}
      ${field('Cognome', 'cognome', s.cognome)}
      <label>
        Data di nascita
        <input type="date" name="dataNascita" id="dlg-data-nascita" value="${esc(s.dataNascita || '')}" max="${today()}">
        <div id="dlg-age-preview" class="muted small" style="margin-top:3px;font-weight:500;">
          ${curAge !== null ? `🎂 Età: <b>${curAge} anni</b>` : 'Inserisci la data per il calcolo automatico dell\'età'}
        </div>
      </label>
      <label>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span>Strumento *</span>
          <button type="button" class="btn small" style="padding:1px 7px; font-size:11.5px;" data-act="student-quick-add-strumento">➕ Nuovo strumento</button>
        </div>
        <select name="strumento" id="student-strumento-select" required>
          <option value="">— Seleziona strumento —</option>
          ${strumenti.map(x => opt(x, s.strumento)).join('')}
        </select>
      </label>
      <label>Stato<select name="stato">${['Attivo', 'Sospeso', 'Ritirato'].map(x => opt(x, s.stato)).join('')}</select></label>
      <label>Giorno lezione<select name="giorno"><option value="">—</option>${GIORNI.map(x => opt(x, s.giorno)).join('')}</select></label>
      ${field('Orario', 'orario', s.orario, 'placeholder="es. 16:00 – 16:45"')}
      ${field('Email', 'email', s.email, 'type="email"')}
      ${field('Telefono', 'telefono', s.telefono, 'type="tel"')}
      ${field('Intestatario ricevuta (es. genitore)', 'intestatario', s.intestatario, 'placeholder="Se vuoto: nome dell\'allievo"')}
      ${field('Retta mensile (€)', 'retta', s.retta, 'type="number" step="0.01" min="0"')}
      ${field('Data iscrizione', 'dataIscrizione', s.dataIscrizione, 'type="date"')}
    </div>
    <label>Note<textarea name="note" rows="2">${esc(s.note)}</textarea></label>`,
    actions: `${isNew ? '' : `<button type="button" class="btn danger" data-act="student-delete" data-id="${s.id}">Elimina</button>`}
      <span class="spacer"></span><button type="button" class="btn" data-close>Annulla</button><button class="btn primary">Salva</button>`,
    onSubmit: async data => {
      if (isNew) await api('POST', '/api/students', data); else await api('PUT', '/api/students/' + s.id, data);
      closeDialog(); toast('Studente salvato'); await reload();
    },
  });
  setTimeout(() => {
    const input = $('#dlg-data-nascita');
    if (input) {
      input.addEventListener('input', () => {
        const val = input.value;
        const age = calcAge(val);
        const prev = $('#dlg-age-preview');
        if (prev) {
          prev.innerHTML = age !== null ? `🎂 Età: <b>${age} anni</b>` : 'Inserisci la data per il calcolo automatico dell\'età';
        }
      });
    }
  }, 50);
}

async function studentDelete(id) {
  const s = studentById(id);
  const n = S.payments.filter(p => p.studentId === id).length;
  if (!confirm(`Eliminare definitivamente ${fullName(s)}?\n\nVerranno eliminati anche ${n} pagamenti e tutte le presenze.\nSe lo studente ha solo smesso, è meglio impostare lo stato "Ritirato".`)) return;
  await api('DELETE', '/api/students/' + id);
  closeDialog(); toast('Studente eliminato'); await reload();
}

// ---------------------------------------------------------------- PAGAMENTI (CALENDARIO RETTE)
function payMap() { const m = {}; S.payments.forEach(p => { m[p.studentId + '|' + p.mese] = p; }); return m; }

function viewPagamenti() {
  const months = getSchoolMonths();
  const cur = today().slice(0, 7);
  const pm = payMap();
  const studs = sorted(S.students).filter(s => s.stato === 'Attivo' || months.some(m => pm[s.id + '|' + m]));
  const tot = Object.fromEntries(months.map(m => [m, 0]));
  let totAnno = 0;

  const rows = studs.map(s => `<tr>
    <td class="sticky"><b>${esc(fullName(s))}</b><div class="muted small">${esc(s.strumento)} · ${euro(s.retta)}</div></td>
    ${months.map(m => {
      const p = pm[s.id + '|' + m];
      if (p) {
        tot[m] += p.importo; totAnno += p.importo;
        return `<td class="cell paid" data-act="pay-view" data-id="${p.id}" title="Ricevuta n. ${p.numero}/${p.anno} del ${dataIt(p.data)} – ${esc(p.metodo)}">${euro(p.importo)}<small>n. ${p.numero}${p.emailInviata ? ' · ✉' : ''}</small></td>`;
      }
      if (s.stato !== 'Attivo') return '<td class="cell none"></td>';
      const late = m <= cur;
      return `<td class="cell ${late ? 'due' : 'todo'}" data-act="pay-new" data-sid="${s.id}" data-mese="${m}" title="Registra pagamento ${meseLabel(m)}">${late ? 'Da pagare' : '+'}</td>`;
    }).join('')}
  </tr>`).join('');

  const attivi = sorted(S.students.filter(s => s.stato === 'Attivo'));
  const incassatoMese = S.payments.filter(p => p.mese === cur).reduce((a, p) => a + p.importo, 0);
  const mancanti = attivi.filter(s => !pm[s.id + '|' + cur]);
  const daIncassare = mancanti.reduce((a, s) => a + Number(s.retta || 0), 0);

  return `
  <div class="toolbar">
    <h2>Rette mensili <span class="muted small">· Anno scolastico: <b>${schoolYearLabel()}</b></span></h2>
    <span class="spacer"></span>
    <span class="muted small">Clicca su una casella per registrare un pagamento o aprire la ricevuta</span>
  </div>
  ${months.includes(cur) ? `
  <div class="stats">
    <div class="stat"><div class="k">Incassato ${meseLabel(cur)}</div><div class="v ok">${euro(incassatoMese)}</div>
      <div class="names">${attivi.length - mancanti.length} su ${attivi.length} studenti attivi</div></div>
    <div class="stat"><div class="k">Da incassare ${meseLabel(cur)}</div><div class="v ${mancanti.length ? 'due' : 'ok'}">${euro(daIncassare)}</div>
      <div class="names">${mancanti.length ? mancanti.map(s => esc(fullName(s))).join(', ') : 'Tutti in regola 🎉'}</div></div>
    <div class="stat"><div class="k">Totale incassato anno scolastico</div><div class="v">${euro(totAnno)}</div>
      <div class="names">${S.payments.filter(p => months.includes(p.mese)).length} rette registrate</div></div>
  </div>` : `
  <div class="info-banner">
    Il mese corrente (${meseLabel(cur)}) non è compreso nell'anno scolastico configurato (${schoolYearLabel()}). Puoi modificare le date nelle <b>Impostazioni</b>.
  </div>`}
  <div class="card"><table class="tbl grid-pay">
    <thead><tr><th class="sticky">Allievo</th>${months.map(m => `<th>${MESI[Number(m.slice(5)) - 1].slice(0, 3)}<br><span class="muted">${m.slice(0, 4)}</span></th>`).join('')}</tr></thead>
    <tbody>${rows || `<tr><td colspan="${months.length + 1}" class="empty">Nessuno studente attivo</td></tr>`}</tbody>
    <tfoot><tr><td class="sticky">Totale</td>${months.map(m => `<td class="num" style="text-align:center">${tot[m] ? euro(tot[m]) : '–'}</td>`).join('')}</tr></tfoot>
  </table></div>`;
}

function paymentNewDialog(sid, mese) {
  const s = studentById(sid);
  const months = getSchoolMonths();
  const canMail = !!s.email && smtpOk();
  openDialog({
    title: 'Registra pagamento retta',
    body: `
    <p class="lead">${esc(fullName(s))} <span class="muted">· ${esc(s.strumento)}</span></p>
    <div class="grid2">
      <label>Mese di competenza<select name="mese">${months.map(m => opt(m, mese, meseLabel(m))).join('')}</select></label>
      ${field('Importo (€)', 'importo', s.retta, 'type="number" step="0.01" min="0.01" required')}
      ${field('Data pagamento', 'data', today(), 'type="date" required')}
      <label>Metodo<select name="metodo">${METODI.map(x => opt(x, 'Contanti')).join('')}</select></label>
    </div>
    ${field('Note (facoltative)', 'note', '')}
    <label class="check"><input type="checkbox" name="inviaEmail" ${canMail ? 'checked' : 'disabled'}>
      <span>Invia ricevuta via email ${s.email ? `a <b>${esc(s.email)}</b>` : '<span class="muted">(nessuna email in anagrafica)</span>'}
      ${s.email && !smtpOk() ? '<span class="warn"> — configura prima l\'email nelle Impostazioni</span>' : ''}</span></label>`,
    actions: `<span class="spacer"></span><button type="button" class="btn" data-close>Annulla</button>
      <button class="btn" value="save">Salva</button><button class="btn primary" value="print">Salva e stampa</button>`,
    onSubmit: async (data, action) => {
      const r = await api('POST', '/api/payments', { ...data, studentId: sid, inviaEmail: !!data.inviaEmail });
      closeDialog();
      if (action === 'print') openReceipt(r.payment.id, true);
      toast(`Pagamento registrato · ricevuta n. ${r.payment.numero}/${r.payment.anno}`);
      if (r.emailResult) {
        if (r.emailResult.ok) toast('Ricevuta inviata via email ✉');
        else toast('Email non inviata: ' + r.emailResult.error, 'err');
      }
      await reload();
    },
  });
}

function paymentViewDialog(id) {
  const p = paymentById(id), s = studentById(p.studentId);
  openDialog({
    title: `Ricevuta n. ${p.numero}/${p.anno}`,
    body: `
    <p class="lead">${esc(fullName(s))} <span class="muted">· retta ${meseLabel(p.mese)}</span></p>
    <div class="grid2">
      ${field('Importo (€)', 'importo', p.importo, 'type="number" step="0.01" min="0.01" required')}
      ${field('Data pagamento', 'data', p.data, 'type="date" required')}
      <label>Metodo<select name="metodo">${[...new Set([...METODI, p.metodo])].map(x => opt(x, p.metodo)).join('')}</select></label>
      ${field('Note', 'note', p.note)}
    </div>
    <p class="muted small">${p.emailInviata
      ? `✉ Inviata via email a ${esc(p.emailInviata.to)} il ${new Date(p.emailInviata.data).toLocaleString('it-IT')}`
      : 'Ricevuta non ancora inviata via email.'}</p>`,
    actions: `<button type="button" class="btn danger" data-act="pay-delete" data-id="${p.id}">Elimina</button>
      <span class="spacer"></span>
      <button type="button" class="btn" data-act="receipt-print" data-id="${p.id}">🖨 Stampa</button>
      <button type="button" class="btn" data-act="receipt-email" data-id="${p.id}">✉ Invia email</button>
      <button class="btn primary">Salva modifiche</button>`,
    onSubmit: async data => { await api('PUT', '/api/payments/' + p.id, data); closeDialog(); toast('Pagamento aggiornato'); await reload(); },
  });
}

async function paymentDelete(id) {
  const p = paymentById(id), s = studentById(p.studentId);
  if (!confirm(`Eliminare il pagamento di ${fullName(s)} per ${meseLabel(p.mese)} (ricevuta n. ${p.numero}/${p.anno})?`)) return;
  await api('DELETE', '/api/payments/' + id);
  closeDialog(); toast('Pagamento eliminato'); await reload();
}

async function receiptEmail(id) {
  const p = paymentById(id);
  if (!p) { toast('Ricevuta non trovata', 'err'); return; }
  const s = studentById(p.studentId);
  if (!smtpOk()) {
    toast('Configura prima l\'invio email nella sezione Impostazioni', 'err');
    return;
  }

  const studNome = s ? fullName(s) : 'Allievo';
  const defaultEmail = (s && s.email) ? s.email.trim() : '';

  const bodyHtml = `
    <div style="background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin-bottom:16px;">
      <div style="font-weight:700;font-size:15px;color:var(--ink);">${esc(studNome)}</div>
      <div class="muted small" style="margin-top:3px;">
        Ricevuta n. <b>${p.numero}/${p.anno}</b> · Retta <b>${meseLabel(p.mese)}</b> · Importo <b>${p.importo} €</b>
      </div>
    </div>
    <label for="prompt-input" style="display:block;font-weight:600;font-size:13.5px;margin-bottom:6px;color:var(--ink);">
      Indirizzo email destinatario *
    </label>
    <input type="email" id="prompt-input" name="promptVal" value="${esc(defaultEmail)}" placeholder="es. genitore@email.com" required style="width:100%;font-size:15px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;box-sizing:border-box;">
    <div class="muted small" style="margin-top:6px;">
      ${defaultEmail ? 'Indirizzo recuperato dalla scheda allievo. Puoi confermarlo o modificarlo.' : '⚠️ Nessun indirizzo email salvato nella scheda allievo. Inseriscilo per questo invio.'}
    </div>
    ${s && !defaultEmail ? `
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;cursor:pointer;color:var(--ink);">
        <input type="checkbox" id="receipt-save-student-email" checked> Salva questo indirizzo anche nella scheda di ${esc(studNome)}
      </label>
    ` : ''}
  `;

  const to = await asyncPrompt({
    title: `Invia ricevuta n. ${p.numero}/${p.anno}`,
    bodyHtml,
    confirmText: 'Invia Email',
    confirmIcon: '✉',
    required: true
  });

  if (!to || !to.trim()) return;
  const destEmail = to.trim();

  const saveCheck = $('#receipt-save-student-email');
  if (s && !s.email && saveCheck && saveCheck.checked) {
    try {
      await api('PUT', '/api/students/' + s.id, { ...s, email: destEmail });
      s.email = destEmail;
    } catch (_) {}
  }

  closeDialog();
  toast('Invio ricevuta in corso…');
  try {
    await api('POST', `/api/payments/${id}/email`, { to: destEmail });
    toast(`Ricevuta n. ${p.numero}/${p.anno} inviata a ${destEmail} ✉`);
    await reload();
  } catch (err) {
    toast(`Errore invio email: ${err.message}`, 'err');
  }
}

// ---------------------------------------------------------------- PRESENZE (CALENDARIO PRESENZE)
function getStudentRecoveryStats(sid, ym) {
  const { start, end } = schoolYearRange();
  const [y, m] = ym.split('-').map(Number);
  const nDays = new Date(y, m, 0).getDate();
  const firstDay = `${ym}-01`;
  const lastDay = `${ym}-${pad(nDays)}`;

  let daRecPrec = 0, fattiPrec = 0;
  let GCurr = 0, RCurr = 0, RECCurr = 0;

  for (const [k, v] of Object.entries(S.attendance || {})) {
    const [stId, dt] = k.split('|');
    if (stId !== sid) continue;
    if (start && dt < start) continue;
    if (end && dt > end) continue;

    if (dt < firstDay) {
      if (v === 'G' || v === 'R') daRecPrec++;
      if (v === 'REC') fattiPrec++;
    } else if (dt <= lastDay) {
      if (v === 'G') GCurr++;
      else if (v === 'R') RCurr++;
      else if (v === 'REC') RECCurr++;
    }
  }

  (S.recoveries || []).forEach(r => {
    if (r.studentId !== sid || r.stato === 'ANNULLATO') return;
    if (start && r.date < start) return;
    if (end && r.date > end) return;

    if (r.date < firstDay) {
      if (S.attendance[`${sid}|${r.date}`] !== 'REC') fattiPrec++;
    } else if (r.date <= lastDay) {
      if (S.attendance[`${sid}|${r.date}`] !== 'REC') RECCurr++;
    }
  });

  const residuoPrec = Math.max(0, daRecPrec - fattiPrec);
  const daRecMese = GCurr + RCurr;
  const totDaRec = residuoPrec + daRecMese;
  const saldo = Math.max(0, totDaRec - RECCurr);

  return { residuoPrec, daRecMese, totDaRec, RECCurr, saldo, GCurr, RCurr };
}

function countStudentPendingRecoveries(sid) {
  const ym = ui?.presMese || today().slice(0, 7);
  return getStudentRecoveryStats(sid, ym).saldo;
}

function viewPresenze() {
  const [y, m] = ui.presMese.split('-').map(Number);
  const nDays = new Date(y, m, 0).getDate();
  const studs = sorted(S.students.filter(s => s.stato === 'Attivo'));
  const wds = new Set(studs.map(s => WD[s.giorno]).filter(x => x !== undefined));
  const recs = S.recoveries || [];
  const recDates = new Set(recs.map(r => r.date));
  const attDates = new Set();
  for (const [k, v] of Object.entries(S.attendance || {})) {
    if (!v) continue;
    const dt = k.split('|')[1];
    if (dt && dt.startsWith(ui.presMese + '-')) attDates.add(dt);
  }
  const cols = [];
  for (let d = 1; d <= nDays; d++) {
    const dt = new Date(y, m - 1, d);
    const dateStr = ymd(dt);
    if (!wds.size || wds.has(dt.getDay()) || recDates.has(dateStr) || attDates.has(dateStr)) {
      cols.push({ date: dateStr, d, wd: dt.getDay() });
    }
  }
  const closed = new Set(S.closures);
  const t = today();

  const rows = studs.map(s => {
    let P = 0, A = 0, G = 0, R = 0, REC = 0;
    const cells = cols.map(c => {
      const out = isOutOfSchoolYear(c.date);
      if (out) return '<td class="pc out-of-year" title="Giorno non compreso nell\'anno scolastico">–</td>';
      if (closed.has(c.date)) return '<td class="pc closed">–</td>';

      const rawV = S.attendance[s.id + '|' + c.date] || '';
      const rec = recs.find(r => r.studentId === s.id && r.date === c.date && r.stato !== 'ANNULLATO');
      const isLessonDay = WD[s.giorno] === c.wd;

      // Presenze di recupero con la stessa data della presenza normale:
      // la presenza normale deve essere contrassegnata da P senza modificare il recupero programmato.
      const v = (isLessonDay && rec && (!rawV || rawV === 'REC')) ? 'P' : rawV;

      // Se non è il giorno di lezione dell'allievo e non c'è una presenza o recupero inserito:
      if (!isLessonDay && !v && !rec) {
        return `<td class="pc off" data-act="att" data-sid="${s.id}" data-date="${c.date}" title="Giorno non consueto (clicca per segnare)"></td>`;
      }

      if (v === 'P') P++;
      else if (v === 'A') A++;
      else if (v === 'G') G++;
      else if (v === 'R') R++;

      // Anche il recupero effettuato conta come presenza!
      if (rec) {
        REC++;
        P++;
      } else if (!isLessonDay && v === 'REC') {
        REC++;
        P++;
      }

      // CASO 1: RECUPERO PROGRAMMATO NELLO STESSO GIORNO DELLA LEZIONE ORDINARIA
      // La presenza ordinaria è contrassegnata da P (o altra segnatura ordinaria) + badge REC
      if (isLessonDay && rec) {
        const cls = PRES[v]?.cls || 'p';
        const lbl = PRES[v]?.label || 'Presente';
        const recTip = `Recupero: ${esc(rec.orario || s.orario)}${rec.note ? ` (${esc(rec.note)})` : ''}`;
        const mainTip = `Presenza ordinaria: ${lbl} · ${recTip} (Clicca su ${v} per cambiare presenza ordinaria, clicca su REC per dettagli recupero)`;
        return `<td class="pc pc-both" title="${mainTip}">
          <div class="pc-both-container">
            <span class="badge-val ${cls}" data-act="att" data-sid="${s.id}" data-date="${c.date}" title="Presenza ordinaria: ${lbl} (clicca per cambiare)">${v}</span>
            <span class="badge-rec-pill" data-act="rec-view" data-id="${rec.id}" title="${recTip} (clicca per modificare o eliminare)">REC</span>
          </div>
        </td>`;
      }

      // CASO 2: SOLO RECUPERO (es. giorno non consueto)
      if (rec) {
        const recTip = `Lezione di recupero: ${esc(rec.orario || s.orario)}${rec.note ? ` (${esc(rec.note)})` : ''}`;
        return `<td class="pc rec" data-act="rec-view" data-id="${rec.id}" title="${recTip} (clicca per dettagli o modifiche)">
          <span class="badge-rec-pill" data-act="rec-view" data-id="${rec.id}">REC</span>
        </td>`;
      }

      // CASO 3: SOLO PRESENZA/ASSENZA ORDINARIA (O CELLA VUOTA DEL GIORNO)
      const cls = v ? (PRES[v]?.cls || '') : '';
      const lbl = v ? (PRES[v]?.label || v) : 'Casella vuota';
      const tooltip = `${lbl} · Clicca: Vuoto → P → A → G → R → Vuoto`;
      return `<td class="pc ${cls}" data-act="att" data-sid="${s.id}" data-date="${c.date}" title="${tooltip}">${v}</td>`;
    }).join('');

    const stats = getStudentRecoveryStats(s.id, ui.presMese);
    let recHtml = '0';
    if (stats.saldo > 0) {
      const parts = [];
      if (stats.residuoPrec > 0) parts.push(`${stats.residuoPrec} prec.`);
      if (stats.daRecMese > 0) parts.push(`${stats.daRecMese} mese`);
      const sub = parts.length > 0 ? `<div class="muted small" style="font-size:10px">${parts.join(' + ')}${stats.RECCurr > 0 ? ` · ${stats.RECCurr} fat.` : ''}</div>` : '';
      const tooltip = `${stats.saldo} da recuperare (${stats.residuoPrec > 0 ? `${stats.residuoPrec} riportate dai mesi prec., ` : ''}${stats.daRecMese} questo mese${stats.RECCurr > 0 ? `, ${stats.RECCurr} recuperata/e` : ''})`;
      recHtml = `<span class="badge-rec-da" title="${esc(tooltip)}">${stats.saldo} da rec.${sub}</span>`;
    } else if (stats.RECCurr > 0) {
      recHtml = `<span class="badge-rec-ok" title="${stats.RECCurr} lezione/i di recupero svolte questo mese">${stats.RECCurr} rec.<div class="muted small" style="font-size:10px">azzerato</div></span>`;
    }

    return `<tr><td class="sticky"><b>${esc(fullName(s))}</b><div class="muted small">${esc(s.giorno)} ${esc(s.orario)} · ${esc(s.strumento)}</div></td>
      ${cells}<td class="num">${P}</td><td class="num">${A}</td><td class="num">${recHtml}</td></tr>`;
  }).join('');

  return `
  <div class="toolbar">
    <h2>Calendario presenze</h2>
    <span class="muted small">· Anno scolastico: <b>${schoolYearLabel()}</b></span>
    <span class="spacer"></span>
    <div class="month-nav">
      <button class="btn icon" data-act="month" data-delta="-1" title="Mese precedente">‹</button>
      <strong>${meseLabel(ui.presMese)}</strong>
      <button class="btn icon" data-act="month" data-delta="1" title="Mese successivo">›</button>
      <button class="btn small" data-act="month" data-delta="0">Oggi</button>
    </div>
    <button class="btn" type="button" data-act="weekly-schedule-open" style="font-weight:700;">📋 Orario &amp; Presenze Settimana</button>
    <button class="btn primary" type="button" data-act="rec-new">➕ Inserisci recupero a calendario</button>
    <button class="btn" type="button" data-act="presenze-print">🖨 Stampa foglio presenze mensile</button>
  </div>
  <div class="card"><table class="tbl grid-att">
    <thead><tr><th class="sticky">Allievo</th>
      ${cols.map(c => {
        const out = isOutOfSchoolYear(c.date);
        return `<th class="day ${closed.has(c.date) ? 'closed' : ''} ${c.date === t ? 'today' : ''} ${out ? 'out-of-year' : ''}"
          ${out ? '' : `data-act="day-menu" data-date="${c.date}"`}
          title="${out ? 'Fuori anno scolastico' : 'Opzioni per questo giorno'}">
          ${WD_SHORT[c.wd]}<br><b>${c.d}</b>
        </th>`;
      }).join('')}
      <th class="num" title="Presenze totali effettuate (lezioni ordinarie + recuperi svolti)">Pres.</th>
      <th class="num" title="Assenze ingiustificate">Ass.</th>
      <th class="num" title="Recuperi: lezioni da recuperare (G: allievo, R: maestro) ed effettuate (REC)">Rec.</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="${cols.length + 4}" class="empty">Nessuno studente attivo</td></tr>`}</tbody>
  </table></div>
  <div class="legend">
    <span class="p" data-l="P">Presente</span><span class="a" data-l="A">Assente</span><span class="g" data-l="G">Assenza da recuperare</span><span class="r" data-l="R">Lezione da recuperare (assenza maestro)</span><span class="rec" data-l="REC">Lezione di recupero</span>
    <span style="display:inline-flex;align-items:center;gap:4px;font-weight:700;color:#0284c7;"><span class="badge-val p" style="min-width:18px;height:20px;font-size:11px;">P</span>+<span class="badge-rec-pill" style="font-size:9px;padding:1px 4px;">REC</span> Presenza + Recupero stessa giornata</span>
    <span>· Clicca sulla lettera per cambiare presenza ordinaria (Vuoto → P → A → G → R) · Clicca su <b>REC</b> per modificare il recupero</span>
  </div>`;
}

async function toggleAtt(sid, date) {
  if (isOutOfSchoolYear(date)) { toast('Questo giorno è fuori dall\'anno scolastico configurato', 'err'); return; }
  const k = sid + '|' + date;
  const current = S.attendance[k] || '';
  const s = studentById(sid);
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  const isLessonDay = s && WD[s.giorno] === wd;
  const rec = (S.recoveries || []).find(r => r.studentId === sid && r.date === date && r.stato !== 'ANNULLATO');

  let v;
  if (isLessonDay && rec) {
    // Nel giorno ordinario con recupero, la presenza ordinaria cicla tra P, A, G, R (non deve mai diventare REC)
    const NEXT_SAME_DAY = { '': 'P', 'REC': 'P', P: 'A', A: 'G', G: 'R', R: 'P' };
    const curVal = (!current || current === 'REC') ? 'P' : current;
    v = NEXT_SAME_DAY[curVal] || 'P';
  } else {
    v = NEXT[current] !== undefined ? NEXT[current] : '';
  }
  if (v) {
    S.attendance[k] = v;
  } else {
    delete S.attendance[k];
  }
  render();
  try {
    await api('PUT', '/api/attendance', { studentId: sid, date, value: v });
  } catch (e) {
    toast(e.message, 'err');
    await reload();
  }
}

function dayMenu(date) {
  if (isOutOfSchoolYear(date)) { toast('Giorno fuori dall\'anno scolastico', 'err'); return; }
  const isClosed = S.closures.includes(date);
  const [y, m, d] = date.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  openDialog({
    title: label.charAt(0).toUpperCase() + label.slice(1),
    body: `<div class="menu-list">
      ${isClosed ? '' : '<button type="button" class="btn" data-act="day-set" data-date="' + date + '" data-value="P">✅ Segna tutti presenti</button>'}
      ${isClosed ? '' : '<button type="button" class="btn" data-act="day-set" data-date="' + date + '" data-value="">🧹 Cancella le segnature del giorno</button>'}
      <button type="button" class="btn" data-act="day-close" data-date="${date}" data-closed="${isClosed ? '' : '1'}">
        ${isClosed ? '🔓 Riapri il giorno (non più chiuso)' : '🚫 Segna come giorno di chiusura (festività, vacanze…)'}</button>
    </div>`,
    actions: '<span class="spacer"></span><button type="button" class="btn" data-close>Chiudi</button>',
  });
}

function recoveryDialog(prefill = {}) {
  const studs = sorted(S.students.filter(s => s.stato === 'Attivo'));
  if (!studs.length) { toast('Nessuno studente attivo disponibile', 'err'); return; }
  const sid = prefill.studentId || studs[0].id;
  const selStudent = studentById(sid) || studs[0];
  const { start, end } = schoolYearRange();
  const defaultDate = prefill.date || (ui.presMese ? `${ui.presMese}-01` : today());
  const dateVal = (defaultDate < start ? start : (defaultDate > end ? end : defaultDate));
  const orarioVal = prefill.orario || selStudent?.orario || '';

  const dlg = openDialog({
    title: '➕ Inserisci lezione di recupero a calendario',
    body: `
      <label>Allievo che effettua il recupero
        <select name="studentId" id="rec-dlg-student" required>
          ${studs.map(s => {
            const p = countStudentPendingRecoveries(s.id);
            const badge = p > 0 ? ` [${p} da recuperare]` : '';
            return opt(s.id, sid, `${fullName(s)} · ${s.strumento} (${s.giorno} ${s.orario})${badge}`);
          }).join('')}
        </select>
      </label>
      <div class="grid2">
        ${field('Data del recupero', 'date', dateVal, `type="date" min="${start}" max="${end}" required id="rec-dlg-date"`)}
        ${field('Orario della lezione', 'orario', orarioVal, 'placeholder="es. 16:00 – 16:45" id="rec-dlg-orario"')}
      </div>
      <label>Al posto di un allievo assente? (facoltativo)
        <select name="sostituisceStudentId" id="rec-dlg-sostituisce">
          <option value="">-- Nessuno in particolare / Recupero autonomo --</option>
          ${studs.map(s => opt(s.id, prefill.sostituisceStudentId || '', `${fullName(s)} · ${s.strumento} (${s.giorno} ${s.orario})`)).join('')}
        </select>
      </label>
      ${field('Note / Motivo', 'note', prefill.note || '', 'placeholder="es. Al posto di allievo assente o assenza maestro" id="rec-dlg-note"')}`,
    actions: `
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Annulla</button>
      <button class="btn primary">💾 Salva a calendario</button>
    `,
    onSubmit: async data => {
      if (isOutOfSchoolYear(data.date)) {
        toast('La data selezionata è fuori dall\'anno scolastico configurato', 'err');
        return;
      }
      await api('POST', '/api/recoveries', data);
      closeDialog();
      toast(`Lezione di recupero fissata per il ${dataIt(data.date)}`);
      await reload();
    },
  });

  const stSel = $('#rec-dlg-student', dlg);
  const sostSel = $('#rec-dlg-sostituisce', dlg);
  const orarioInp = $('#rec-dlg-orario', dlg);
  const noteInp = $('#rec-dlg-note', dlg);

  if (sostSel) {
    sostSel.addEventListener('change', () => {
      const absentStud = studentById(sostSel.value);
      if (absentStud) {
        if (absentStud.orario && orarioInp) orarioInp.value = absentStud.orario;
        if (noteInp && (!noteInp.value || noteInp.value.startsWith('Al posto di '))) {
          noteInp.value = `Al posto di ${fullName(absentStud)} (assente)`;
        }
      }
    });
  }
}

function recoveryViewDialog(recId) {
  const rec = (S.recoveries || []).find(r => r.id === recId);
  if (!rec) { toast('Recupero non trovato', 'err'); return; }
  const s = studentById(rec.studentId);
  const studs = sorted(S.students.filter(x => x.stato === 'Attivo'));
  const { start, end } = schoolYearRange();

  const dlg = openDialog({
    title: `Lezione di recupero · ${esc(s ? fullName(s) : 'Allievo')}`,
    body: `
      <div class="muted small" style="margin-bottom:14px">
        Allievo che recupera: <b>${esc(s ? fullName(s) : '')}</b> · ${esc(s ? s.strumento : '')} (Orario consueto: ${esc(s ? s.giorno + ' ' + s.orario : '')})
      </div>
      <div class="grid2">
        ${field('Data del recupero', 'date', rec.date, `type="date" min="${start}" max="${end}" required`)}
        ${field('Orario', 'orario', rec.orario || '', 'placeholder="es. 16:00 – 16:45" id="rec-edit-orario"')}
      </div>
      <label>Al posto di un allievo assente? (facoltativo)
        <select name="sostituisceStudentId" id="rec-edit-sostituisce">
          <option value="">-- Nessuno in particolare / Recupero autonomo --</option>
          ${studs.map(x => opt(x.id, rec.sostituisceStudentId || '', `${fullName(x)} · ${x.strumento} (${x.giorno} ${x.orario})`)).join('')}
        </select>
      </label>
      ${field('Note / Motivo', 'note', rec.note || '', 'placeholder="es. Al posto di allievo assente o assenza maestro" id="rec-edit-note"')}`,
    actions: `
      <button type="button" class="btn danger" data-act="rec-del" data-id="${rec.id}">🗑️ Elimina dal calendario</button>
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Chiudi</button>
      <button class="btn primary">💾 Salva modifiche</button>
    `,
    onSubmit: async data => {
      if (isOutOfSchoolYear(data.date)) {
        toast('Data fuori dall\'anno scolastico', 'err');
        return;
      }
      await api('PUT', `/api/recoveries/${rec.id}`, data);
      closeDialog();
      toast('Lezione di recupero aggiornata');
      await reload();
    }
  });

  const sostSel = $('#rec-edit-sostituisce', dlg);
  const orarioInp = $('#rec-edit-orario', dlg);
  const noteInp = $('#rec-edit-note', dlg);

  if (sostSel) {
    sostSel.addEventListener('change', () => {
      const absentStud = studentById(sostSel.value);
      if (absentStud) {
        if (absentStud.orario && orarioInp && !orarioInp.value) orarioInp.value = absentStud.orario;
        if (noteInp && (!noteInp.value || noteInp.value.startsWith('Al posto di '))) {
          noteInp.value = `Al posto di ${fullName(absentStud)} (assente)`;
        }
      }
    });
  }
}

// ---------------------------------------------------------------- PROSPETTO ORARIO & PRESENZE SETTIMANALI
const GIORNI_SETT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

function dataEstesa(dStr) {
  if (!dStr) return '';
  const [y, m, d] = dStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${GIORNI_SETT[dt.getDay()]} ${d} ${MESI[m - 1]} ${y}`;
}

function getMondayOfDate(dStr) {
  const [y, m, d] = (dStr || today()).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return ymd(dt);
}

function getSundayOfWeek(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 6);
  return ymd(dt);
}

function getWeekDates(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    dates.push(ymd(cur));
  }
  return dates;
}

function shiftWeek(weekStart, deltaWeeks) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaWeeks * 7);
  return ymd(dt);
}

function parseTimeMinutes(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatMinutesToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${pad(h)}:${pad(m)}`;
}

function makeSlotRange(startMins, duration = 45) {
  const endMins = startMins + duration;
  return `${formatMinutesToTime(startMins)} – ${formatMinutesToTime(endMins)}`;
}

function isAutoMoveNote(n) {
  return /^(Anticipato|Posticipato)\b/i.test(String(n || '').trim());
}

function updateSlotStatusAndNote(slot, dStr) {
  if (!slot || slot.stato === 'ASSENTE' || slot.tipo === 'recupero' || slot.stato === 'RECUPERO') return;
  const currentStartMins = parseTimeMinutes(slot.orario);
  if (currentStartMins === null) return;

  let wdIndex = null;
  if (dStr) {
    const [y, m, d] = dStr.split('-').map(Number);
    wdIndex = new Date(y, m - 1, d).getDay();
  }

  const stud = (S?.students || []).find(x => x.id === slot.studentId);
  const isRegularDay = stud && wdIndex !== null && WD[stud.giorno] === wdIndex;
  const regStartMins = (isRegularDay && stud.orario) ? parseTimeMinutes(stud.orario) : null;

  if (regStartMins !== null) {
    const regTimeStr = formatMinutesToTime(regStartMins);
    if (currentStartMins === regStartMins) {
      if (slot.stato === 'SPOSTATO') slot.stato = 'CONFERMATO';
      if (slot.note && (isAutoMoveNote(slot.note))) {
        slot.note = '';
      }
    } else if (currentStartMins < regStartMins) {
      slot.stato = 'SPOSTATO';
      if (!slot.note || isAutoMoveNote(slot.note)) {
        slot.note = `Anticipato (era ${regTimeStr})`;
      }
    } else {
      slot.stato = 'SPOSTATO';
      if (!slot.note || isAutoMoveNote(slot.note)) {
        slot.note = `Posticipato (era ${regTimeStr})`;
      }
    }
  }
}

function compactDaySlots(slots, dStr = null, defaultStartMins = null, duration = 45) {
  if (!Array.isArray(slots) || !slots.length) return slots;

  let wdIndex = null;
  if (dStr) {
    const [y, m, d] = dStr.split('-').map(Number);
    wdIndex = new Date(y, m - 1, d).getDay();
  }

  // Cerca il primo orario consueto tra gli allievi regolari del giorno nella scuola
  let baseStart = null;
  if (wdIndex !== null && S?.students) {
    const dayRegularStuds = S.students.filter(s => s.stato === 'Attivo' && WD[s.giorno] === wdIndex);
    for (const st of dayRegularStuds) {
      const tm = parseTimeMinutes(st.orario);
      if (tm !== null) {
        if (baseStart === null || tm < baseStart) baseStart = tm;
      }
    }
  }

  // Se non trovato, cerca tra gli slot confermati del giorno
  if (baseStart === null) {
    for (const s of slots) {
      if (s.stato === 'ASSENTE') continue;
      const tm = parseTimeMinutes(s.orario);
      if (tm !== null) {
        if (baseStart === null || tm < baseStart) baseStart = tm;
      }
    }
  }

  // Fallback: 16:00 nei feriali (960 min), 09:00 il sabato (540 min)
  if (baseStart === null) {
    baseStart = defaultStartMins || (wdIndex === 6 ? 540 : 960);
  }

  let currentMins = baseStart;

  const confirmed = [];
  const absents = [];

  for (const s of slots) {
    if (s.stato === 'ASSENTE') {
      absents.push(s);
    } else {
      confirmed.push(s);
    }
  }

  confirmed.forEach((s) => {
    const oldOrario = s.orario;
    const newOrario = makeSlotRange(currentMins, duration);
    const newStartMins = currentMins;
    s.orario = newOrario;
    currentMins += duration;

    // Se è un recupero, mantieni lo stato RECUPERO e la sua nota originaria
    if (s.tipo === 'recupero' || s.stato === 'RECUPERO') {
      s.stato = 'RECUPERO';
      if (!s.note) s.note = 'Recupero assenza';
      return;
    }

    // Cerca l'allievo nella scuola per conoscerne il consueto orario
    const stud = (S?.students || []).find(x => x.id === s.studentId);
    const isRegularDay = stud && wdIndex !== null && WD[stud.giorno] === wdIndex;
    const regStartMins = (isRegularDay && stud.orario) ? parseTimeMinutes(stud.orario) : null;

    if (regStartMins !== null) {
      const regTimeStr = formatMinutesToTime(regStartMins);
      if (newStartMins === regStartMins) {
        if (s.stato === 'SPOSTATO') s.stato = 'CONFERMATO';
        if (s.note && (isAutoMoveNote(s.note))) {
          s.note = '';
        }
      } else if (newStartMins < regStartMins) {
        s.stato = 'SPOSTATO';
        s.note = `Anticipato (era ${regTimeStr})`;
      } else {
        s.stato = 'SPOSTATO';
        s.note = `Posticipato (era ${regTimeStr})`;
      }
    } else {
      // Allievo da altro giorno o senza orario regolare: confronta con oldOrario
      const oldStartMins = parseTimeMinutes(oldOrario);
      if (oldStartMins !== null && oldStartMins !== newStartMins) {
        s.stato = 'SPOSTATO';
        const oldTimeStr = formatMinutesToTime(oldStartMins);
        if (newStartMins < oldStartMins) {
          s.note = `Anticipato (era ${oldTimeStr})`;
        } else {
          s.note = `Posticipato (era ${oldTimeStr})`;
        }
      } else if (oldStartMins !== null && oldStartMins === newStartMins) {
        if (s.stato === 'SPOSTATO') s.stato = 'CONFERMATO';
        if (s.note && (isAutoMoveNote(s.note))) {
          s.note = '';
        }
      }
    }
  });

  absents.forEach((s) => {
    s.stato = 'ASSENTE';
    if (!s.note) s.note = 'Assente (orario liberato)';
  });

  return [...confirmed, ...absents];
}

function pickStudentForSlotDialog(dStr, suggestedTime = '') {
  return new Promise(resolve => {
    const activeStuds = sorted(S.students.filter(s => s.stato === 'Attivo'));
    if (!activeStuds.length) {
      toast('Nessuno studente attivo disponibile', 'err');
      resolve(null);
      return;
    }

    let d = $('#dlg-prompt');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'dlg-prompt';
      d.className = 'dlg-prompt';
      document.body.appendChild(d);
    }
    d.className = 'dlg-prompt';
    d.innerHTML = `
      <form class="dlg-form" method="dialog" novalidate>
        <header>
          <h3>➕ Aggiungi Allievo a ${esc(dataEstesa(dStr))}</h3>
          <button type="button" class="x" data-prompt-close aria-label="Chiudi">×</button>
        </header>
        <div class="dlg-body">
          <label>Seleziona Allievo dalla scuola:
            <select id="pick-stud-id" style="margin-top:6px;width:100%;">
              ${activeStuds.map(s => `<option value="${s.id}">${esc(fullName(s))} · ${esc(s.strumento || '')} (Consueto: ${esc(s.giorno || '')} ${esc(s.orario || '')})</option>`).join('')}
            </select>
          </label>
          <div class="grid2" style="margin-top:12px;">
            <label>Orario Lezione:
              <input type="text" id="pick-stud-time" value="${esc(suggestedTime)}" placeholder="es. 16:00 – 16:45" style="font-weight:700;">
            </label>
            <label>Stato Lezione:
              <select id="pick-stud-stato">
                <option value="CONFERMATO">🟢 Confermato</option>
                <option value="RECUPERO" selected>🔵 Recupero</option>
                <option value="SPOSTATO">🟠 Spostato</option>
                <option value="ASSENTE">🔴 ASSENTE</option>
              </select>
            </label>
          </div>
          <label style="margin-top:12px;">Note:
            <input type="text" id="pick-stud-note" value="Lezione di recupero programmata" placeholder="Note facoltative...">
          </label>
        </div>
        <footer>
          <span class="spacer"></span>
          <button type="button" class="btn" data-prompt-close>Annulla</button>
          <button type="submit" class="btn primary">Aggiungi al giorno</button>
        </footer>
      </form>
    `;

    let finished = false;
    const finish = val => {
      if (finished) return;
      finished = true;
      if (d.open) d.close();
      resolve(val);
    };

    const form = $('form', d);
    const studSel = $('#pick-stud-id', d);
    const timeInp = $('#pick-stud-time', d);
    const statoSel = $('#pick-stud-stato', d);
    const noteInp = $('#pick-stud-note', d);

    if (studSel) {
      studSel.onchange = () => {
        const s = studentById(studSel.value);
        if (s && !suggestedTime && s.orario) {
          timeInp.value = s.orario;
        }
      };
    }

    $$('[data-prompt-close]', d).forEach(b => {
      b.onclick = () => finish(null);
    });

    form.onsubmit = e => {
      e.preventDefault();
      const s = studentById(studSel.value);
      if (!s) { finish(null); return; }
      finish({
        id: Math.random().toString(36).slice(2, 10),
        studentId: s.id,
        nome: fullName(s),
        strumento: s.strumento || '',
        orario: timeInp.value.trim() || s.orario || '',
        stato: statoSel.value,
        tipo: 'manuale',
        note: noteInp.value.trim()
      });
    };

    d.oncancel = e => {
      e.preventDefault();
      finish(null);
    };

    d.showModal();
  });
}

async function openWeeklyScheduleDialog(initialWeekStart = null) {
  let curWeekStart = initialWeekStart || getMondayOfDate(today());
  let currentSchedule = { weekStart: curWeekStart, days: {}, note: '' };
  let isCustom = false;
  let isLoading = true;

  const dlg = openDialog({
    title: '📋 Orario & Presenze Settimana — Sistemazione e Stampa',
    body: `<div id="ws-dialog-content"><p class="loading">Caricamento orario settimanale…</p></div>`,
    actions: `
      <button type="button" class="btn" data-close>Chiudi</button>
      <span class="spacer"></span>
      <button type="button" class="btn" id="ws-btn-save">💾 Salva modifiche</button>
      <button type="button" class="btn primary" id="ws-btn-print" style="font-weight:700;">🖨️ Salva &amp; Stampa Prospetto</button>
    `,
    isWide: true
  });

  const syncInputs = () => {
    if (!currentSchedule || !currentSchedule.days) return;
    $$('.ws-input-orario', dlg).forEach(inp => {
      const d = inp.dataset.date, i = Number(inp.dataset.idx);
      if (currentSchedule.days[d]?.[i]) currentSchedule.days[d][i].orario = inp.value;
    });
    $$('.ws-input-note', dlg).forEach(inp => {
      const d = inp.dataset.date, i = Number(inp.dataset.idx);
      if (currentSchedule.days[d]?.[i]) currentSchedule.days[d][i].note = inp.value;
    });
    const noteInp = $('#weekly-sheet-note', dlg);
    if (noteInp) currentSchedule.note = noteInp.value;
  };

  const renderBody = () => {
    const container = $('#ws-dialog-content', dlg);
    if (!container) return;

    if (isLoading) {
      container.innerHTML = `<p class="loading">Caricamento orario settimanale…</p>`;
      return;
    }

    const curSunday = getSundayOfWeek(curWeekStart);
    const weekTitle = `Settimana ${dataIt(curWeekStart)} – ${dataIt(curSunday)}`;
    const weekDates = getWeekDates(curWeekStart);

    const daysKeys = Object.keys(currentSchedule.days || {}).sort().filter(d => (currentSchedule.days[d] || []).length > 0);

    let totalLessons = 0, confLessons = 0, absLessons = 0, recLessons = 0;
    daysKeys.forEach(d => {
      (currentSchedule.days[d] || []).forEach(slot => {
        totalLessons++;
        if (slot.stato === 'ASSENTE') absLessons++;
        else if (slot.stato === 'RECUPERO') recLessons++;
        else confLessons++;
      });
    });

    container.innerHTML = `
      <div class="weekly-schedule-manager" style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn icon" id="ws-nav-prev" title="Settimana precedente">‹</button>
            <div style="font-weight:800;font-size:15px;color:#0f172a;padding:0 6px;">
              📅 ${esc(weekTitle)}
            </div>
            <button type="button" class="btn icon" id="ws-nav-next" title="Settimana successiva">›</button>
            <button type="button" class="btn small" id="ws-nav-today">Questa settimana</button>
            <input type="date" id="ws-date-picker" value="${curWeekStart}" style="padding:4px 8px;font-size:12px;width:130px;border-radius:6px;border:1px solid #cbd5e1;" title="Scegli qualsiasi data per andare alla settimana">
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${isCustom 
              ? `<span class="badge warn" style="font-size:11px;">✏️ Orario Personalizzato Salvato</span>
                 <button type="button" class="btn small" id="ws-btn-reset" title="Ripristina l'orario standard dal calendario presenze">🔄 Ripristina Default</button>`
              : `<span class="badge ok" style="font-size:11px;">⚡ Generato dal Calendario</span>`
            }
            <button type="button" class="btn primary small" id="ws-btn-compact-all">⚡ Compatta orari (tutta la settimana)</button>
          </div>
        </div>

        <div class="info-banner" style="margin:0;padding:10px 14px;font-size:12.5px;line-height:1.5;">
          💡 <b>Gestione buchi di orario &amp; assenze:</b> Se un allievo è <b>ASSENTE</b>, il pulsante <b>⚡ Compatta orari</b> assegna automaticamente slot consecutivi da 45 min a tutti gli allievi confermati eliminando i buchi. Puoi sempre modificare orari, stati, note o spostare le lezioni con <b>▲ / ▼</b> prima di stampare.
        </div>

        <div style="display:flex;gap:14px;align-items:center;background:#f8fafc;padding:8px 14px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;font-weight:600;">
          <span>Totale lezioni: <b>${totalLessons}</b></span>
          <span style="color:#15803d;">Confermate: <b>${confLessons}</b></span>
          <span style="color:#b91c1c;">Assenti: <b>${absLessons}</b></span>
          <span style="color:#0284c7;">Recuperi: <b>${recLessons}</b></span>
        </div>

        <div class="ws-days-list" style="display:flex;flex-direction:column;gap:18px;">
          ${daysKeys.length ? daysKeys.map(dStr => {
            const slots = currentSchedule.days[dStr] || [];
            const dayName = dataEstesa(dStr).toUpperCase();
            return `
            <div class="card" style="margin:0;padding:0;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
              <div style="display:flex;align-items:center;justify-content:space-between;background:#f8fafc;padding:10px 14px;border-bottom:1px solid #cbd5e1;flex-wrap:wrap;gap:8px;">
                <div>
                  <b style="font-size:13.5px;color:#0f172a;">📅 ${esc(dayName)}</b>
                  <span class="muted small" style="margin-left:8px;">(${slots.length} ${slots.length === 1 ? 'lezione' : 'lezioni'} in programma)</span>
                </div>
                <div style="display:flex;gap:6px;">
                  <button type="button" class="btn small" data-ws-act="compact-day" data-date="${dStr}">⚡ Compatta questo giorno</button>
                  <button type="button" class="btn small primary" data-ws-act="add-slot" data-date="${dStr}">➕ Aggiungi Allievo</button>
                </div>
              </div>
              <table class="tbl" style="margin:0;">
                <thead>
                  <tr>
                    <th style="width:70px;text-align:center;">Ordine</th>
                    <th style="width:145px;">Orario Lezione</th>
                    <th>Allievo &amp; Strumento</th>
                    <th style="width:150px;">Stato</th>
                    <th>Note / Spostamenti</th>
                    <th style="width:40px;text-align:center;"></th>
                  </tr>
                </thead>
                <tbody>
                  ${slots.map((s, idx) => {
                    const isAssente = s.stato === 'ASSENTE';
                    const isRec = s.stato === 'RECUPERO';
                    const isSpostato = s.stato === 'SPOSTATO';
                    const rowBg = isAssente ? '#fff1f2' : (isRec ? '#f0fdf4' : (isSpostato ? '#fffbeb' : '#fff'));
                    return `
                    <tr style="background:${rowBg};" data-date="${dStr}" data-idx="${idx}">
                      <td style="text-align:center;white-space:nowrap;">
                        <button type="button" class="btn icon small" data-ws-act="move-up" data-date="${dStr}" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Sposta su" style="padding:2px 5px;font-size:10px;">▲</button>
                        <button type="button" class="btn icon small" data-ws-act="move-down" data-date="${dStr}" data-idx="${idx}" ${idx === slots.length - 1 ? 'disabled' : ''} title="Sposta giù" style="padding:2px 5px;font-size:10px;">▼</button>
                      </td>
                      <td>
                        <input type="text" class="ws-input-orario" data-date="${dStr}" data-idx="${idx}" value="${esc(s.orario || '')}" placeholder="es. 16:00 – 16:45" style="font-weight:700;font-size:13px;padding:5px 8px;border-radius:6px;width:100%;">
                      </td>
                      <td>
                        <b>${esc(s.nome)}</b>
                        ${s.strumento ? `<span class="tag small" style="margin-left:6px;font-size:11px;">${esc(s.strumento)}</span>` : ''}
                      </td>
                      <td>
                        <select class="ws-select-stato" data-date="${dStr}" data-idx="${idx}" style="font-size:12px;font-weight:600;padding:4px 6px;border-radius:6px;width:100%;">
                          <option value="CONFERMATO" ${s.stato === 'CONFERMATO' ? 'selected' : ''}>🟢 Confermato</option>
                          <option value="ASSENTE" ${s.stato === 'ASSENTE' ? 'selected' : ''}>🔴 ASSENTE</option>
                          <option value="RECUPERO" ${s.stato === 'RECUPERO' ? 'selected' : ''}>🔵 Recupero</option>
                          <option value="SPOSTATO" ${s.stato === 'SPOSTATO' ? 'selected' : ''}>🟠 Spostato</option>
                        </select>
                      </td>
                      <td>
                        <input type="text" class="ws-input-note" data-date="${dStr}" data-idx="${idx}" value="${esc(s.note || '')}" placeholder="Note lezione, motivo assenza o recupero..." style="font-size:12px;padding:5px 8px;border-radius:6px;width:100%;">
                      </td>
                      <td style="text-align:center;">
                        <button type="button" class="btn icon small danger" data-ws-act="del-slot" data-date="${dStr}" data-idx="${idx}" title="Rimuovi da questo giorno" style="padding:3px 6px;">🗑️</button>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`;
          }).join('') : `
            <div class="card empty" style="padding:32px;text-align:center;">
              <p style="margin:0 0 12px 0;color:#64748b;">Nessuna lezione programmata nel database per questa settimana.</p>
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                ${weekDates.slice(4, 6).map(d => `
                  <button type="button" class="btn primary small" data-ws-act="add-day" data-date="${d}">➕ Inizia con ${esc(dataEstesa(d))}</button>
                `).join('')}
              </div>
            </div>
          `}
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;">
          <span class="muted small" style="font-weight:600;">➕ Aggiungi giorno alla settimana:</span>
          ${weekDates.filter(d => !daysKeys.includes(d)).map(d => `
            <button type="button" class="btn small" data-ws-act="add-day" data-date="${d}">${esc(GIORNI_SETT[new Date(d.replace(/-/g, '/')).getDay()])} (${dataIt(d).slice(0, 5)})</button>
          `).join('')}
        </div>

        <div style="margin-top:6px;">
          <label style="font-size:12px;font-weight:600;color:#475569;">Note generali da stampare in calce al foglio settimanale (facoltativo):
            <input type="text" id="weekly-sheet-note" value="${esc(currentSchedule.note || '')}" placeholder="es. Variazioni approvate per venerdì, recuperi autorizzati dalla segreteria...">
          </label>
        </div>
      </div>
    `;

    attachEvents();
  };

  const loadData = async (ws) => {
    isLoading = true;
    curWeekStart = ws;
    renderBody();
    try {
      const res = await api('GET', `/api/weekly-schedule?weekStart=${encodeURIComponent(curWeekStart)}`);
      currentSchedule = res.schedule || { weekStart: curWeekStart, days: {}, note: '' };
      isCustom = !!res.isCustom;
    } catch (e) {
      toast('Errore caricamento settimana: ' + e.message, 'err');
    } finally {
      isLoading = false;
      renderBody();
    }
  };

  const saveCurrentSchedule = async () => {
    syncInputs();
    try {
      const res = await api('POST', '/api/weekly-schedule', {
        weekStart: curWeekStart,
        days: currentSchedule.days,
        note: currentSchedule.note || ''
      });
      isCustom = true;
      toast('✅ Orario settimanale salvato con successo!');
      return res;
    } catch (err) {
      toast('Errore salvataggio orario: ' + err.message, 'err');
      throw err;
    }
  };

  const attachEvents = () => {
    const prev = $('#ws-nav-prev', dlg);
    if (prev) prev.onclick = () => { syncInputs(); loadData(shiftWeek(curWeekStart, -1)); };

    const next = $('#ws-nav-next', dlg);
    if (next) next.onclick = () => { syncInputs(); loadData(shiftWeek(curWeekStart, 1)); };

    const todayBtn = $('#ws-nav-today', dlg);
    if (todayBtn) todayBtn.onclick = () => { syncInputs(); loadData(getMondayOfDate(today())); };

    const picker = $('#ws-date-picker', dlg);
    if (picker) picker.onchange = () => {
      if (picker.value) {
        syncInputs();
        loadData(getMondayOfDate(picker.value));
      }
    };

    const resetBtn = $('#ws-btn-reset', dlg);
    if (resetBtn) resetBtn.onclick = async () => {
      if (!confirm('Vuoi ripristinare la composizione predefinita dell\'orario dal calendario presenze? Le modifiche personalizzate andranno perse.')) return;
      try {
        await api('DELETE', `/api/weekly-schedule?weekStart=${encodeURIComponent(curWeekStart)}`);
        toast('Orario predefinito ripristinato');
        await loadData(curWeekStart);
      } catch (e) {
        toast('Errore ripristino: ' + e.message, 'err');
      }
    };

    const compAllBtn = $('#ws-btn-compact-all', dlg);
    if (compAllBtn) compAllBtn.onclick = () => {
      syncInputs();
      Object.keys(currentSchedule.days || {}).forEach(d => {
        currentSchedule.days[d] = compactDaySlots(currentSchedule.days[d], d);
      });
      renderBody();
      toast('⚡ Orari compattati a 45 min per tutta la settimana! Controlla e salva.');
    };
  };

  dlg.onclick = async e => {
    const actBtn = e.target.closest('[data-ws-act]');
    if (!actBtn) return;
    const act = actBtn.dataset.wsAct;
    const dStr = actBtn.dataset.date;
    const idx = Number(actBtn.dataset.idx);

    syncInputs();

    if (act === 'move-up') {
      const arr = currentSchedule.days[dStr];
      if (arr && idx > 0) {
        const tmp = arr[idx];
        arr[idx] = arr[idx - 1];
        arr[idx - 1] = tmp;
        const o1 = arr[idx - 1].orario;
        const o2 = arr[idx].orario;
        if (o1 && o2 && o1 !== o2) {
          arr[idx - 1].orario = o2;
          arr[idx].orario = o1;
        }
        updateSlotStatusAndNote(arr[idx - 1], dStr);
        updateSlotStatusAndNote(arr[idx], dStr);
        renderBody();
      }
    } else if (act === 'move-down') {
      const arr = currentSchedule.days[dStr];
      if (arr && idx < arr.length - 1) {
        const tmp = arr[idx];
        arr[idx] = arr[idx + 1];
        arr[idx + 1] = tmp;
        const o1 = arr[idx].orario;
        const o2 = arr[idx + 1].orario;
        if (o1 && o2 && o1 !== o2) {
          arr[idx].orario = o2;
          arr[idx + 1].orario = o1;
        }
        updateSlotStatusAndNote(arr[idx], dStr);
        updateSlotStatusAndNote(arr[idx + 1], dStr);
        renderBody();
      }
    } else if (act === 'del-slot') {
      const arr = currentSchedule.days[dStr];
      if (arr) {
        arr.splice(idx, 1);
        renderBody();
        toast('Lezione rimossa');
      }
    } else if (act === 'compact-day') {
      const arr = currentSchedule.days[dStr];
      if (arr && arr.length) {
        currentSchedule.days[dStr] = compactDaySlots(arr, dStr);
        renderBody();
        toast(`⚡ Orari compattati per ${dataEstesa(dStr)}!`);
      }
    } else if (act === 'add-slot') {
      const arr = currentSchedule.days[dStr] || [];
      let lastTimeMins = null;
      if (arr.length) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const tm = parseTimeMinutes(arr[i].orario);
          if (tm !== null) { lastTimeMins = tm + 45; break; }
        }
      }
      const dt = new Date(dStr.replace(/-/g, '/'));
      const defStart = dt.getDay() === 6 ? 9 * 60 : 16 * 60;
      const sugTime = makeSlotRange(lastTimeMins !== null ? lastTimeMins : defStart, 45);

      const newSlot = await pickStudentForSlotDialog(dStr, sugTime);
      if (newSlot) {
        currentSchedule.days[dStr] ||= [];
        currentSchedule.days[dStr].push(newSlot);
        renderBody();
        toast(`Allievo ${newSlot.nome} aggiunto`);
      }
    } else if (act === 'add-day') {
      currentSchedule.days[dStr] ||= [];
      renderBody();
    }
  };

  dlg.onchange = e => {
    const el = e.target;
    if (el.classList.contains('ws-select-stato')) {
      const dStr = el.dataset.date;
      const idx = Number(el.dataset.idx);
      const slot = currentSchedule.days[dStr]?.[idx];
      if (slot) {
        syncInputs();
        slot.stato = el.value;
        if (slot.stato === 'ASSENTE' && !slot.note) slot.note = 'Assente';
        if (slot.stato === 'CONFERMATO' && slot.note && (isAutoMoveNote(slot.note))) {
          slot.note = '';
        }
        if (slot.stato === 'SPOSTATO') {
          updateSlotStatusAndNote(slot, dStr);
        }
        syncInputs();
        renderBody();
      }
    } else if (el.classList.contains('ws-input-orario')) {
      const dStr = el.dataset.date;
      const idx = Number(el.dataset.idx);
      const slot = currentSchedule.days[dStr]?.[idx];
      if (slot) {
        // Prima acquisisce i valori correnti dei campi (note incluse), poi ricalcola stato e nota
        syncInputs();
        slot.orario = el.value;
        updateSlotStatusAndNote(slot, dStr);
        renderBody();
      }
    }
  };

  dlg.oninput = e => {
    const el = e.target;
    if (el.classList.contains('ws-input-orario')) {
      const dStr = el.dataset.date;
      const idx = Number(el.dataset.idx);
      if (currentSchedule.days[dStr]?.[idx]) {
        currentSchedule.days[dStr][idx].orario = el.value;
        updateSlotStatusAndNote(currentSchedule.days[dStr][idx], dStr);
      }
    } else if (el.classList.contains('ws-input-note')) {
      const dStr = el.dataset.date;
      const idx = Number(el.dataset.idx);
      if (currentSchedule.days[dStr]?.[idx]) currentSchedule.days[dStr][idx].note = el.value;
    } else if (el.id === 'weekly-sheet-note') {
      currentSchedule.note = el.value;
    }
  };

  const saveBtn = $('#ws-btn-save', dlg);
  if (saveBtn) saveBtn.onclick = async () => {
    try {
      await saveCurrentSchedule();
      renderBody();
    } catch (_) {}
  };

  const printBtn = $('#ws-btn-print', dlg);
  if (printBtn) printBtn.onclick = async () => {
    const printUrl = `/settimana/stampa?weekStart=${encodeURIComponent(curWeekStart)}&print=1`;
    let printWin = null;
    // Apri subito sul click per aggirare il blocco popup del browser
    if (!window.Android) {
      printWin = window.open('about:blank', '_blank');
    }
    try {
      await saveCurrentSchedule();
      if (window.Android && typeof window.Android.printHtml === 'function' && window.PrintTemplates?.renderWeeklySheetHtml) {
        const html = window.PrintTemplates.renderWeeklySheetHtml(S, curWeekStart, currentSchedule);
        window.Android.printHtml(html, `Orario_Settimana_${curWeekStart}`);
        return;
      }
      if (printWin) {
        printWin.location.href = printUrl;
      } else {
        window.open(printUrl, '_blank');
      }
    } catch (err) {
      if (printWin) printWin.close();
      toast('Errore: ' + err.message, 'err');
    }
  };

  await loadData(curWeekStart);
}

// ---------------------------------------------------------------- RICEVUTE
function viewRicevute() {
  const q = ui.ricSearch.trim().toLowerCase();
  const list = [...S.payments]
    .sort((a, b) => (b.anno - a.anno) || (b.numero - a.numero))
    .map(p => ({ p, s: studentById(p.studentId) }))
    .filter(({ p, s }) => s && (!q || [fullName(s), s.intestatario, meseLabel(p.mese), `${p.numero}/${p.anno}`, p.metodo].join(' ').toLowerCase().includes(q)));
  return `
  <div class="toolbar">
    <h2>Ricevute allievi <span class="muted">· ${S.payments.length}</span></h2>
    <span class="spacer"></span>
    <input id="ric-search" type="search" placeholder="Cerca nome, mese, numero…" value="${esc(ui.ricSearch)}">
  </div>
  <div class="card"><table class="tbl">
    <thead><tr><th>N.</th><th>Data</th><th>Allievo</th><th>Retta di</th><th class="num">Importo</th><th>Metodo</th><th>Liquidazione Maestro</th><th>Email</th><th></th></tr></thead>
    <tbody>${list.map(({ p, s }) => `<tr>
      <td><b>${p.numero}/${p.anno}</b></td>
      <td>${dataIt(p.data)}</td>
      <td>${esc(fullName(s))}${s.intestatario ? `<div class="muted small">${esc(s.intestatario)}</div>` : ''}</td>
      <td>${meseLabel(p.mese)}</td>
      <td class="num">${euro(p.importo)}</td>
      <td>${esc(p.metodo)}</td>
      <td>
        ${p.teacherPaymentId ? `
          <span class="badge ok" title="Incluso nel prospetto di liquidazione n. ${p.teacherPaymentNumero || ''}">✓ Liquidato (Prosp. ${p.teacherPaymentNumero || ''})</span>
        ` : `
          <span class="badge warn" title="Non ancora compreso in nessun prospetto di liquidazione">⏳ Da liquidare</span>
        `}
      </td>
      <td>${p.emailInviata ? `<span class="badge ok" title="${esc(p.emailInviata.to)}">✉ ${new Date(p.emailInviata.data).toLocaleDateString('it-IT')}</span>` : '<span class="muted small">—</span>'}</td>
      <td class="right" style="white-space:nowrap">
        <button class="btn small primary" data-act="receipt-share" data-id="${p.id}" title="Condividi ricevuta">↗ Condividi</button>
        <button class="btn small" data-act="receipt-print" data-id="${p.id}">🖨 Stampa</button>
        <button class="btn small" data-act="receipt-email" data-id="${p.id}">✉ Email</button>
      </td></tr>`).join('') || '<tr><td colspan="9" class="empty">Nessuna ricevuta</td></tr>'}
    </tbody>
  </table></div>`;
}

// ---------------------------------------------------------------- PRIMA NOTA (ENTRATE / USCITE / LIQUIDAZIONI)
function getCashbookEntries() {
  const list = [];
  const studentsMap = Object.fromEntries(S.students.map(s => [s.id, s]));

  // 1. Entrate da pagamenti rette
  (S.payments || []).forEach(p => {
    const s = studentsMap[p.studentId];
    const sName = s ? fullName(s) : 'Allievo';
    list.push({
      id: p.id,
      data: p.data,
      tipo: 'ENTRATA',
      categoria: 'Retta allievo',
      descrizione: `Retta ${meseLabel(p.mese)} - ${sName} (Ric. n. ${p.numero}/${p.anno})`,
      metodo: p.metodo || 'Contanti',
      importo: p.importo,
      entrata: p.importo,
      uscita: 0,
      docTipo: 'studente',
      docId: p.id,
    });
  });

  // 2. Entrate extra
  (S.incomeExtra || []).forEach(ie => {
    list.push({
      id: ie.id,
      data: ie.data,
      tipo: 'ENTRATA',
      categoria: ie.categoria || 'Entrata extra',
      descrizione: ie.descrizione,
      metodo: ie.metodo || 'Contanti',
      importo: ie.importo,
      entrata: ie.importo,
      uscita: 0,
      docTipo: 'income-extra',
      docId: ie.id,
    });
  });

  // 3. Uscite per liquidazioni rette
  (S.teacherPayments || []).forEach(tp => {
    const fatt = tp.fattura && tp.fattura.numero ? ` (Fatt. ${tp.fattura.numero})` : '';
    const imp = tp.importo ?? tp.quotaMaestro ?? 0;
    list.push({
      id: tp.id,
      data: tp.data,
      tipo: 'USCITA',
      categoria: 'Liquidazione rette',
      descrizione: `Liquidazione rette ${meseLabel(tp.mese)}${fatt}`,
      metodo: tp.metodo || 'Bonifico bancario',
      importo: imp,
      entrata: 0,
      uscita: imp,
      docTipo: 'liquidazione',
      docId: tp.id,
    });
  });

  // 4. Uscite per spese generali scuola
  (S.expenses || []).forEach(ex => {
    list.push({
      id: ex.id,
      data: ex.data,
      tipo: 'USCITA',
      categoria: ex.categoria || 'Spese scuola',
      descrizione: ex.descrizione,
      metodo: ex.metodo || 'Contanti',
      importo: ex.importo,
      entrata: 0,
      uscita: ex.importo,
      docTipo: 'expense',
      docId: ex.id,
    });
  });

  // Ordina cronologicamente
  list.sort((a, b) => a.data.localeCompare(b.data));
  return list;
}

function viewPrimaNota() {
  const allEntries = getCashbookEntries();
  const totEntrate = allEntries.reduce((a, x) => a + x.entrata, 0);
  const totUscite = allEntries.reduce((a, x) => a + x.uscita, 0);
  const saldo = totEntrate - totUscite;

  const totLiquidazioni = (S.teacherPayments || []).reduce((a, p) => a + (p.importo ?? p.quotaMaestro ?? 0), 0);
  const totRette = S.payments.reduce((a, p) => a + p.importo, 0);

  const sub = ui.pnSubTab || 'registro';

  return `
  <div class="toolbar">
    <h2>Registro di Prima Nota <span class="muted small">· Anno: ${schoolYearLabel()}</span></h2>
    <span class="spacer"></span>
    <div class="segmented-ctrl">
      <button class="${sub === 'registro' ? 'active' : ''}" data-act="pn-subtab" data-sub="registro">📒 Giornale di Cassa</button>
      <button class="${sub === 'liquidazioni' ? 'active' : ''}" data-act="pn-subtab" data-sub="liquidazioni">🧾 Liquidazioni Rette &amp; Fatture (${(S.teacherPayments || []).length})</button>
      <button class="${sub === 'spese' ? 'active' : ''}" data-act="pn-subtab" data-sub="spese">💸 Spese Generali &amp; Extra</button>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="k">Totale Entrate (Cassa/Banca)</div><div class="v ok">${euro(totEntrate)}</div>
      <div class="names">${euro(totRette)} da rette allievi</div></div>
    <div class="stat"><div class="k">Totale Uscite</div><div class="v due">${euro(totUscite)}</div>
      <div class="names">${euro(totLiquidazioni)} da liquidazioni rette</div></div>
    <div class="stat"><div class="k">Saldo Netto Cassa/Banca</div><div class="v bal">${euro(saldo)}</div>
      <div class="names">Entrate complessive meno uscite</div></div>
    <div class="stat"><div class="k">Rette Incassate Anno</div><div class="v ok">${euro(totRette)}</div>
      <div class="names">Incasso complessivo rette allievi</div></div>
  </div>

  ${sub === 'registro' ? renderPnRegistro(allEntries) : ''}
  ${sub === 'liquidazioni' ? renderPnLiquidazioni() : ''}
  ${sub === 'spese' ? renderPnSpese() : ''}
  `;
}

function renderPnRegistro(allEntries) {
  const q = ui.pnSearch.trim().toLowerCase();
  const months = getSchoolMonths();

  let filtered = allEntries.filter(e => {
    if (ui.pnTipo && e.tipo !== ui.pnTipo) return false;
    if (ui.pnMese && !e.data.startsWith(ui.pnMese)) return false;
    if (q && ![e.descrizione, e.categoria, e.metodo, dataIt(e.data)].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  let runningSaldo = 0;
  const rows = filtered.map((e, idx) => {
    runningSaldo += (e.entrata - e.uscita);
    return `
    <tr>
      <td style="color:#777;text-align:center">${idx + 1}</td>
      <td style="white-space:nowrap">${dataIt(e.data)}</td>
      <td><span class="badge ${e.tipo === 'ENTRATA' ? 'entrata' : 'uscita'}">${e.tipo}</span></td>
      <td><b>${esc(e.categoria)}</b></td>
      <td>
        ${esc(e.descrizione)}
        ${e.docTipo === 'studente' ? (() => {
          const p = S.payments.find(pay => pay.id === e.docId);
          if (!p) return '';
          return p.teacherPaymentId
            ? ` <span class="badge ok small" style="font-size:10px;padding:1px 6px;margin-left:4px" title="Compresa nel prospetto di liquidazione n. ${p.teacherPaymentNumero || ''}">✓ Liquidato</span>`
            : ` <span class="badge warn small" style="font-size:10px;padding:1px 6px;margin-left:4px" title="Non ancora compresa in un prospetto di liquidazione">⏳ Da liquidare</span>`;
        })() : ''}
      </td>
      <td>${esc(e.metodo)}</td>
      <td class="num" style="color:var(--ok);font-weight:${e.entrata ? '600' : 'normal'}">${e.entrata ? euro(e.entrata) : '—'}</td>
      <td class="num" style="color:var(--due);font-weight:${e.uscita ? '600' : 'normal'}">${e.uscita ? euro(e.uscita) : '—'}</td>
      <td class="num" style="font-weight:700">${euro(runningSaldo)}</td>
      <td class="right" style="white-space:nowrap">
        ${e.docTipo === 'liquidazione' ? `
          <button class="btn small" data-act="tp-edit" data-id="${e.docId}">✏ Modifica</button>
          <button class="btn small" data-act="tp-print" data-id="${e.docId}">🖨 Prospetto</button>
          <button class="btn small danger" data-act="tp-delete" data-id="${e.docId}">🗑</button>
        ` : ''}
        ${e.docTipo === 'expense' ? `
          <button class="btn small" data-act="expense-edit" data-id="${e.docId}">✏ Modifica</button>
          <button class="btn small danger" data-act="expense-delete" data-id="${e.docId}">🗑</button>
        ` : ''}
        ${e.docTipo === 'income-extra' ? `
          <button class="btn small" data-act="income-edit" data-id="${e.docId}">✏ Modifica</button>
          <button class="btn small danger" data-act="income-delete" data-id="${e.docId}">🗑</button>
        ` : ''}
        ${e.docTipo === 'studente' ? `
          <button class="btn small" data-act="receipt-print" data-id="${e.docId}">🧾 Ricevuta</button>
          <button class="btn small" data-act="pay-view" data-id="${e.docId}">👁 Info</button>
        ` : ''}
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="toolbar" style="margin-top:10px">
    <input id="pn-search" type="search" placeholder="Cerca nel giornale di cassa…" value="${esc(ui.pnSearch)}" style="width:220px">
    <select id="pn-filter-mese" style="width:160px">
      <option value="">— Tutti i mesi —</option>
      ${months.map(m => opt(m, ui.pnMese, meseLabel(m))).join('')}
    </select>
    <div class="segmented-ctrl">
      <button class="${!ui.pnTipo ? 'active' : ''}" data-act="pn-filter-tipo" data-tipo="">Tutti</button>
      <button class="${ui.pnTipo === 'ENTRATA' ? 'active' : ''}" data-act="pn-filter-tipo" data-tipo="ENTRATA">Solo Entrate</button>
      <button class="${ui.pnTipo === 'USCITA' ? 'active' : ''}" data-act="pn-filter-tipo" data-tipo="USCITA">Solo Uscite</button>
    </div>
    <span class="spacer"></span>
    <button class="btn primary" data-act="tp-new">+ Nuova Liquidazione</button>
    <button class="btn" data-act="expense-new">+ Spesa Scuola</button>
    <button class="btn" data-act="income-new">+ Entrata Extra</button>
    <button class="btn" data-act="pn-print">🖨 Stampa Registro</button>
  </div>
  <div class="card"><table class="tbl">
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th style="width:85px">Data</th>
        <th style="width:85px">Tipo</th>
        <th>Categoria</th>
        <th>Descrizione / Soggetto</th>
        <th>Metodo</th>
        <th class="num">Entrata</th>
        <th class="num">Uscita</th>
        <th class="num">Saldo Prog.</th>
        <th class="right" style="width:140px">Azioni</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="10" class="empty">Nessun movimento trovato per i filtri selezionati</td></tr>'}</tbody>
  </table></div>`;
}

function renderPnLiquidazioni() {
  const list = [...(S.teacherPayments || [])].sort((a, b) => b.data.localeCompare(a.data) || (b.numero - a.numero));
  return `
  <div class="toolbar" style="margin-top:10px">
    <h3>Prospetti di Liquidazione &amp; Fatture della Scuola</h3>
    <span class="spacer"></span>
    <button class="btn primary" data-act="tp-new">+ Nuova Liquidazione Rette</button>
  </div>
  <div class="card"><table class="tbl">
    <thead>
      <tr>
        <th>N. Prospetto</th>
        <th>Data</th>
        <th>Rette di</th>
        <th class="num">Tot. Rette Incassate</th>
        <th class="num">Importo Liquidato</th>
        <th>Fattura della Scuola</th>
        <th>Metodo</th>
        <th>Email</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${list.map(p => {
      const fatt = p.fattura || {};
      const isOk = fatt.stato === 'Fattura registrata';
      const imp = p.importo ?? p.quotaMaestro ?? p.totRetteIncassate ?? 0;
      return `
      <tr>
        <td><b>Prospetto ${p.numero}/${p.anno}</b></td>
        <td>${dataIt(p.data)}</td>
        <td>${meseLabel(p.mese)} <small class="muted">(${p.numRette || 0} allievi)</small></td>
        <td class="num">${euro(p.totRetteIncassate || imp)}</td>
        <td class="num" style="color:var(--due);font-weight:700">${euro(imp)}</td>
        <td>
          ${fatt.numero ? `
            <div><b>${esc(fatt.numero)}</b> del ${dataIt(fatt.data)}</div>
            <span class="badge ${isOk ? 'fattura-ok' : 'fattura-wait'}">${esc(fatt.stato || 'Registrata')}</span>
          ` : `<span class="badge fattura-wait">In attesa fattura</span>`}
        </td>
        <td>${esc(p.metodo)}</td>
        <td>${p.emailInviata ? `<span class="badge ok" title="${esc(p.emailInviata.to)}">✉ Inviata</span>` : '<span class="muted small">—</span>'}</td>
        <td class="right" style="white-space:nowrap">
          <button class="btn small" data-act="tp-print" data-id="${p.id}">🖨 Prospetto</button>
          <button class="btn small" data-act="tp-email" data-id="${p.id}">✉ Email</button>
          <button class="btn small" data-act="tp-edit" data-id="${p.id}">✏ Modifica</button>
          <button class="btn small danger" data-act="tp-delete" data-id="${p.id}">🗑</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" class="empty">Nessuna liquidazione registrata</td></tr>'}
    </tbody>
  </table></div>`;
}

function renderPnSpese() {
  const expenses = S.expenses || [];
  const extras = S.incomeExtra || [];
  return `
  <div class="grid2" style="margin-top:10px;align-items:start">
    <div>
      <div class="toolbar">
        <h3>Spese Generali Scuola (Uscite)</h3>
        <span class="spacer"></span>
        <button class="btn primary" data-act="expense-new">+ Nuova Spesa</button>
      </div>
      <div class="card"><table class="tbl">
        <thead><tr><th>Data</th><th>Categoria</th><th>Descrizione</th><th class="num">Importo</th><th></th></tr></thead>
        <tbody>${expenses.map(e => `
          <tr>
            <td>${dataIt(e.data)}</td>
            <td><span class="tag">${esc(e.categoria)}</span></td>
            <td>${esc(e.descrizione)}<div class="muted small">${esc(e.metodo)}</div></td>
            <td class="num" style="color:var(--due);font-weight:700">${euro(e.importo)}</td>
            <td class="right">
              <button class="btn small" data-act="expense-edit" data-id="${e.id}">✏</button>
              <button class="btn small danger" data-act="expense-delete" data-id="${e.id}">🗑</button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="empty">Nessuna spesa registrata</td></tr>'}</tbody>
      </table></div>
    </div>

    <div>
      <div class="toolbar">
        <h3>Entrate Extra Scuola</h3>
        <span class="spacer"></span>
        <button class="btn primary" data-act="income-new">+ Nuova Entrata Extra</button>
      </div>
      <div class="card"><table class="tbl">
        <thead><tr><th>Data</th><th>Categoria</th><th>Descrizione</th><th class="num">Importo</th><th></th></tr></thead>
        <tbody>${extras.map(ie => `
          <tr>
            <td>${dataIt(ie.data)}</td>
            <td><span class="tag">${esc(ie.categoria)}</span></td>
            <td>${esc(ie.descrizione)}<div class="muted small">${esc(ie.metodo)}</div></td>
            <td class="num" style="color:var(--ok);font-weight:700">${euro(ie.importo)}</td>
            <td class="right">
              <button class="btn small" data-act="income-edit" data-id="${ie.id}">✏</button>
              <button class="btn small danger" data-act="income-delete" data-id="${ie.id}">🗑</button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="empty">Nessuna entrata extra registrata</td></tr>'}</tbody>
      </table></div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- LIQUIDAZIONE RETTE SCUOLA & FATTURA
function getMonthPaymentsDetail(mese, currentTpId) {
  const allPayments = S.payments.filter(p => p.mese === mese);
  return allPayments.map(p => {
    const s = studentById(p.studentId);
    const isEvasoAltrove = !!(p.teacherPaymentId && p.teacherPaymentId !== currentTpId);
    const isEvasoInQuesto = !!(currentTpId && p.teacherPaymentId === currentTpId);
    const defaultSelected = currentTpId ? isEvasoInQuesto : !isEvasoAltrove;

    return {
      paymentId: p.id,
      studentId: s?.id,
      nome: s ? fullName(s) : 'Allievo',
      strumento: s?.strumento || '',
      ricevuta: `${p.numero}/${p.anno}`,
      dataRicevuta: p.data,
      importo: p.importo,
      metodo: p.metodo,
      isEvasoAltrove,
      isEvasoInQuesto,
      teacherPaymentNumero: p.teacherPaymentNumero,
      teacherPaymentId: p.teacherPaymentId,
      selected: defaultSelected,
    };
  });
}

function calculateMonthTuition(mese) {
  const payments = S.payments.filter(p => p.mese === mese);
  const tot = payments.reduce((a, p) => a + p.importo, 0);
  const studentsDetail = payments.map(p => {
    const s = studentById(p.studentId);
    return {
      id: s?.id,
      paymentId: p.id,
      nome: s ? fullName(s) : 'Allievo',
      strumento: s?.strumento || '',
      ricevuta: `${p.numero}/${p.anno}`,
      importo: p.importo,
    };
  });
  return { tot, count: payments.length, studentsDetail };
}

function teacherPaymentDialog(id, prefillMese) {
  const isNew = !id;
  const tp = isNew ? null : teacherPaymentById(id);
  const months = getSchoolMonths();
  const curMese = tp ? tp.mese : (prefillMese || months[0] || today().slice(0, 7));

  let monthItems = getMonthPaymentsDetail(curMese, tp?.id);
  if (tp && Array.isArray(tp.studentiCoinvolti) && tp.studentiCoinvolti.length > 0) {
    monthItems.forEach(it => {
      const found = tp.studentiCoinvolti.some(sc =>
        (sc.paymentId && sc.paymentId === it.paymentId) ||
        (sc.ricevuta && sc.ricevuta === it.ricevuta) ||
        (sc.id && sc.id === it.studentId)
      );
      if (found) {
        it.selected = true;
        it.isEvasoInQuesto = true;
        it.isEvasoAltrove = false;
      }
    });
  }

  const selectedItems = monthItems.filter(it => it.selected);
  const defTotIncassato = tp ? (tp.totRetteIncassate || tp.importo || tp.quotaMaestro || 0) : selectedItems.reduce((a, b) => a + b.importo, 0);
  const defImporto = tp ? (tp.importo ?? tp.quotaMaestro ?? defTotIncassato) : defTotIncassato;
  const fatt = tp?.fattura || {};

  const renderRows = items => {
    if (!items.length) {
      return '<tr><td colspan="6" class="empty">Nessuna ricevuta registrata per questo mese</td></tr>';
    }
    return items.map(it => {
      const disabled = it.isEvasoAltrove ? 'disabled' : '';
      const checked = it.selected ? 'checked' : '';
      const rowStyle = it.isEvasoAltrove ? 'opacity:0.65;background:#f8fafc;' : '';
      let badgeHtml = '';
      if (it.isEvasoAltrove) {
        badgeHtml = `<span class="badge" style="background:#e2e8f0;color:#475569" title="Già inserita nel prospetto n. ${it.teacherPaymentNumero || ''}">✓ In Prospetto ${it.teacherPaymentNumero || ''}</span>`;
      } else if (it.isEvasoInQuesto) {
        badgeHtml = `<span class="badge ok">In questo prospetto</span>`;
      } else {
        badgeHtml = `<span class="badge warn">Da liquidare</span>`;
      }

      return `
        <tr style="${rowStyle}">
          <td style="text-align:center">
            <input type="checkbox" class="tp-pay-chk" data-id="${it.paymentId}" ${checked} ${disabled}>
          </td>
          <td><b>${esc(it.ricevuta)}</b></td>
          <td><b>${esc(it.nome)}</b></td>
          <td class="muted">${esc(it.strumento || '—')}</td>
          <td class="num" style="font-weight:600">&euro; ${euro(it.importo)}</td>
          <td>${badgeHtml}</td>
        </tr>
      `;
    }).join('');
  };

  const dlg = openDialog({
    title: isNew ? 'Nuova Liquidazione Rette & Registrazione Fattura' : `Modifica Prospetto di Liquidazione n. ${tp.numero}/${tp.anno}`,
    isWide: true,
    body: `
    <div style="margin-bottom:12px">
      <label>Mese delle rette da liquidare *
        <select name="mese" id="tp-mese-sel" required>
          ${months.map(m => opt(m, curMese, meseLabel(m))).join('')}
        </select>
      </label>
    </div>

    <!-- Sezione Selezione Ricevute Allievi a Spunta -->
    <div class="card pad" style="background:#f8fafc;margin-bottom:14px;border:1px solid var(--line);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin:0;font-size:14px;color:#1e3a8a">Ricevute allievi da includere nel prospetto</h3>
          <p class="muted small" style="margin:2px 0 0">Spunta le singole ricevute che intendi liquidare al maestro con questo prospetto.</p>
        </div>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn small" id="tp-btn-sel-open" title="Seleziona tutte le ricevute non ancora liquidate">Spunta non evase</button>
          <button type="button" class="btn small" id="tp-btn-desel-all">Deseleziona tutte</button>
        </div>
      </div>

      <div style="max-height:220px;overflow-y:auto;border:1px solid #cbd5e1;border-radius:6px;background:#fff">
        <table class="tbl" style="font-size:12px;margin:0">
          <thead>
            <tr style="background:#f1f5f9;position:sticky;top:0;z-index:1">
              <th style="width:34px;text-align:center"><input type="checkbox" id="tp-chk-all" title="Seleziona/deseleziona tutte"></th>
              <th style="width:75px">Ricevuta</th>
              <th>Allievo</th>
              <th style="width:110px">Strumento</th>
              <th class="num" style="width:85px">Importo</th>
              <th style="width:150px">Stato Evasione</th>
            </tr>
          </thead>
          <tbody id="tp-payments-tbody">
            ${renderRows(monthItems)}
          </tbody>
        </table>
      </div>

      <div id="tp-sel-summary" style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:12.5px;color:#334155;font-weight:600">
        <span id="tp-sel-count">0 rette selezionate</span>
        <span>Totale selezionato: <span id="tp-sel-sum" style="color:#1e40af;font-size:14px">&euro; 0,00</span></span>
      </div>
    </div>

    <div class="card pad" style="background:#fafbfe;margin-bottom:14px">
      <h3 style="margin-bottom:10px">Importo della Liquidazione</h3>
      <div class="grid2">
        ${field('Totale Rette Selezionate (€)', 'totRetteIncassate', defTotIncassato, 'type="number" step="0.01" id="tp-tot-incassato" readonly style="background:#f1f3f5"')}
        ${field('Importo da Liquidare (€) *', 'importo', defImporto, 'type="number" step="0.01" id="tp-importo" required')}
      </div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:8px">
        💡 L'importo da liquidare corrisponde di default alla somma delle rette spuntate. Puoi modificarlo liberamente se necessario.
      </div>
    </div>

    <div class="card pad" style="background:#f9fbf9;border:1px solid #cbe4ce;margin-bottom:14px">
      <h3 style="margin-bottom:8px;color:#238636">Dati Fattura della Scuola</h3>
      <p class="muted small" style="margin-top:-4px">Registra i riferimenti della fattura emessa per questa liquidazione.</p>
      <div class="grid4">
        ${field('Numero Fattura', 'fatturaNumero', fatt.numero || '', 'placeholder="es. Fatt. 1/2026"')}
        ${field('Data Fattura', 'fatturaData', fatt.data || today(), 'type="date"')}
        ${field('Importo Fattura (€)', 'fatturaImporto', fatt.importo || defImporto, 'type="number" step="0.01" id="tp-fattura-importo"')}
        <label>Stato Fattura
          <select name="fatturaStato">
            <option ${fatt.stato === 'Fattura registrata' ? 'selected' : ''}>Fattura registrata</option>
            <option ${fatt.stato === 'In attesa di fattura' ? 'selected' : ''}>In attesa di fattura</option>
            <option ${fatt.stato === 'Esente / Non richiesta' ? 'selected' : ''}>Esente / Non richiesta</option>
          </select>
        </label>
      </div>
      <div style="margin-top:8px">
        ${field('Note Fattura', 'fatturaNote', fatt.note || '', 'placeholder="es. Regime forfettario, ricevuta via SDI..."')}
      </div>
    </div>

    <div class="grid2">
      ${field('Data liquidazione', 'data', tp?.data || today(), 'type="date" required')}
      <label>Metodo di pagamento
        <select name="metodo">
          ${METODI.map(x => opt(x, tp?.metodo || 'Bonifico bancario')).join('')}
        </select>
      </label>
    </div>
    ${field('Note aggiuntive', 'note', tp?.note || '')}
    `,
    actions: `
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="tp-delete" data-id="${tp.id}">Elimina</button>`}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Annulla</button>
      <button class="btn" value="save">Salva Prospetto</button>
      <button class="btn primary" value="print">Salva e Stampa Prospetto</button>
    `,
    onSubmit: async (data, action) => {
      const selected = monthItems.filter(it => it.selected);
      if (selected.length === 0) {
        if (!confirm('Nessuna ricevuta selezionata. Vuoi davvero salvare il prospetto senza ricevute collegate?')) {
          return;
        }
      }
      const selectedStudentsDetail = selected.map(it => ({
        id: it.studentId,
        paymentId: it.paymentId,
        nome: it.nome,
        strumento: it.strumento,
        ricevuta: it.ricevuta,
        importo: it.importo,
      }));
      const payload = {
        ...data,
        paymentIds: selected.map(it => it.paymentId),
        studentiCoinvolti: selectedStudentsDetail,
        numRette: selectedStudentsDetail.length,
        totRetteIncassate: Number(data.totRetteIncassate || data.importo || 0),
        inviaEmail: false,
      };
      let res;
      if (isNew) {
        res = await api('POST', '/api/teacher-payments', payload);
      } else {
        res = await api('PUT', '/api/teacher-payments/' + tp.id, payload);
      }
      closeDialog();
      const savedTp = res.teacherPayment || res;
      if (action === 'print') openTeacherPayment(savedTp.id, true);
      toast(`Prospetto di liquidazione n. ${savedTp.numero}/${savedTp.anno} registrato`);
      await reload();
    },
  });

  // Funzione di ricalcolo dinamico
  const recalculate = () => {
    const checkedBoxes = Array.from(dlg.querySelectorAll('.tp-pay-chk:checked'));
    const checkedIds = new Set(checkedBoxes.map(cb => cb.dataset.id));
    monthItems.forEach(it => {
      if (!it.isEvasoAltrove) {
        it.selected = checkedIds.has(it.paymentId);
      }
    });
    const selected = monthItems.filter(it => it.selected);
    const sum = selected.reduce((acc, it) => acc + Number(it.importo || 0), 0);
    const count = selected.length;

    const countLabel = $('#tp-sel-count', dlg);
    if (countLabel) countLabel.textContent = `${count} ${count === 1 ? 'retta selezionata' : 'rette selezionate'}`;
    const sumLabel = $('#tp-sel-sum', dlg);
    if (sumLabel) sumLabel.innerHTML = `&euro; ${euro(sum)}`;

    const totInc = $('#tp-tot-incassato', dlg);
    if (totInc) totInc.value = sum;
    const imp = $('#tp-importo', dlg);
    if (imp) imp.value = sum;
    const fattImp = $('#tp-fattura-importo', dlg);
    if (fattImp) fattImp.value = sum;

    // Aggiorna checkbox header tutti
    const available = monthItems.filter(it => !it.isEvasoAltrove);
    const chkAll = $('#tp-chk-all', dlg);
    if (chkAll) {
      const allChecked = available.length > 0 && available.every(it => it.selected);
      const someChecked = available.some(it => it.selected);
      chkAll.checked = allChecked;
      chkAll.indeterminate = !allChecked && someChecked;
    }
  };

  // Esegui ricalcolo iniziale
  recalculate();

  // Spunta solo non evase
  $('#tp-btn-sel-open', dlg).onclick = () => {
    monthItems.forEach(it => {
      if (!it.isEvasoAltrove) it.selected = true;
    });
    $('#tp-payments-tbody', dlg).innerHTML = renderRows(monthItems);
    recalculate();
  };

  // Deseleziona tutte
  $('#tp-btn-desel-all', dlg).onclick = () => {
    monthItems.forEach(it => {
      it.selected = false;
    });
    $('#tp-payments-tbody', dlg).innerHTML = renderRows(monthItems);
    recalculate();
  };

  // Checkbox tutti in testata
  $('#tp-chk-all', dlg).onchange = e => {
    const val = e.target.checked;
    monthItems.forEach(it => {
      if (!it.isEvasoAltrove) it.selected = val;
    });
    $('#tp-payments-tbody', dlg).innerHTML = renderRows(monthItems);
    recalculate();
  };

  // Event delegation sui singoli checkbox
  $('#tp-payments-tbody', dlg).onchange = e => {
    if (e.target.classList.contains('tp-pay-chk')) {
      recalculate();
    }
  };

  // Reattività dinamica al cambio mese nel dialog
  const meseSel = $('#tp-mese-sel', dlg);
  const updateMese = () => {
    const selM = meseSel.value;
    monthItems = getMonthPaymentsDetail(selM, tp?.id);
    $('#tp-payments-tbody', dlg).innerHTML = renderRows(monthItems);
    recalculate();
  };
  meseSel.onchange = updateMese;

  // Quando l'utente modifica l'importo liquidato a mano, aggiorna l'importo fattura
  $('#tp-importo', dlg).oninput = e => {
    const val = e.target.value;
    $('#tp-fattura-importo', dlg).value = val;
  };
}

async function teacherPaymentDelete(id) {
  const p = teacherPaymentById(id);
  if (!confirm(`Eliminare il prospetto di liquidazione n. ${p.numero}/${p.anno}?`)) return;
  await api('DELETE', '/api/teacher-payments/' + id);
  closeDialog(); toast('Prospetto di liquidazione eliminato'); await reload();
}

async function teacherPaymentEmail(id) {
  const p = teacherPaymentById(id);
  if (!p) { toast('Prospetto non trovato', 'err'); return; }
  if (!smtpOk()) { toast('Configura prima l\'invio email nella sezione Impostazioni', 'err'); return; }

  const defaultEmail = S.settings.smtp.from || S.settings.smtp.user || '';
  const bodyHtml = `
    <div style="background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin-bottom:16px;">
      <div style="font-weight:700;font-size:15px;color:var(--ink);">Prospetto di Liquidazione n. ${p.numero}/${p.anno}</div>
      <div class="muted small" style="margin-top:3px;">
        Mese di <b>${meseLabel(p.mese)}</b> · Quota Maestro <b>${p.importo} €</b>
      </div>
    </div>
    <label for="prompt-input" style="display:block;font-weight:600;font-size:13.5px;margin-bottom:6px;color:var(--ink);">
      Invia a indirizzo email *
    </label>
    <input type="email" id="prompt-input" name="promptVal" value="${esc(defaultEmail)}" placeholder="maestro@email.com" required style="width:100%;font-size:15px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;box-sizing:border-box;">
  `;

  const to = await asyncPrompt({
    title: `Invia liquidazione n. ${p.numero}/${p.anno}`,
    bodyHtml,
    confirmText: 'Invia Email',
    confirmIcon: '✉',
    required: true
  });

  if (!to || !to.trim()) return;
  const destEmail = to.trim();

  toast('Invio liquidazione in corso…');
  try {
    await api('POST', `/api/teacher-payments/${id}/email`, { to: destEmail });
    toast(`Prospetto inviato a ${destEmail} ✉`);
    await reload();
  } catch (err) {
    toast(`Errore invio email: ${err.message}`, 'err');
  }
}

// ---------------------------------------------------------------- SPESE SCUOLA & ENTRATE EXTRA
function expenseDialog(id) {
  const isNew = !id;
  const e = isNew ? { data: today(), metodo: 'Contanti', categoria: SPESE_CAT[0] } : expenseById(id);
  openDialog({
    title: isNew ? 'Registra Spesa Scuola (Uscita)' : 'Modifica Spesa',
    body: `
    <div class="grid2">
      ${field('Data spesa *', 'data', e.data, 'type="date" required')}
      <label>Categoria<select name="categoria">${SPESE_CAT.map(x => opt(x, e.categoria)).join('')}</select></label>
      ${field('Importo (€) *', 'importo', e.importo, 'type="number" step="0.01" min="0.01" required')}
      <label>Metodo di pagamento<select name="metodo">${METODI.map(x => opt(x, e.metodo)).join('')}</select></label>
    </div>
    ${field('Descrizione spesa *', 'descrizione', e.descrizione, 'placeholder="es. Acquisto spartiti, materiale didattico, riparazione cavo..." required')}
    ${field('Note aggiuntive', 'note', e.note || '')}
    `,
    actions: `
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="expense-delete" data-id="${e.id}">Elimina</button>`}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Annulla</button>
      <button class="btn primary">Salva Spesa</button>
    `,
    onSubmit: async data => {
      if (isNew) await api('POST', '/api/expenses', data);
      else await api('PUT', '/api/expenses/' + e.id, data);
      closeDialog(); toast('Spesa registrata'); await reload();
    },
  });
}

async function expenseDelete(id) {
  if (!confirm('Eliminare questa spesa?')) return;
  await api('DELETE', '/api/expenses/' + id);
  closeDialog(); toast('Spesa eliminata'); await reload();
}

function incomeExtraDialog(id) {
  const isNew = !id;
  const ie = isNew ? { data: today(), metodo: 'Contanti', categoria: ENTRATE_CAT[0] } : incomeExtraById(id);
  openDialog({
    title: isNew ? 'Registra Entrata Extra (Entrata)' : 'Modifica Entrata Extra',
    body: `
    <div class="grid2">
      ${field('Data entrata *', 'data', ie.data, 'type="date" required')}
      <label>Categoria<select name="categoria">${ENTRATE_CAT.map(x => opt(x, ie.categoria)).join('')}</select></label>
      ${field('Importo (€) *', 'importo', ie.importo, 'type="number" step="0.01" min="0.01" required')}
      <label>Metodo di incasso<select name="metodo">${METODI.map(x => opt(x, ie.metodo)).join('')}</select></label>
    </div>
    ${field('Descrizione entrata *', 'descrizione', ie.descrizione, 'placeholder="es. Iscrizione annuale socio, saggio musicale..." required')}
    ${field('Note aggiuntive', 'note', ie.note || '')}
    `,
    actions: `
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="income-delete" data-id="${ie.id}">Elimina</button>`}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Annulla</button>
      <button class="btn primary">Salva Entrata</button>
    `,
    onSubmit: async data => {
      if (isNew) await api('POST', '/api/income-extra', data);
      else await api('PUT', '/api/income-extra/' + ie.id, data);
      closeDialog(); toast('Entrata registrata'); await reload();
    },
  });
}

async function incomeExtraDelete(id) {
  if (!confirm('Eliminare questa entrata extra?')) return;
  await api('DELETE', '/api/income-extra/' + id);
  closeDialog(); toast('Entrata eliminata'); await reload();
}

// ---------------------------------------------------------------- IMPOSTAZIONI
function viewImpostazioni() {
  const st = S.settings, c = st.smtp;
  return `
  <form id="settings-form" novalidate>
    <div class="toolbar">
      <h2>Impostazioni</h2>
      <span class="spacer"></span>
      <button type="button" class="btn primary" data-act="save-settings">💾 Salva impostazioni</button>
      <a href="#guida" class="btn">📖 Guida &amp; Wiki</a>
      <a href="/api/backup/download" class="btn" title="Scarica copia locale di sicurezza del database">💾 Scarica Backup Database</a>
    </div>

    <div class="card pad">
      <h3>📅 Durata Anno Scolastico</h3>
      <p class="muted small" style="margin-top:-6px">
        Decidi la durata dell'anno scolastico, dal giorno esatto al giorno esatto.
        I calendari delle rette e delle presenze si adatteranno automaticamente:
        mostreranno solo i mesi previsti e le lezioni saranno consentite solo nell'intervallo specificato.
      </p>
      <div class="grid2">
        ${field('Data inizio anno scolastico *', 'annoScolasticoInizio', st.annoScolasticoInizio || '2026-10-01', 'type="date" required')}
        ${field('Data fine anno scolastico *', 'annoScolasticoFine', st.annoScolasticoFine || '2027-06-30', 'type="date" required')}
      </div>
    </div>

    <div class="card pad">
      <h3>Dati della Scuola (Intestazione Ricevute e Prospetti)</h3>
      <div class="grid2">
        ${field('Nome scuola', 'scuola', st.scuola)}
        ${field('Indirizzo', 'indirizzo', st.indirizzo)}
        ${field('Luogo (sulla ricevuta)', 'citta', st.citta)}
        ${field('Codice fiscale / P.IVA', 'codiceFiscale', st.codiceFiscale)}
        ${field('Nome e Cognome per la Segreteria (Firma chiesa / ricevute) *', 'firmatarioSegreteria', st.firmatarioSegreteria || (st.firmatarioRicevute || st.firmatario || '').replace(/^(?:Segreteria chiesa|(?:x|per|p\.?\s*c\.?)\s*(?:conto\s+)?della\s+scuola)[:\s]*/i, ''), 'placeholder="es. Bruno Astemio" required')}
        ${field('Nome e Cognome per il Maestro (Firma liquidazioni) *', 'firmatarioMaestro', st.firmatarioMaestro || st.firmatarioProspetti || '', 'placeholder="es. Maestro Dario Artuso" required')}
        ${field('Retta mensile predefinita allievi (€)', 'rettaDefault', st.rettaDefault, 'type="number" step="0.01" min="0"')}
      </div>
      <label>Nota a piè di ricevuta allievi (facoltativa)<textarea name="notaRicevuta" rows="2" placeholder="es. dicitura fiscale, IBAN per i bonifici…">${esc(st.notaRicevuta)}</textarea></label>
      <div style="margin-top:12px;display:flex;justify-content:flex-end;">
        <button type="button" class="btn primary small" data-act="save-settings">💾 Salva Dati Scuola</button>
      </div>
    </div>

    <div class="card pad">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <div>
          <h3 style="margin:0;">🎸 Corsi e Strumenti Musicali</h3>
          <p class="muted small" style="margin:4px 0 0 0;">Configura gli strumenti insegnati nella scuola per l'assegnazione agli allievi.</p>
        </div>
        <button type="button" class="btn primary small" data-act="manage-strumenti">⚙️ Gestisci strumenti</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${getStrumenti().map(st => {
          const cnt = S.students.filter(x => (x.strumento || '').toLowerCase() === st.toLowerCase()).length;
          return `<span class="tag" style="padding:6px 12px; font-size:13px; display:inline-flex; align-items:center; gap:8px;">
            <b>${esc(st)}</b>
            <span class="muted small" style="font-size:11.5px;">(${cnt} alliev${cnt === 1 ? 'o' : 'i'})</span>
          </span>`;
        }).join('')}
      </div>
    </div>

    <div class="card pad">
      <h3>Invio email (Ricevute allievi e Prospetti)</h3>
      <p class="muted small" style="margin-top:-6px">Con <b>Gmail</b>: server <code>smtp.gmail.com</code>, porta <code>465</code> con SSL, utente = il tuo indirizzo Gmail,
        password = una <b>"password per le app"</b> (Account Google → Sicurezza → Verifica in due passaggi → Password per le app).</p>
      <div class="grid2">
        ${field('Server SMTP', 'smtp.host', c.host, 'placeholder="smtp.gmail.com"')}
        ${field('Porta', 'smtp.port', c.port, 'type="number"')}
        ${field('Utente', 'smtp.user', c.user, 'placeholder="nome@gmail.com" autocomplete="off"')}
        ${field('Password', 'smtp.pass', '', `type="password" autocomplete="new-password" placeholder="${c.hasPass ? '•••••••• (salvata – lascia vuoto per non cambiarla)' : ''}"`)}
        ${field('Mittente visualizzato', 'smtp.from', c.from, 'placeholder="Scuola di Musica &lt;nome@gmail.com&gt;"')}
        <label class="check" style="margin-top:22px"><input type="checkbox" name="smtp.secure" ${c.secure ? 'checked' : ''}> Connessione SSL (porta 465)</label>
      </div>
      <label>Testo email ricevuta allievi (la ricevuta viene aggiunta sotto e in allegato)<textarea name="emailTesto" rows="5">${esc(st.emailTesto)}</textarea></label>
      <p class="muted small">Segnaposto utilizzabili: {intestatario} {allievo} {mese} {importo} {numero} {scuola} {firmatario}</p>

      <label style="margin-top:14px">Testo email prospetto liquidazione scuola (il prospetto viene aggiunto sotto e in allegato)<textarea name="emailTestoLiquidazione" rows="5">${esc(st.emailTestoLiquidazione || '')}</textarea></label>
      <p class="muted small">Segnaposto utilizzabili: {mese} {importo} {fattura} {numero} {anno} {scuola} {firmatario}</p>
    </div>

    <div class="card pad">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <h3 style="margin:0;">☁️ Sincronizzazione Cloud (Google Drive)</h3>
        ${G_DRIVE?.connected ? '<span class="badge ok">Account Collegato</span>' : '<span class="badge off">Non collegato</span>'}
      </div>
      <p class="muted small" style="margin-top:0;">
        Sincronizza automaticamente il gestionale su Google Drive per visualizzare e modificare gli stessi dati su tutti i dispositivi. È sufficiente collegare il proprio account Google.
      </p>

      <div class="cloud-status-box ${G_DRIVE?.connected ? 'active' : 'inactive'}">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <b>${G_DRIVE?.connected ? `Account: ${esc(G_DRIVE.accountEmail || G_DRIVE.accountName || 'Google Account')}` : 'Nessun account Google collegato'}</b>
            <div class="muted small">
              Cartella Cloud: <b>${esc(G_DRIVE?.folderName || 'Gestionale Scuola di Musica')}</b> · Ultimo sync: <b>${formatSyncTime(G_DRIVE?.lastSync)}</b>
              ${G_DRIVE?.lastSyncAction ? ` (${G_DRIVE.lastSyncAction === 'download' ? 'scaricato da cloud' : 'caricato su cloud'})` : ''}
            </div>
            ${G_DRIVE?.lastSyncError ? `<div style="color:var(--due);font-size:12.5px;margin-top:5px;line-height:1.4;">${formatSyncError(G_DRIVE.lastSyncError)}</div>` : ''}
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${G_DRIVE?.connected ? `
              <button type="button" class="btn small primary" data-act="cloud-sync" data-dir="auto">🔄 Sincronizza ora</button>
              <button type="button" class="btn small" data-act="cloud-sync" data-dir="upload" title="Sovrascrive la copia su Drive con quella di questo dispositivo">⬆️ Carica</button>
              <button type="button" class="btn small" data-act="cloud-sync" data-dir="download" title="Scarica l'ultima versione presente su Drive">⬇️ Scarica</button>
              <button type="button" class="btn small danger" data-act="cloud-disconnect">Disconnetti</button>
            ` : `
              <button type="button" class="btn primary" data-act="cloud-connect">🔑 Accedi con Google</button>
            `}
          </div>
        </div>
      </div>

      <div class="grid2">
        <label>Nome cartella su Google Drive
          <input name="google.folderName" value="${esc(G_DRIVE?.folderName || 'Gestionale Scuola di Musica')}" placeholder="Gestionale Scuola di Musica">
        </label>
        <label class="check" style="margin-top:24px;">
          <input type="checkbox" name="google.autoSync" ${G_DRIVE?.autoSync ? 'checked' : ''}>
          Sincronizzazione automatica (ad ogni salvataggio e all'avvio dell'app)
        </label>
      </div>

      <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <button type="button" class="btn" data-act="cloud-save-config">💾 Salva Opzioni Drive</button>
        ${!G_DRIVE?.connected ? `
          <button type="button" class="btn primary" data-act="cloud-connect">🔑 Accedi con Google</button>
        ` : ''}
      </div>
    </div>

    <div class="card pad" style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;">
        <div>
          <h3 style="margin:0;display:flex;align-items:center;gap:8px;">
            📜 Registro Versioni (Changelog)
            <span class="badge ok" style="font-size:12px;">v${esc(S?.version || APP_VERSION)}</span>
          </h3>
          <p class="muted small" style="margin:4px 0 0 0;">
            Cronologia delle versioni e novità del programma <b>Tralci di Note</b>.
          </p>
        </div>
        <button type="button" class="btn" data-act="show-changelog-modal" style="font-weight:600;display:inline-flex;align-items:center;gap:6px;">
          <span>📜</span> Visualizza Registro Versioni
        </button>
      </div>
    </div>

    <div class="toolbar">
      <button type="button" class="btn" data-act="test-email">✉ Salva e invia email di prova</button>
      <span class="spacer"></span>
      <button type="button" class="btn primary" data-act="save-settings">💾 Salva impostazioni</button>
    </div>
    <div style="text-align:center;margin-top:24px;padding:12px;color:var(--muted);font-size:12px;line-height:1.6;">
      <b>Tralci di Note</b> · Sviluppato da Bruno Astemio con Antigravity per Come Tralci - Novara<br>
      <span style="font-size:11px;color:#94a3b8;">Chiesa Evangelica Pentecostale e Missionaria Come Tralci - Novara</span>
    </div>
  </form>`;
}

function renderChangelogHtml() {
  const entries = Array.isArray(S?.changelog) && S.changelog.length ? S.changelog : [];
  return `
    <div class="changelog-timeline" style="max-height:65vh;overflow-y:auto;padding-right:8px;">
      ${entries.map(entry => {
        const isCur = entry.version === (S?.version || APP_VERSION);
        const dateStr = entry.date ? dataIt(entry.date) : '';
        return `
        <div class="changelog-entry ${isCur ? 'current' : ''}">
          <div class="changelog-header">
            <span class="changelog-badge">
              v${esc(entry.version)}
              ${isCur ? '<span class="pill-cur">Attuale</span>' : ''}
            </span>
            <span class="changelog-date">${esc(dateStr)}</span>
          </div>
          <div class="changelog-title">${esc(entry.title || '')}</div>
          ${entry.highlight ? `<div class="changelog-highlight"><i>${esc(entry.highlight)}</i></div>` : ''}
          ${Array.isArray(entry.changes) && entry.changes.length ? `
            <ul class="changelog-list">
              ${entry.changes.map(ch => `<li>${esc(ch)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>`;
      }).join('') || '<p class="muted">Nessuna voce registrata nel registro versioni.</p>'}
    </div>
  `;
}

function openChangelogModal() {
  openDialog({
    title: `📜 Registro Versioni (Changelog) — v${esc(S?.version || APP_VERSION)}`,
    body: renderChangelogHtml(),
    actions: `
      <span class="muted small" style="align-self:center;">Tralci di Note · Cronologia aggiornamenti</span>
      <span class="spacer"></span>
      <button type="button" class="btn primary" data-close>Chiudi</button>
    `,
    isWide: true
  });
}

// ---------------------------------------------------------------- GUIDA & WIKI
function viewGuida() {
  const q = (ui.guidaSearch || '').trim().toLowerCase();
  const sec = ui.guidaSection || 'all';

  const SECTIONS = [
    {
      id: 'dashboard',
      icon: '📊',
      title: 'Dashboard Statistiche & Panoramica',
      tags: ['dashboard', 'statistiche', 'eta', 'nascita', 'totali', 'entrate', 'uscite', 'saldo', 'strumenti', 'report', 'cruscotto'],
      content: `
        <p>La Dashboard fornisce una panoramica immediata e completa delle metriche chiave didattiche e contabili della scuola di musica.</p>
        <ul class="wiki-step-list">
          <li><b>Entrate, Uscite e Utile:</b> Calcolo istantaneo del volume complessivo di entrate (rette + extra), uscite (liquidazioni docenti + spese) e del saldo/utile netto, con possibilità di filtrare per Anno Scolastico, Mese Corrente o Tutto lo Storico.</li>
          <li><b>Età dei Partecipanti:</b> Analisi anagrafica con calcolo automatico dell'età, età media complessiva, allievo più giovane e più grande, e ripartizione grafica per fasce d'età con chip cliccabili per aprire direttamente la scheda degli allievi.</li>
          <li><b>Suddivisione Strumenti:</b> Conteggio iscritti per strumento (Canto, Chitarra, Basso, Piano), percentuale, potenziale economico mensile generato e nomi degli allievi iscritti.</li>
          <li><b>Stato Rette del Mese:</b> Monitoraggio immediato della percentuale di riscossione del mese corrente, con elenco dei pagamenti ancora in sospeso e pulsante rapido per registrare subito l'incasso.</li>
          <li><b>Flusso Mensile:</b> Prospetto tabellare comparativo di entrate e uscite mese per mese dell'anno scolastico.</li>
          <li><b>Stampa Report:</b> Pulsante dedicato per stampare o salvare in PDF una copia cartacea formattata della dashboard.</li>
        </ul>
        <div class="wiki-tip">💡 <b>Consiglio:</b> Se noti l'avviso di "Data di nascita mancante", clicca sui nomi degli allievi segnalati per inserire rapidamente la data nella scheda: le statistiche sull'età e i grafici si aggiorneranno all'istante!</div>
      `
    },
    {
      id: 'studenti',
      icon: '👤',
      title: 'Gestione Anagrafica Studenti & Corsi',
      tags: ['studenti', 'allievi', 'corsi', 'anagrafica', 'iscrizione', 'orari', 'lezioni', 'rette', 'genitori', 'intestatario', 'nascita', 'eta'],
      content: `
        <p>Il modulo Studenti permette di gestire il registro completo degli iscritti alla scuola di musica, i loro corsi, tariffe e contatti per le ricevute.</p>
        <ul class="wiki-step-list">
          <li><b>Nuovo Allievo:</b> Clicca sul pulsante <i>+ Nuovo studente</i> e inserisci Nome, Cognome, Data di nascita, Strumento, Giorno e Orario della lezione settimanale.</li>
          <li><b>Data di nascita &amp; Calcolo Età:</b> Inserendo la data di nascita, l'età in anni viene calcolata in tempo reale e visualizzata automaticamente sia nella scheda che nella tabella studenti e nei grafici della dashboard.</li>
          <li><b>Intestatario Ricevuta:</b> Se l'allievo è minorenne, indica nel campo apposito il nome e cognome del genitore o tutore. La ricevuta fiscale sarà intestata al genitore specificando che il versamento è per l'allievo.</li>
          <li><b>Retta Mensile Personalizzata:</b> Di default è preimpostata la quota standard della scuola (es. 60 €), ma per ciascun allievo puoi personalizzare l'importo concordato.</li>
          <li><b>Disattivazione:</b> Quando un allievo interrompe le lezioni, imposta lo stato su <i>Non attivo</i> anziché cancellarlo: in questo modo conserverai intatto tutto lo storico delle ricevute e dei pagamenti passati!</li>
          <li><b>Gestione Strumenti:</b> Clicca su <i>🎸 Gestione Strumenti</i> per aggiungere o rinominare gli strumenti insegnati nella scuola.</li>
        </ul>
        <div class="wiki-tip">💡 <b>Consiglio:</b> Puoi cercare rapidamente gli allievi per nome, strumento, giorno o età digitando nella barra di ricerca in alto.</div>
      `
    },
    {
      id: 'presenze',
      icon: '📅',
      title: 'Calendario Presenze, Assenze e Recuperi',
      tags: ['presenze', 'assenze', 'recuperi', 'calendario', 'foglio presenze', 'stampa', 'giorni', 'festivi', 'chiusure'],
      content: `
        <p>Il calendario si adatta automaticamente all'anno scolastico impostato. Mostra per ogni studente solo i giorni in cui ha lezione secondo il suo giorno settimanale.</p>
        <div class="wiki-legend">
          <span class="wiki-legend-item" style="background:#dcfce7;color:#15803d;"><b>P</b> Presente</span>
          <span class="wiki-legend-item" style="background:#fee2e2;color:#b91c1c;"><b>A</b> Assente</span>
          <span class="wiki-legend-item" style="background:#ffedd5;color:#c2410c;"><b>G</b> Assenza da recuperare</span>
          <span class="wiki-legend-item" style="background:#f3e8ff;color:#7e22ce;"><b>R</b> Assenza maestro</span>
          <span class="wiki-legend-item" style="background:#e0f2fe;color:#0369a1;"><b>REC</b> Recupero svolto</span>
        </div>
        <ul class="wiki-step-list">
          <li><b>Segnatura con un clic:</b> Clicca su una casella per far avanzare lo stato (P → A → G → R → Vuoto).</li>
          <li><b>Segna Giornata Intera:</b> In cima a ciascuna colonna puoi cliccare su <i>Tutti Presenti</i> per segnare velocemente tutti gli allievi del giorno.</li>
          <li><b>Pianificazione Recuperi:</b> Se un allievo ha lezioni in sospeso, clicca su <i>+ Fissa Recupero</i> per stabilire data e orario del recupero.</li>
          <li><b>Chiusure e Festività:</b> Clicca sull'icona lucchetto nella data in alto per dichiarare un giorno di chiusura festiva (le lezioni non verranno conteggiate come assenze).</li>
          <li><b>Foglio Presenze Stampabile:</b> Clicca su <i>🖨️ Stampa Foglio Presenze</i> per generare il prospetto A4 orizzontale ufficiale con riepilogo saldi e riporto mesi precedenti!</li>
        </ul>
      `
    },
    {
      id: 'pagamenti',
      icon: '💶',
      title: 'Pagamenti Rette & Ricevute Numerate',
      tags: ['pagamenti', 'rette', 'ricevute', 'fatture', 'bonifico', 'contanti', 'in lettere', 'email', 'numerazione'],
      content: `
        <p>Il gestionale offre un tabellone annuale completo per monitorare a colpo d'occhio lo stato dei pagamenti di ogni allievo mese per mese.</p>
        <ul class="wiki-step-list">
          <li><b>Registrazione Incasso:</b> Clicca sul mese corrispondente all'allievo (i mesi non saldati sono evidenziati in grigio, quelli pagati in verde).</li>
          <li><b>Numerazione Automatica:</b> Il gestionale assegna automaticamente il progressivo annuale (es. <i>Ricevuta n. 1/2026</i>, <i>2/2026</i>) per ogni anno solare.</li>
          <li><b>Importo in Lettere Automatico:</b> L'importo numerico viene tradotto istantaneamente in lettere in italiano conforme alle norme fiscali (es. <code>60 €</code> → <code>Sessanta/00</code>).</li>
          <li><b>Invio Email Istantaneo:</b> Spuntando <i>Invia ricevuta via email</i>, la ricevuta viene inviata subito con il modello personalizzato e il documento HTML autonomo in allegato.</li>
          <li><b>Archivio Ricevute:</b> Nella scheda <i>🧾 Ricevute</i> puoi ricercare qualsiasi ricevuta emessa, visualizzarne l'anteprima grafica e ristamparla.</li>
        </ul>
        <div class="wiki-tip">💡 <b>Nota Contabile:</b> Ogni pagamento registrato alimenta automaticamente le entrate della Prima Nota!</div>
      `
    },
    {
      id: 'docenti',
      icon: '👩‍🏫',
      title: 'Docenti, Compensi & Prospetti Liquidazione',
      tags: ['docenti', 'maestri', 'insegnanti', 'liquidazioni', 'compensi', 'fatture', 'prospetto', 'ritenuta', 'percentuale'],
      content: `
        <p>Modulo dedicato alla gestione dei maestri di musica, al calcolo dei compensi maturati sulle rette incassate e alla riconciliazione delle fatture emesse dai docenti.</p>
        <ul class="wiki-step-list">
          <li><b>Anagrafica Docenti:</b> Configura i dati fiscali del maestro (CF, Partita IVA, IBAN) e la percentuale compenso concordata (es. 70%).</li>
          <li><b>Generazione Prospetto Mensile:</b> Nella sezione <i>Prima Nota → Liquidazioni Rette Docenti</i>, seleziona il mese: il programma calcola in automatico tutte le rette effettivamente incassate e genera il prospetto.</li>
          <li><b>Dettaglio Allievi:</b> Il documento include la lista nominativa di tutti gli allievi le cui rette compongono la liquidazione.</li>
          <li><b>Registrazione Fattura:</b> Puoi annotare il numero e la data della fattura o nota di prestazione emessa dal docente.</li>
          <li><b>Stampa ed Invio:</b> Il prospetto numerato può essere stampato su carta intestata o inviato via email direttamente all'insegnante.</li>
        </ul>
      `
    },
    {
      id: 'primanota',
      icon: '📒',
      title: 'Prima Nota Cassa & Banca (Libro Giornale)',
      tags: ['prima nota', 'cassa', 'banca', 'uscite', 'entrate', 'spese', 'saldo', 'libro giornale', 'registro contabile'],
      content: `
        <p>Un vero e proprio registro contabile cronologico per tracciare ogni movimento finanziario della scuola di musica dell'associazione.</p>
        <ul class="wiki-step-list">
          <li><b>Entrate Riconciliate:</b> Le rette allievi incassate confluiscono qui in tempo reale con riferimento al numero di ricevuta.</li>
          <li><b>Entrate Extra:</b> Registra quote d'iscrizione annuali, donazioni, offerte, incassi da saggi o concerti.</li>
          <li><b>Uscite e Spese:</b> Traccia liquidazioni ai docenti, spese per spartiti e materiale didattico, cancelleria, manutenzione strumenti o utenze.</li>
          <li><b>Saldi Progressivi:</b> Il sistema calcola il totale entrate, il totale uscite e il saldo progressivo netto in cassa o banca.</li>
          <li><b>Stampa Registro Contabile:</b> Genera un prospetto PDF/stampa ufficiale per qualsiasi intervallo di date, perfetto per revisioni o rendiconti di fine anno.</li>
        </ul>
      `
    },
    {
      id: 'cloud',
      icon: '☁️',
      title: 'Sincronizzazione Cloud Google Drive',
      tags: ['google drive', 'cloud', 'sincronizzazione', 'oauth', 'backup', 'condivisione', 'auto-sync', 'credenziali'],
      content: `
        <p>Consente a più computer o collaboratori della scuola di lavorare sugli stessi dati sincronizzandoli su una cartella riservata di Google Drive.</p>
        <ul class="wiki-step-list">
          <li><b>Sincronizzazione Trasparente:</b> Ogni salvataggio viene inviato su Google Drive in background dopo qualche secondo.</li>
          <li><b>Allineamento all'Avvio:</b> Quando apri il gestionale, verifica se sul cloud è presente una versione più recente e aggiorna la copia locale.</li>
          <li><b>Pillola di Stato:</b> In alto a destra è sempre presente l'indicatore con l'orario dell'ultimo allineamento. Cliccandoci puoi forzare un caricamento o uno scaricamento immediato.</li>
          <li><b>Auto-Discovery Credenziali:</b> Il gestionale riconosce in automatico il file <code>client_secret_*.json</code> presente nella cartella del programma, senza richiedere noiose configurazioni manuali!</li>
        </ul>
        <div class="wiki-tip">🛡️ <b>Sicurezza Massima:</b> Prima di scaricare dati dal cloud che potrebbero sovrascrivere il file locale, viene sempre creato in automatico un backup di emergenza (<code>db-pre-cloud-...</code>)!</div>
      `
    },
    {
      id: 'sicurezza',
      icon: '💾',
      title: 'Salvataggi, Backup & Ripristino Dati',
      tags: ['backup', 'dati', 'ripristino', 'db.json', 'sicurezza', 'appdata', 'chiavetta', 'salvataggio'],
      content: `
        <p>I tuoi dati non dipendono da server esterni misteriosi: risiedono in formato aperto e leggibile (<code>db.json</code>) sul tuo computer.</p>
        <ul class="wiki-step-list">
          <li><b>Posizione Versione Installata (.exe):</b> I dati sono in <code>%APPDATA%\\Tralci di Note\\data\\db.json</code>. Gli aggiornamenti dell'applicazione non cancellano mai il database.</li>
          <li><b>Posizione Versione Portatile:</b> Nella sottocartella <code>data/db.json</code> della cartella del programma.</li>
          <li><b>Backup Giornalieri Automatici:</b> Ogni giorno viene creata una copia in <code>data/backup/db-[DATA].json</code>.</li>
          <li><b>Download Immediato:</b> Puoi scaricare in qualunque momento una copia di sicurezza del database cliccando sul pulsante <i>💾 Scarica Backup Database</i>.</li>
        </ul>
      `
    },
    {
      id: 'scorciatoie',
      icon: '💻',
      title: 'Scorciatoie da Tastiera & Domande Frequenti (FAQ)',
      tags: ['faq', 'scorciatoie', 'tasti', 'problemi', 'risoluzione', 'aiuto', 'f1'],
      content: `
        <ul class="wiki-step-list">
          <li><code>F1</code>: Apri la Guida e Wiki ufficiale in qualunque momento.</li>
          <li><code>Ctrl + R</code>: Ricarica l'interfaccia e aggiorna i dati dallo storage.</li>
          <li><code>Ctrl + P</code>: Apre la schermata di stampa nativa del prospetto visualizzato.</li>
          <li><b>Come installare su un altro PC?</b> Copia il file <code>dist/Tralci di Note Setup 1.3.1.exe</code> su una chiavetta ed eseguilo sul nuovo computer: non serve installare Node.js!</li>
          <li><b>Come rigenerare l'installer dopo modifiche?</b> Fai doppio clic su <code>Crea Installer.bat</code>.</li>
          <li><b>Invio email non riuscito?</b> Se usi Gmail, genera una <i>Password per le app</i> con l'autenticazione a due fattori attiva nel tuo account Google e inseriscila nelle Impostazioni.</li>
        </ul>
      `
    }
  ];

  const filtered = SECTIONS.filter(s => {
    if (sec !== 'all' && s.id !== sec) return false;
    if (!q) return true;
    return s.title.toLowerCase().includes(q)
      || s.tags.some(t => t.includes(q))
      || s.content.toLowerCase().includes(q);
  });

  return `
  <div class="wiki-header">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <h1>📖 Guida Ufficiale e Wiki — Tralci di Note</h1>
        <p>Manuale operativo completo per l'amministrazione, la didattica e la contabilità della scuola di musica <b>Come Tralci - Novara</b>.</p>
      </div>
      <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff;font-size:12px;padding:6px 12px;">v${esc(S?.version || APP_VERSION)}</span>
    </div>
    <div class="wiki-actions">
      <a href="/api/backup/download" class="btn" style="background:#fff;color:#1e3a8a;border-color:#fff;" title="Scarica copia locale del database"><span style="margin-right:4px;">💾</span> Scarica Backup Database</a>
      <a href="#impostazioni" class="btn" style="background:rgba(255,255,255,0.15);color:#fff;border-color:rgba(255,255,255,0.4);"><span style="margin-right:4px;">⚙️</span> Vai alle Impostazioni</a>
      <button type="button" class="btn" onclick="window.print()" style="background:rgba(255,255,255,0.15);color:#fff;border-color:rgba(255,255,255,0.4);"><span style="margin-right:4px;">🖨️</span> Stampa Guida</button>
    </div>
  </div>

  <div class="wiki-filter-bar">
    <div style="flex:1;min-width:240px;max-width:400px;">
      <input id="guida-search" type="search" placeholder="🔍 Cerca nella guida (es. dashboard, ricevute, presenze)…" value="${esc(ui.guidaSearch)}">
    </div>
    <div class="wiki-pills">
      <button type="button" class="wiki-pill ${sec === 'all' ? 'active' : ''}" data-act="guida-cat" data-sec="all">Tutte le sezioni</button>
      <button type="button" class="wiki-pill ${sec === 'dashboard' ? 'active' : ''}" data-act="guida-cat" data-sec="dashboard">📊 Dashboard</button>
      <button type="button" class="wiki-pill ${sec === 'studenti' ? 'active' : ''}" data-act="guida-cat" data-sec="studenti">👤 Studenti</button>
      <button type="button" class="wiki-pill ${sec === 'presenze' ? 'active' : ''}" data-act="guida-cat" data-sec="presenze">📅 Presenze</button>
      <button type="button" class="wiki-pill ${sec === 'pagamenti' ? 'active' : ''}" data-act="guida-cat" data-sec="pagamenti">💶 Pagamenti</button>
      <button type="button" class="wiki-pill ${sec === 'docenti' ? 'active' : ''}" data-act="guida-cat" data-sec="docenti">👩‍🏫 Docenti</button>
      <button type="button" class="wiki-pill ${sec === 'primanota' ? 'active' : ''}" data-act="guida-cat" data-sec="primanota">📒 Prima Nota</button>
      <button type="button" class="wiki-pill ${sec === 'cloud' ? 'active' : ''}" data-act="guida-cat" data-sec="cloud">☁️ Google Drive</button>
      <button type="button" class="wiki-pill ${sec === 'sicurezza' ? 'active' : ''}" data-act="guida-cat" data-sec="sicurezza">💾 Backup &amp; Dati</button>
      <button type="button" class="wiki-pill ${sec === 'scorciatoie' ? 'active' : ''}" data-act="guida-cat" data-sec="scorciatoie">💻 FAQ &amp; Tasti</button>
    </div>
  </div>

  ${filtered.length ? `
    <div class="wiki-grid">
      ${filtered.map(card => `
        <div class="wiki-card" id="wiki-card-${card.id}">
          <div class="wiki-card-title">
            <span class="wiki-card-icon">${card.icon}</span>
            <span>${card.title}</span>
          </div>
          <div>${card.content}</div>
        </div>
      `).join('')}
    </div>
  ` : `
    <div class="card pad" style="text-align:center;padding:48px 20px;">
      <div style="font-size:36px;margin-bottom:10px;">🔍 ❓</div>
      <h3 style="margin:0 0 8px 0;">Nessun argomento trovato per "${esc(q)}"</h3>
      <p class="muted">Prova a cercare termini più generici come <i>ricevuta</i>, <i>allievi</i>, <i>recupero</i>, <i>email</i> o <i>backup</i>.</p>
      <button type="button" class="btn primary small" data-act="guida-clear" style="margin-top:10px;">Mostra tutta la guida</button>
    </div>
  `}

  <div class="card pad" style="background:#f8fafc;border-color:#cbd5e1;text-align:center;margin-top:20px;">
    <h4 style="margin:0 0 6px 0;color:#0f172a;">Serve ulteriore assistenza tecnica o vuoi proporre miglioramenti?</h4>
    <p class="muted small" style="margin:0;">
      Il gestionale è sviluppato e curato da <b>Bruno Astemio</b> con <b>Antigravity</b> per <i>Come Tralci - Novara</i>.<br>
      Documento tecnico persistente: <span class="code-inline">WIKI.md</span> nella cartella principale del gestionale.
    </p>
  </div>`;
}


let autoSaveSettingsTimer = null;

function extractSettingsPayloadFromForm(f) {
  const fd = new FormData(f);
  const o = { smtp: {} };
  for (const [k, v] of fd) {
    if (k.startsWith('smtp.')) o.smtp[k.slice(5)] = v;
    else if (!k.startsWith('google.')) o[k] = v;
  }
  o.smtp.secure = fd.has('smtp.secure');
  if (S && S.settings) {
    for (const k of ['scuola', 'indirizzo', 'citta', 'codiceFiscale', 'firmatarioSegreteria', 'firmatarioMaestro', 'notaRicevuta', 'emailTesto', 'annoScolasticoInizio', 'annoScolasticoFine', 'emailTestoLiquidazione']) {
      if (k in o) S.settings[k] = String(o[k]);
    }
    if ('rettaDefault' in o) S.settings.rettaDefault = Number(o.rettaDefault) || 0;
    if (S.settings.smtp && o.smtp) {
      for (const k of ['host', 'user', 'from']) if (k in o.smtp) S.settings.smtp[k] = String(o.smtp[k]);
      if ('port' in o.smtp) S.settings.smtp.port = Number(o.smtp.port) || 465;
      S.settings.smtp.secure = !!o.smtp.secure;
    }
  }
  return o;
}

async function persistSettingsFromDom() {
  const f = $('#settings-form');
  if (!f) return null;
  if (autoSaveSettingsTimer) {
    clearTimeout(autoSaveSettingsTimer);
    autoSaveSettingsTimer = null;
  }
  const o = extractSettingsPayloadFromForm(f);
  const saved = await api('PUT', '/api/settings', o);
  if (S && saved) S.settings = saved;
  const folderName = $('[name="google.folderName"]', f)?.value?.trim();
  const autoSync = $('[name="google.autoSync"]', f)?.checked;
  if (folderName !== undefined) {
    await api('POST', '/api/google/config', { folderName: folderName || 'Gestionale Scuola di Musica', autoSync: !!autoSync });
  }
  return saved;
}

function scheduleAutoSaveSettings() {
  const f = $('#settings-form');
  if (!f) return;
  extractSettingsPayloadFromForm(f);
  if (autoSaveSettingsTimer) clearTimeout(autoSaveSettingsTimer);
  autoSaveSettingsTimer = setTimeout(() => {
    persistSettingsFromDom().catch(() => {});
  }, 250);
}

async function saveGoogleConfig() {
  await persistSettingsFromDom();
  toast('Opzioni Google Drive e impostazioni salvate');
  await loadGoogleStatus();
  render();
}

function toggleCloudGuide() {
  const el = $('#cloud-guide-content');
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
}

async function saveSettings(silent) {
  try {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  } catch (_) {}
  await persistSettingsFromDom();
  if (!silent) toast('✅ Impostazioni salvate');
  await reload();
}

async function testEmail() {
  await saveSettings(true);
  const defaultEmail = S.settings.smtp.user || '';
  const to = await asyncPrompt({
    title: 'Test Invio Email SMTP',
    message: 'Invia un\'email di prova per verificare che la configurazione del server SMTP sia funzionante:',
    value: defaultEmail,
    placeholder: 'tua-email@dominio.it',
    inputType: 'email',
    confirmText: 'Invia Prova',
    confirmIcon: '✉',
    required: true
  });
  if (!to || !to.trim()) return;
  const destEmail = to.trim();

  toast('Invio email di prova in corso…');
  try {
    await api('POST', '/api/test-email', { to: destEmail });
    toast(`Email di prova inviata con successo a ${destEmail} ✉`);
  } catch (err) {
    toast(`Errore invio email: ${err.message}`, 'err');
  }
}

// ---------------------------------------------------------------- GESTIONE STRUMENTI
async function quickAddStrumentoForStudent() {
  const nome = await asyncPrompt({
    title: 'Nuovo Strumento o Corso',
    message: 'Inserisci il nome del nuovo strumento/corso da aggiungere alle opzioni:',
    placeholder: 'es. Batteria, Violino, Basso...',
    confirmText: 'Aggiungi',
    required: true
  });
  if (!nome || !nome.trim()) return;
  const pulito = nome.trim();
  try {
    const list = await api('POST', '/api/instruments', { nome: pulito });
    S.settings.strumenti = list;
    const sel = $('#student-strumento-select');
    if (sel) {
      sel.innerHTML = `<option value="">— Seleziona strumento —</option>` +
        list.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
      sel.value = pulito;
    }
    toast(`Strumento "${pulito}" aggiunto con successo!`);
  } catch (err) {
    toast(err.message, 'err');
  }
}

function manageStrumentiDialog() {
  if ($('#settings-form')) {
    persistSettingsFromDom().catch(() => {});
  }
  const renderContent = () => {
    const list = getStrumenti();
    return `
      <p class="muted small" style="margin-top:0;">Aggiungi nuovi strumenti, rinomina o elimina quelli esistenti.</p>
      <div style="display:flex; gap:8px; margin-bottom:14px;">
        <input id="new-strumento-input" placeholder="Nuovo strumento (es. Batteria, Violino...)" style="flex:1;">
        <button type="button" class="btn primary" id="btn-add-strumento">➕ Aggiungi</button>
      </div>
      <div class="card" style="max-height:340px; overflow-y:auto;">
        <table class="tbl">
          <thead><tr><th>Strumento</th><th class="num">Allievi iscritti</th><th class="right">Azioni</th></tr></thead>
          <tbody>
            ${list.map(st => {
              const count = S.students.filter(x => (x.strumento || '').toLowerCase() === st.toLowerCase()).length;
              return `<tr>
                <td><b>${esc(st)}</b></td>
                <td class="num"><span class="badge ${count > 0 ? 'ok' : 'off'}">${count} alliev${count === 1 ? 'o' : 'i'}</span></td>
                <td class="right" style="white-space:nowrap;">
                  <button type="button" class="btn small" data-act="strumento-rename" data-nome="${esc(st)}">✏️ Rinomina</button>
                  <button type="button" class="btn small danger" data-act="strumento-del" data-nome="${esc(st)}" data-count="${count}">🗑️ Elimina</button>
                </td>
              </tr>`;
            }).join('') || '<tr><td colspan="3" class="empty">Nessuno strumento configurato</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  };

  openDialog({
    title: '🎸 Gestione Strumenti e Corsi',
    body: `<div id="manage-strumenti-box">${renderContent()}</div>`,
    actions: `<span class="spacer"></span><button type="button" class="btn primary" data-close>Fatto</button>`,
  });

  const d = $('#dlg');
  const refresh = () => {
    const b = $('#manage-strumenti-box');
    if (b) b.innerHTML = renderContent();
  };

  d.onclick = async e => {
    const addBtn = e.target.closest('#btn-add-strumento');
    if (addBtn) {
      const inp = $('#new-strumento-input');
      const val = inp?.value?.trim();
      if (!val) { toast('Inserisci il nome dello strumento', 'err'); return; }
      try {
        const updated = await api('POST', '/api/instruments', { nome: val });
        S.settings.strumenti = updated;
        toast(`Strumento "${val}" aggiunto!`);
        refresh();
        if (ui.tab === 'impostazioni' || ui.tab === 'studenti') render();
      } catch (err) { toast(err.message, 'err'); }
      return;
    }

    const renBtn = e.target.closest('[data-act="strumento-rename"]');
    if (renBtn) {
      const vecchio = renBtn.dataset.nome;
      const nuovo = await asyncPrompt({
        title: 'Rinomina Strumento',
        message: `Rinomina lo strumento "${vecchio}" in:`,
        value: vecchio,
        confirmText: 'Rinomina',
        required: true
      });
      if (!nuovo || !nuovo.trim() || nuovo.trim().toLowerCase() === vecchio.toLowerCase()) return;
      try {
        const updated = await api('PUT', '/api/instruments', { vecchioNome: vecchio, nuovoNome: nuovo.trim(), aggiornaStudenti: true });
        S.settings.strumenti = updated;
        S.students.forEach(s => {
          if (s.strumento && s.strumento.toLowerCase() === vecchio.toLowerCase()) s.strumento = nuovo.trim();
        });
        toast(`Strumento rinominato in "${nuovo.trim()}"!`);
        refresh();
        if (ui.tab === 'impostazioni' || ui.tab === 'studenti') render();
      } catch (err) { toast(err.message, 'err'); }
      return;
    }

    const delBtn = e.target.closest('[data-act="strumento-del"]');
    if (delBtn) {
      const nome = delBtn.dataset.nome;
      const count = Number(delBtn.dataset.count || 0);
      let msg = `Vuoi rimuovere "${nome}" dall'elenco degli strumenti?`;
      if (count > 0) {
        msg = `Attenzione: ci sono ${count} allievi iscritti a "${nome}".\nLo strumento verrà rimosso dall'elenco delle scelte.\n\nVuoi continuare?`;
      }
      if (!confirm(msg)) return;
      try {
        const updated = await api('DELETE', '/api/instruments/' + encodeURIComponent(nome));
        S.settings.strumenti = updated;
        toast(`Strumento "${nome}" rimosso!`);
        refresh();
        if (ui.tab === 'impostazioni' || ui.tab === 'studenti') render();
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
  };

  d.onkeydown = e => {
    if (e.key === 'Enter' && e.target.id === 'new-strumento-input') {
      e.preventDefault();
      $('#btn-add-strumento')?.click();
    }
  };
}

// ---------------------------------------------------------------- eventi
const ACTIONS = {
  'student-new': () => studentDialog(),
  'student-edit': d => studentDialog(d.id),
  'student-delete': d => studentDelete(d.id),
  'student-quick-add-strumento': () => quickAddStrumentoForStudent(),
  'manage-strumenti': () => manageStrumentiDialog(),

  'pay-new': d => paymentNewDialog(d.sid, d.mese),
  'pay-view': d => paymentViewDialog(d.id),
  'pay-delete': d => paymentDelete(d.id),
  'receipt-share': d => shareReceiptNative(d.id),
  'receipt-print': d => openReceipt(d.id, false),
  'receipt-email': d => receiptEmail(d.id),

  'att': d => toggleAtt(d.sid, d.date),
  'weekly-schedule-open': () => openWeeklyScheduleDialog(),
  'rec-new': () => recoveryDialog(),
  'rec-cell': d => recoveryDialog({ studentId: d.sid, date: d.date }),
  'rec-view': d => recoveryViewDialog(d.id),
  'rec-del': async d => {
    if (!confirm('Eliminare questa lezione di recupero dal calendario?')) return;
    await api('DELETE', '/api/recoveries/' + d.id);
    closeDialog();
    toast('Lezione di recupero eliminata');
    await reload();
  },
  'day-menu': d => dayMenu(d.date),
  'day-set': async d => {
    await api('POST', '/api/attendance/day', { date: d.date, value: d.value });
    closeDialog();
    toast(d.value ? 'Tutti gli allievi segnati presenti' : 'Segnature del giorno cancellate');
    await reload();
  },
  'day-close': async d => {
    await api('PUT', '/api/closures', { date: d.date, closed: !!d.closed });
    closeDialog();
    toast(d.closed ? 'Giorno segnato come chiuso' : 'Giorno riaperto');
    await reload();
  },
  'month': d => {
    const delta = Number(d.delta);
    if (!delta) ui.presMese = today().slice(0, 7);
    else { const [y, m] = ui.presMese.split('-').map(Number); ui.presMese = ymd(new Date(y, m - 1 + delta, 1)).slice(0, 7); }
    render();
  },
  'presenze-print': () => {
    if (window.Android && typeof window.Android.printHtml === 'function' && window.PrintTemplates?.renderAttendanceSheetHtml) {
      const html = window.PrintTemplates.renderAttendanceSheetHtml(S, ui.presMese);
      window.Android.printHtml(html, `Foglio_Presenze_${ui.presMese}`);
      return;
    }
    window.open(`/presenze/stampa?mese=${ui.presMese}`, '_blank');
  },

  // Dashboard
  'dash-period': d => { ui.dashPeriod = d.period; render(); },
  'dash-print': () => {
    if (window.Android && typeof window.Android.printCurrentPage === 'function') {
      window.Android.printCurrentPage('Dashboard_Tralci_di_Note');
    } else {
      window.print();
    }
  },
  'dash-refresh': async () => { toast('Aggiornamento dati in corso...'); await reload(); toast('Dati aggiornati'); },

  // Eventi Prima Nota & Liquidazioni
  'pn-subtab': d => { ui.pnSubTab = d.sub; render(); },
  'pn-filter-tipo': d => { ui.pnTipo = d.tipo; render(); },
  'pn-print': () => openCashbookPrint(),
  'tp-new': d => teacherPaymentDialog(null, d.mese),
  'tp-edit': d => teacherPaymentDialog(d.id),
  'tp-delete': d => teacherPaymentDelete(d.id),
  'tp-print': d => openTeacherPayment(d.id, false),
  'tp-email': d => teacherPaymentEmail(d.id),

  'expense-new': () => expenseDialog(),
  'expense-edit': d => expenseDialog(d.id),
  'expense-delete': d => expenseDelete(d.id),

  'income-new': () => incomeExtraDialog(),
  'income-edit': d => incomeExtraDialog(d.id),
  'income-delete': d => incomeExtraDelete(d.id),

  'test-email': () => testEmail(),
  'save-settings': () => saveSettings(false),

  // Google Drive
  'cloud-menu': () => openCloudMenu(),
  'cloud-quick-sync': () => syncGoogle('upload'),
  'cloud-sync': d => syncGoogle(d.dir || 'auto'),
  'cloud-connect': () => connectGoogle(),
  'cloud-disconnect': () => disconnectGoogle(),
  'cloud-save-config': () => saveGoogleConfig(),
  'toggle-cloud-guide': () => toggleCloudGuide(),

  // Guida & Backup
  'guida-cat': d => { ui.guidaSection = d.sec || 'all'; render(); },
  'guida-clear': () => { ui.guidaSearch = ''; ui.guidaSection = 'all'; render(); },
  'backup-download': () => {
    if (window.Android && typeof window.Android.saveFile === 'function' && window.LocalDbEngine) {
      const jsonStr = JSON.stringify(window.LocalDbEngine.getDb(), null, 2);
      const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      const fileName = `TralciDiNote_Backup_${today()}.json`;
      window.Android.saveFile(fileName, b64, 'application/json');
      return;
    }
    window.location.href = '/api/backup/download';
  },

  // Logo a dimensione intera
  'show-logo-modal': () => {
    openDialog({
      title: 'Tralci di Note — Logo Ufficiale',
      body: `
        <div style="text-align:center;padding:10px 4px;">
          <div style="background:#ffffff;border-radius:12px;padding:16px;display:inline-block;box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:100%;border:1px solid #e2e8f0;">
            <img src="logo.png" alt="Logo Tralci di Note" style="max-width:100%;max-height:65vh;object-fit:contain;display:block;margin:0 auto;border-radius:6px;">
          </div>
          <div style="margin-top:16px;font-weight:700;font-size:16px;color:#0f172a;">Tralci di Note — Come Tralci - Novara</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px;">Chiesa Evangelica Pentecostale e Missionaria Come Tralci - Novara</div>
        </div>
      `,
      actions: `
        <span class="spacer"></span>
        <button type="button" class="btn primary" data-close>Chiudi</button>
      `,
      isWide: true
    });
  },

  // Registro Versioni (Changelog)
  'show-changelog-modal': () => openChangelogModal(),

  // Chiudi Applicazione
  'app-close': () => confirmAppCloseDialog(),
};

function confirmAppCloseDialog() {
  const isAndroidApp = !!(window.Android && typeof window.Android.closeApp === 'function');
  openDialog({
    title: '🚪 Chiudi Tralci di Note',
    body: `
      <div style="text-align:center;padding:12px 6px 16px;">
        <div style="font-size:42px;margin-bottom:8px;">🌿</div>
        <div style="font-size:16.5px;font-weight:700;color:var(--ink);margin-bottom:6px;">Confermi di voler chiudere il gestionale?</div>
        <div class="muted small" style="line-height:1.55;max-width:390px;margin:0 auto 16px;">
          Tutti i dati, le presenze, i pagamenti e le impostazioni sono salvati in sicurezza sul database locale del dispositivo.
        </div>
        ${!isAndroidApp ? `
        <label class="check" style="justify-content:center;font-size:13px;color:#475569;margin-bottom:0;">
          <input type="checkbox" id="close-stop-server" checked>
          <span>Arresta anche il server locale in background</span>
        </label>
        ` : ''}
      </div>
    `,
    actions: `
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Annulla</button>
      <button type="button" class="btn danger" id="btn-do-close">Chiudi Gestionale</button>
    `,
  });

  setTimeout(() => {
    const btn = $('#btn-do-close');
    if (btn) {
      btn.onclick = async () => {
        const stopServer = $('#close-stop-server')?.checked;
        closeDialog();

        if (window.Android && window.LocalDbEngine) {
          window.LocalDbEngine.save();
        }

        if (isAndroidApp) {
          window.Android.closeApp();
          return;
        }

        if (stopServer) {
          try {
            await api('POST', '/api/shutdown');
          } catch (_) {}
        }

        try {
          window.close();
        } catch (_) {}

        setTimeout(() => {
          document.body.innerHTML = `
            <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#fff;font-family:'Inter',system-ui,-apple-system,sans-serif;padding:24px;text-align:center;">
              <div style="max-width:440px;background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:36px 28px;box-shadow:0 20px 40px rgba(0,0,0,0.4);">
                <div style="font-size:48px;margin-bottom:12px;">🌿</div>
                <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff;">Tralci di Note Chiuso</h2>
                <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
                  I dati sono salvati regolarmente.<br>
                  <b>Puoi ora chiudere questa scheda.</b>
                </p>
                <button onclick="location.reload()" style="background:#2563eb;color:#fff;border:0;padding:10px 22px;border-radius:8px;font-weight:600;font-size:13.5px;cursor:pointer;box-shadow:0 2px 8px rgba(37,99,235,0.35);">
                  Riapri Gestionale
                </button>
              </div>
            </div>
          `;
        }, 120);
      };
    }
  }, 50);
}

function initGoogleSyncEvents() {
  if (!window.Android && window.EventSource) {
    try {
      const es = new EventSource('/api/google/events');
      es.onmessage = e => {
        try {
          const data = JSON.parse(e.data);
          const prevSync = G_DRIVE?.lastSync;
          const wasSyncing = isSyncing || G_DRIVE?.syncInProgress;
          G_DRIVE = data;
          if (data.lastSync && data.lastSync !== prevSync && !data.syncInProgress) {
            isSyncing = false;
            triggerJustSynced();
            if (data.lastSyncAction === 'download') {
              reload().then(() => toast('Cloud: Dati sincronizzati da Google Drive'));
            }
          } else if (data.syncInProgress) {
            isSyncing = true;
            renderCloudPill();
          } else if (wasSyncing && !data.syncInProgress) {
            isSyncing = false;
            renderCloudPill();
          } else {
            renderCloudPill();
          }
        } catch (_) {}
      };
    } catch (_) {}
  }

  window.addEventListener('focus', () => {
    loadGoogleStatus();
  });

  setInterval(() => {
    if (!isSyncing) loadGoogleStatus();
  }, 25000);
}

window.addEventListener('message', e => {
  if (e.data && e.data.type === 'google-auth-success') {
    toast('🎉 Account Google collegato con successo!');
    loadGoogleStatus().then(() => reload());
  } else if (e.data && e.data.type === 'google-auth-error') {
    toast('Errore collegamento Google: ' + (e.data.error || ''), 'err');
  }
});


document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !ACTIONS[el.dataset.act]) return;
  e.preventDefault();
  Promise.resolve(ACTIONS[el.dataset.act](el.dataset, el)).catch(err => toast(err.message, 'err'));
});

document.addEventListener('input', e => {
  const key = { search: 'search', 'ric-search': 'ricSearch', 'pn-search': 'pnSearch', 'guida-search': 'guidaSearch' }[e.target.id];
  if (!key) return;
  ui[key] = e.target.value;
  render();
  const el = $('#' + e.target.id);
  if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
});

document.addEventListener('change', e => {
  if (e.target.id === 'pn-filter-mese') { ui.pnMese = e.target.value; render(); }
});

addEventListener('hashchange', async () => {
  if ($('#settings-form')) {
    try { await persistSettingsFromDom(); } catch (_) {}
  }
  ui.tab = location.hash.slice(1) || 'dashboard';
  render();
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
});

reload().then(() => {
  initGoogleSyncEvents();
}).catch(err => { $('#view').innerHTML = `<p class="loading">Errore caricamento: ${esc(err.message)}</p>`; });
