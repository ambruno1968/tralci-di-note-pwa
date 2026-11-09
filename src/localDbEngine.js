// localDbEngine.js - Database locale autonomo completo per Tralci di Note Android
'use strict';

(function () {
  const DB_STORAGE_KEY = 'tralci_note_db';

  const DEFAULT_SETTINGS = {
    scuola: 'Come Tralci - Novara — Scuola di Musica',
    associazioneEstesa: 'Chiesa Evangelica Pentecostale e Missionaria Come Tralci - Novara',
    indirizzo: 'Via Enrico Mattei, 4',
    citta: 'Novara',
    codiceFiscale: '',
    firmatario: 'Segreteria chiesa: Bruno Astemio',
    firmatarioRicevute: 'Segreteria chiesa: Bruno Astemio',
    firmatarioProspetti: 'Maestro Dario Artuso',
    firmatarioSegreteria: 'Bruno Astemio',
    firmatarioMaestro: 'Maestro Dario Artuso',
    rettaDefault: 60,
    notaRicevuta: 'Le rette saranno consegnate al maestro con un prospetto di liquidazione consultabile su richiesta.\nBruno A.',
    annoScolasticoInizio: '2026-10-01',
    annoScolasticoFine: '2027-06-30',
    strumenti: ['Canto', 'Basso', 'Piano', 'Chitarra'],
    smtp: { host: '', port: 465, secure: true, user: '', pass: '', from: '' },
    emailTesto: 'Gentile {intestatario},\n\nconfermiamo di aver ricevuto il pagamento di {importo} per la retta di {mese} di {allievo}.\nDi seguito trova la ricevuta n. {numero}.\n\nGrazie e a presto!\n{firmatario}\n{scuola}',
    emailTestoLiquidazione: 'In allegato il prospetto di liquidazione rette n. {numero}/{anno} per il mese di {mese}.\n\nImporto: {importo}\nFattura: {fattura}\n\nGrazie e a presto!\n{firmatario}\n{scuola}'
  };

  const WD = { 'Domenica': 0, 'Lunedì': 1, 'Martedì': 2, 'Mercoledì': 3, 'Giovedì': 4, 'Venerdì': 5, 'Sabato': 6 };
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const round2 = n => Math.round(Number(n || 0) * 100) / 100;
  const fullName = s => `${s?.nome || ''} ${s?.cognome || ''}`.trim();
  const uid = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : ('id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10));

  let db = {
    students: [],
    payments: [],
    attendance: {},
    closures: [],
    teachers: [],
    teacherPayments: [],
    expenses: [],
    incomeExtra: [],
    recoveries: [],
    weeklySchedules: {},
    settings: { ...DEFAULT_SETTINGS, smtp: { ...DEFAULT_SETTINGS.smtp } }
  };

  let initialized = false;

  function ensureDbIntegrity() {
    if (!db || typeof db !== 'object') db = {};
    db.students ||= [];
    db.payments ||= [];
    db.attendance ||= {};
    db.closures ||= [];
    db.teachers ||= [];
    db.teacherPayments ||= [];
    db.expenses ||= [];
    db.incomeExtra ||= [];
    db.recoveries ||= [];
    db.weeklySchedules ||= {};

    const st = db.settings || {};
    db.settings = {
      ...DEFAULT_SETTINGS,
      ...st,
      smtp: { ...DEFAULT_SETTINGS.smtp, ...(st.smtp || {}) }
    };

    if (!Array.isArray(db.settings.strumenti) || db.settings.strumenti.length === 0) {
      db.settings.strumenti = ['Canto', 'Basso', 'Piano', 'Chitarra'];
    }
    if (!db.teachers.length) {
      db.teachers.push({
        id: uid(),
        nome: 'Bruno',
        cognome: 'Astemio',
        cf: '',
        piva: '',
        email: '',
        telefono: '',
        compensoPerc: 70,
        iban: '',
        note: 'Insegnante'
      });
    }

    for (const tp of db.teacherPayments) {
      if (!Array.isArray(tp.paymentIds)) tp.paymentIds = [];
      if (tp.studentiCoinvolti && tp.studentiCoinvolti.length > 0) {
        for (const sc of tp.studentiCoinvolti) {
          const match = db.payments.find(p => {
            if (sc.paymentId && p.id === sc.paymentId) return true;
            if (p.mese !== tp.mese) return false;
            if (sc.id && p.studentId === sc.id) return true;
            if (sc.ricevuta && `${p.numero}/${p.anno}` === sc.ricevuta) return true;
            return false;
          });
          if (match) {
            sc.paymentId = match.id;
            if (!tp.paymentIds.includes(match.id)) tp.paymentIds.push(match.id);
            match.teacherPaymentId = tp.id;
            match.teacherPaymentNumero = tp.numero;
          }
        }
      }
    }

    if (db.attendance && Array.isArray(db.students)) {
      for (const [k, val] of Object.entries(db.attendance)) {
        if (val === 'REC') {
          const [sid, dStr] = k.split('|');
          const s = db.students.find(x => x.id === sid);
          if (s && dStr) {
            const [y, m, d] = dStr.split('-').map(Number);
            const wd = new Date(y, m - 1, d).getDay();
            if (WD[s.giorno] === wd) {
              db.attendance[k] = 'P';
            }
          }
        }
      }
    }
  }

  async function init() {
    if (initialized) return db;

    let androidCandidate = null;
    let lsCandidate = null;

    // 1. Storage nativo Android (che include il fallback automatico a default-db.json)
    if (window.Android && typeof window.Android.readLocalDb === 'function') {
      try {
        const raw = window.Android.readLocalDb();
        if (raw && raw.length > 20) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.students)) {
            androidCandidate = parsed;
          }
        }
      } catch (e) {
        console.warn('Errore lettura da Android storage:', e);
      }
    }

    // 2. localStorage
    try {
      const saved = localStorage.getItem(DB_STORAGE_KEY);
      if (saved && saved.length > 20) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.students)) {
          lsCandidate = parsed;
        }
      }
    } catch (_) {}

    if (androidCandidate && lsCandidate) {
      const tAndroid = androidCandidate._updatedAt ? new Date(androidCandidate._updatedAt).getTime() : 0;
      const tLs = lsCandidate._updatedAt ? new Date(lsCandidate._updatedAt).getTime() : 0;
      db = (tLs > tAndroid) ? lsCandidate : androidCandidate;
      ensureDbIntegrity();
      save(true);
      initialized = true;
      return db;
    } else if (androidCandidate) {
      db = androidCandidate;
      ensureDbIntegrity();
      save(true);
      initialized = true;
      return db;
    } else if (lsCandidate) {
      db = lsCandidate;
      ensureDbIntegrity();
      save(true);
      initialized = true;
      return db;
    }

    // 3. Asset di default tramite bridge Android
    if (window.Android && typeof window.Android.readAssetFile === 'function') {
      try {
        const assetRaw = window.Android.readAssetFile('default-db.json');
        if (assetRaw && assetRaw.length > 20) {
          db = JSON.parse(assetRaw);
          ensureDbIntegrity();
          save(true);
          initialized = true;
          return db;
        }
      } catch (e) {
        console.warn('Errore readAssetFile default-db.json:', e);
      }
    }

    // 4. Asset di default via fetch / XHR
    try {
      const res = await fetch('default-db.json');
      if (res.ok) {
        db = await res.json();
        ensureDbIntegrity();
        save(true);
        initialized = true;
        return db;
      }
    } catch (_) {}

    ensureDbIntegrity();
    initialized = true;
    return db;
  }

  let cloudUploadTimer = null;

  function scheduleCloudUpload() {
    try {
      if (!window.gDriveClient) return;
      const st = window.gDriveClient.getStatus();
      if (!st.connected || !st.autoSync) return;
      if (cloudUploadTimer) clearTimeout(cloudUploadTimer);
      cloudUploadTimer = setTimeout(async () => {
        try {
          await window.gDriveClient.uploadDb(db);
        } catch (err) {
          console.warn('Auto-sync Google Drive warning:', err.message);
        }
      }, 400);
    } catch (_) {}
  }

  function save(skipCloud = false) {
    try {
      if (!skipCloud) {
        db._updatedAt = new Date().toISOString();
      }
      const json = JSON.stringify(db);
      try {
        localStorage.setItem(DB_STORAGE_KEY, json);
      } catch (_) {}
      if (window.Android && typeof window.Android.saveLocalDb === 'function') {
        window.Android.saveLocalDb(json);
      }
      if (!skipCloud) {
        scheduleCloudUpload();
      }
    } catch (e) {
      console.error('Errore salvataggio localDb:', e);
    }
  }

  function getMondayOfDate(dStr) {
    const [y, m, d] = (dStr || today()).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    dt.setDate(dt.getDate() + diff);
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

  function buildDefaultWeekSchedule(weekStart) {
    const dates = getWeekDates(weekStart);
    const studs = (db.students || []).filter(s => s.stato === 'Attivo');
    const recs = db.recoveries || [];
    const att = db.attendance || {};
    const days = {};

    dates.forEach(dStr => {
      const [y, m, d] = dStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const wdIndex = dt.getDay();

      const daySlots = [];
      const addedStudIds = new Set();

      studs.filter(s => WD[s.giorno] === wdIndex).forEach(s => {
        addedStudIds.add(s.id);
        const attVal = att[`${s.id}|${dStr}`] || '';
        const hasSeparateRec = recs.some(r => r.studentId === s.id && r.date === dStr);
        let stato = 'CONFERMATO';
        if (attVal === 'A' || attVal === 'G') stato = 'ASSENTE';
        else if (!hasSeparateRec && (attVal === 'R' || attVal === 'REC')) stato = 'RECUPERO';

        daySlots.push({
          id: uid(),
          studentId: s.id,
          nome: fullName(s),
          strumento: s.strumento || '',
          orario: s.orario || '',
          telefono: s.telefono || '',
          email: s.email || '',
          stato,
          tipo: 'regolare',
          note: (stato === 'ASSENTE' ? 'Assenza registrata' : '')
        });
      });

      recs.filter(r => r.date === dStr && r.stato !== 'ANNULLATO').forEach(r => {
        const s = studs.find(x => x.id === r.studentId) || (db.students || []).find(x => x.id === r.studentId);
        const nomeStud = s ? fullName(s) : 'Allievo';
        const stru = s ? s.strumento : '';
        let noteRec = r.note || 'Recupero assenza';
        if (r.sostituisceStudentId) {
          const sostStud = (db.students || []).find(x => x.id === r.sostituisceStudentId);
          if (sostStud && !noteRec.includes(fullName(sostStud))) {
            noteRec += ` (al posto di ${fullName(sostStud)})`;
          }
        }
        daySlots.push({
          id: uid(),
          studentId: r.studentId,
          nome: nomeStud,
          strumento: stru,
          orario: r.orario || (s ? s.orario : ''),
          telefono: s?.telefono || '',
          email: s?.email || '',
          stato: (r.stato === 'ASSENTE' ? 'ASSENTE' : 'RECUPERO'),
          tipo: 'recupero',
          note: noteRec
        });
        addedStudIds.add(r.studentId);
      });

      daySlots.sort((a, b) => String(a.orario || '').localeCompare(String(b.orario || '')));
      if (daySlots.length > 0) {
        days[dStr] = daySlots;
      }
    });

    return { weekStart, days };
  }

  function publicState() {
    ensureDbIntegrity();
    const smtp = { ...db.settings.smtp, pass: '', hasPass: !!db.settings.smtp?.pass };
    return {
      ...db,
      version: '1.0.3',
      changelog: [
        {
          version: '1.0.3',
          date: '2026-10-30',
          title: 'Versione Mobile Android 1.0.3 — Memorizzazione Immediata Impostazioni & Sync Intelligente',
          changes: [
            'Memorizzazione automatica e istantanea delle impostazioni della scuola (incluso l\'indirizzo) ad ogni modifica',
            'Pulsante Salva Impostazioni presente sia in alto che nella scheda Dati della Scuola',
            'Sincronizzazione Google Drive intelligente che preserva sempre le modifiche locali più recenti',
            'Scrittura atomica su memoria interna Android con sincronizzazione immediata'
          ]
        },
        {
          version: '1.0.2',
          date: '2026-10-30',
          title: 'Versione Mobile Android 1.0.2 — Login Google Diretto & Barra Inferiore',
          changes: [
            'Credenziali Google OAuth (ID e Secret) integrate direttamente nel pacchetto APK: richiesto solo l\'account Google',
            'Adattamento completo Edge-to-Edge per Android 15/16 (barra di stato superiore sempre visibile)',
            'Nuova barra di navigazione icone posizionata in basso per un utilizzo ergonomico con una mano',
            'Risolto caricamento database locale e sincronizzazione cloud diretta su Android'
          ]
        }
      ],
      settings: { ...db.settings, smtp }
    };
  }

  const STUDENT_FIELDS = [
    'nome', 'cognome', 'dataNascita', 'strumento', 'giorno', 'orario',
    'email', 'telefono', 'intestatario', 'retta', 'stato', 'note', 'dataIscrizione'
  ];

  function pickStudent(body = {}) {
    const o = {};
    for (const f of STUDENT_FIELDS) {
      if (!(f in body)) continue;
      o[f] = f === 'retta' ? round2(body[f] || 0) : String(body[f] ?? '').trim();
    }
    return o;
  }

  async function handle(path, options = {}) {
    ensureDbIntegrity();
    const method = (options.method || 'GET').toUpperCase();
    const url = new URL(path, 'http://localhost');
    const pathname = url.pathname;
    const query = url.searchParams;
    let body = options.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    body = body || {};

    // STATO E INFO
    if (pathname === '/api/state' && method === 'GET') {
      return publicState();
    }
    if (pathname === '/api/changelog' && method === 'GET') {
      return publicState().changelog;
    }
    if (pathname === '/api/wiki' && method === 'GET') {
      let content = '';
      if (window.Android && typeof window.Android.readAssetFile === 'function') {
        content = window.Android.readAssetFile('WIKI.md') || '';
      }
      return { content };
    }
    if (pathname === '/api/shutdown' && method === 'POST') {
      save();
      if (window.Android && typeof window.Android.closeApp === 'function') {
        setTimeout(() => window.Android.closeApp(), 200);
      }
      return { ok: true };
    }

    // GOOGLE DRIVE STATUS & CONFIG & SYNC
    if (pathname === '/api/google/status' && method === 'GET') {
      return window.gDriveClient ? window.gDriveClient.getStatus() : { connected: false, hasCredentials: true };
    }
    if (pathname === '/api/google/config' && method === 'POST') {
      return window.gDriveClient ? window.gDriveClient.saveConfig(body) : { connected: false, hasCredentials: true };
    }
    if (pathname === '/api/google/disconnect' && method === 'POST') {
      return window.gDriveClient ? window.gDriveClient.disconnect() : { connected: false, hasCredentials: true };
    }
    if (pathname === '/api/google/auth-url' && method === 'GET') {
      if (window.gDriveClient) {
        window.gDriveClient.startAuth();
        return { startedOnAndroid: true };
      }
      throw new Error('Modulo Google Drive non disponibile.');
    }
    if (pathname === '/api/google/sync' && method === 'POST') {
      if (!window.gDriveClient) throw new Error('Modulo Google Drive non disponibile.');
      const direction = body.direction || 'auto';
      if (direction === 'upload') {
        const res = await window.gDriveClient.uploadDb(db);
        return { ok: true, action: 'upload', time: res.modifiedTime, status: window.gDriveClient.getStatus() };
      } else if (direction === 'download') {
        const remote = await window.gDriveClient.downloadDb();
        if (!remote || !remote.data) {
          return { ok: false, error: 'Nessun file db.json trovato nella cartella Google Drive.' };
        }
        db = remote.data;
        ensureDbIntegrity();
        save(true);
        window.gDriveClient.updateSyncRecord(true, 'download');
        return { ok: true, action: 'download', time: remote.modifiedTime, status: window.gDriveClient.getStatus(), state: publicState() };
      } else {
        // auto: confronta timestamp locale (_updatedAt) e remoto (modifiedTime)
        const remote = await window.gDriveClient.downloadDb();
        if (!remote || !remote.data) {
          const res = await window.gDriveClient.uploadDb(db);
          return { ok: true, action: 'upload', time: res.modifiedTime, status: window.gDriveClient.getStatus() };
        }
        const localUpdatedMs = db._updatedAt ? new Date(db._updatedAt).getTime() : 0;
        const remoteUpdatedMs = (remote.data._updatedAt ? new Date(remote.data._updatedAt).getTime() : 0)
          || (remote.modifiedTime ? new Date(remote.modifiedTime).getTime() : 0);
        const lastSyncMs = window.gDriveClient.getStatus()?.lastSync ? new Date(window.gDriveClient.getStatus().lastSync).getTime() : 0;

        // Se i dati locali sono stati modificati più di recente rispetto al cloud (o dopo l'ultimo sync), carica i dati locali su Drive!
        if (localUpdatedMs > 0 && (localUpdatedMs >= remoteUpdatedMs || (lastSyncMs > 0 && localUpdatedMs > lastSyncMs && remoteUpdatedMs <= lastSyncMs + 2000))) {
          const res = await window.gDriveClient.uploadDb(db);
          return { ok: true, action: 'upload', time: res.modifiedTime, status: window.gDriveClient.getStatus() };
        }

        db = remote.data;
        ensureDbIntegrity();
        save(true);
        window.gDriveClient.updateSyncRecord(true, 'download');
        return { ok: true, action: 'download', time: remote.modifiedTime, status: window.gDriveClient.getStatus(), state: publicState() };
      }
    }

    // STUDENTI
    if (pathname === '/api/students' && method === 'POST') {
      const s = { id: uid(), stato: 'Attivo', retta: db.settings.rettaDefault || 60, ...pickStudent(body) };
      if (!s.nome) throw new Error('Il nome è obbligatorio');
      db.students.push(s);
      save();
      return s;
    }
    if (pathname.startsWith('/api/students/') && method === 'PUT') {
      const id = decodeURIComponent(pathname.replace('/api/students/', ''));
      const s = db.students.find(x => x.id === id);
      if (!s) throw new Error('Studente non trovato');
      const upd = pickStudent(body);
      if ('nome' in upd && !upd.nome) throw new Error('Il nome è obbligatorio');
      Object.assign(s, upd);
      save();
      return s;
    }
    if (pathname.startsWith('/api/students/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.replace('/api/students/', ''));
      db.students = db.students.filter(s => s.id !== id);
      db.payments = db.payments.filter(p => p.studentId !== id);
      db.recoveries = (db.recoveries || []).filter(r => r.studentId !== id);
      for (const k of Object.keys(db.attendance)) {
        if (k.startsWith(id + '|')) delete db.attendance[k];
      }
      save();
      return { ok: true };
    }

    // PAGAMENTI & RICEVUTE
    if (pathname === '/api/payments' && method === 'POST') {
      const s = db.students.find(x => x.id === body.studentId);
      if (!s) throw new Error('Studente non trovato');
      const mese = String(body.mese || '');
      if (!/^\d{4}-\d{2}$/.test(mese)) throw new Error('Mese non valido');
      if (db.payments.some(p => p.studentId === s.id && p.mese === mese)) {
        throw new Error('Pagamento già registrato per questo mese');
      }
      const importo = round2(body.importo);
      if (!(importo > 0)) throw new Error('Importo non valido');
      const data = /^\d{4}-\d{2}-\d{2}$/.test(body.data) ? body.data : today();
      const anno = Number(data.slice(0, 4));
      const numero = Math.max(0, ...db.payments.filter(p => p.anno === anno).map(p => p.numero || 0)) + 1;
      const p = {
        id: uid(),
        studentId: s.id,
        mese,
        importo,
        data,
        metodo: String(body.metodo || 'Contanti'),
        note: String(body.note || '').trim(),
        numero,
        anno,
        emailInviata: null,
        creato: new Date().toISOString()
      };
      db.payments.push(p);
      save();
      let emailResult = null;
      if (body.inviaEmail && window.Android && typeof window.Android.sendEmail === 'function') {
        const to = s.email || '';
        const subj = `Ricevuta n. ${p.numero}/${p.anno} - ${fullName(s)}`;
        const text = `Gentile ${s.intestatario || fullName(s)},\nconfermiamo la ricevuta n. ${p.numero}/${p.anno} di € ${importo} per il mese ${mese}.\n\n${db.settings.scuola}`;
        window.Android.sendEmail(to, subj, text);
        p.emailInviata = { data: new Date().toISOString(), to };
        save();
        emailResult = { ok: true };
      }
      return { payment: p, emailResult };
    }

    if (pathname.match(/^\/api\/payments\/[^/]+\/email$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const p = db.payments.find(x => x.id === id);
      if (!p) throw new Error('Pagamento non trovato');
      const s = db.students.find(x => x.id === p.studentId) || {};
      const to = String(body.to || s.email || '').trim();
      if (window.Android && typeof window.Android.sendEmail === 'function') {
        const subj = `Ricevuta n. ${p.numero}/${p.anno} - ${fullName(s)}`;
        const text = `Gentile ${s.intestatario || fullName(s)},\nconfermiamo di aver ricevuto il pagamento di € ${p.importo} per la retta del mese ${p.mese} (Ricevuta n. ${p.numero}/${p.anno}).\n\nGrazie e a presto!\n${db.settings.firmatario || ''}\n${db.settings.scuola || ''}`;
        window.Android.sendEmail(to, subj, text);
      }
      p.emailInviata = { data: new Date().toISOString(), to };
      save();
      return p;
    }

    if (pathname.startsWith('/api/payments/') && method === 'PUT') {
      const id = decodeURIComponent(pathname.replace('/api/payments/', ''));
      const p = db.payments.find(x => x.id === id);
      if (!p) throw new Error('Pagamento non trovato');
      if ('importo' in body) {
        const v = round2(body.importo);
        if (!(v > 0)) throw new Error('Importo non valido');
        p.importo = v;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(body.data || '')) p.data = body.data;
      if ('metodo' in body) p.metodo = String(body.metodo);
      if ('note' in body) p.note = String(body.note).trim();
      save();
      return p;
    }

    if (pathname.startsWith('/api/payments/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.replace('/api/payments/', ''));
      db.payments = db.payments.filter(p => p.id !== id);
      save();
      return { ok: true };
    }

    // PRESENZE & CHIUSURE
    if (pathname === '/api/attendance' && (method === 'PUT' || method === 'POST')) {
      const { studentId, date, value } = body;
      const v = String(value ?? '');
      const k = `${studentId}|${date}`;
      if (v) {
        db.attendance[k] = v;
      } else {
        delete db.attendance[k];
      }
      save();
      return { ok: true };
    }

    if (pathname === '/api/attendance/day' && method === 'POST') {
      const { date, value } = body;
      const v = String(value || '');
      const [y, m, d] = date.split('-').map(Number);
      const wd = new Date(y, m - 1, d).getDay();
      if (!v) {
        for (const k of Object.keys(db.attendance)) {
          if (k.endsWith('|' + date)) delete db.attendance[k];
        }
      } else {
        for (const s of db.students) {
          if (s.stato === 'Attivo' && WD[s.giorno] === wd) {
            db.attendance[`${s.id}|${date}`] = v;
          }
        }
      }
      save();
      return { ok: true };
    }

    if (pathname === '/api/closures' && method === 'PUT') {
      db.closures = (db.closures || []).filter(d => d !== body.date);
      if (body.closed) db.closures.push(body.date);
      save();
      return { ok: true };
    }

    // RECUPERI LEZIONI
    if (pathname === '/api/recoveries' && method === 'POST') {
      const rec = {
        id: uid(),
        studentId: body.studentId,
        date: body.date,
        orario: String(body.orario || '').trim(),
        note: String(body.note || '').trim(),
        sostituisceStudentId: String(body.sostituisceStudentId || '').trim(),
        stato: String(body.stato || 'REC').trim()
      };
      db.recoveries.push(rec);
      const k = `${rec.studentId}|${rec.date}`;
      const s = db.students.find(x => x.id === rec.studentId);
      const [y, m, d] = rec.date.split('-').map(Number);
      const wd = new Date(y, m - 1, d).getDay();
      const isNormalDay = s && WD[s.giorno] === wd;
      if (isNormalDay) {
        if (!db.attendance[k] || db.attendance[k] === 'REC') {
          db.attendance[k] = 'P';
        }
      } else if (!db.attendance[k]) {
        db.attendance[k] = rec.stato || 'REC';
      }
      save();
      return { ok: true, recovery: rec };
    }

    if (pathname.startsWith('/api/recoveries/') && method === 'PUT') {
      const id = decodeURIComponent(pathname.replace('/api/recoveries/', ''));
      const rec = db.recoveries.find(r => r.id === id);
      if (!rec) throw new Error('Recupero non trovato');
      const oldK = `${rec.studentId}|${rec.date}`;
      if (body.studentId) rec.studentId = body.studentId;
      if (body.date) rec.date = body.date;
      if ('orario' in body) rec.orario = String(body.orario || '').trim();
      if ('note' in body) rec.note = String(body.note || '').trim();
      if ('sostituisceStudentId' in body) rec.sostituisceStudentId = String(body.sostituisceStudentId || '').trim();
      if ('stato' in body) rec.stato = String(body.stato || 'REC').trim();
      const newK = `${rec.studentId}|${rec.date}`;
      if (oldK !== newK && db.attendance[oldK] === 'REC') delete db.attendance[oldK];
      const s = db.students.find(x => x.id === rec.studentId);
      const [y, m, d] = rec.date.split('-').map(Number);
      const wd = new Date(y, m - 1, d).getDay();
      const isNormalDay = s && WD[s.giorno] === wd;
      if (isNormalDay) {
        if (!db.attendance[newK] || db.attendance[newK] === 'REC') {
          db.attendance[newK] = 'P';
        }
      } else if (!db.attendance[newK]) {
        db.attendance[newK] = rec.stato || 'REC';
      }
      save();
      return { ok: true, recovery: rec };
    }

    if (pathname.startsWith('/api/recoveries/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.replace('/api/recoveries/', ''));
      const rec = db.recoveries.find(r => r.id === id);
      if (rec) {
        db.recoveries = db.recoveries.filter(r => r.id !== id);
        const k = `${rec.studentId}|${rec.date}`;
        const s = db.students.find(x => x.id === rec.studentId);
        const [y, m, d] = rec.date.split('-').map(Number);
        const wd = new Date(y, m - 1, d).getDay();
        const isNormalDay = s && WD[s.giorno] === wd;
        if (!isNormalDay && db.attendance[k] === 'REC') delete db.attendance[k];
        save();
      }
      return { ok: true };
    }

    // ORARIO SETTIMANALE
    if (pathname === '/api/weekly-schedule' && method === 'GET') {
      const weekStart = query.get('weekStart') || getMondayOfDate(today());
      const saved = db.weeklySchedules[weekStart];
      const schedule = saved || buildDefaultWeekSchedule(weekStart);
      return { weekStart, schedule, isCustom: !!saved };
    }
    if (pathname === '/api/weekly-schedule' && method === 'POST') {
      if (!body.weekStart) throw new Error('Data inizio settimana obbligatoria');
      db.weeklySchedules[body.weekStart] = {
        weekStart: body.weekStart,
        days: body.days || {},
        note: body.note || '',
        aggiornato: new Date().toISOString()
      };
      save();
      return { ok: true, schedule: db.weeklySchedules[body.weekStart] };
    }
    if (pathname === '/api/weekly-schedule' && method === 'DELETE') {
      const weekStart = query.get('weekStart');
      if (weekStart && db.weeklySchedules[weekStart]) {
        delete db.weeklySchedules[weekStart];
        save();
      }
      return { ok: true };
    }

    // LIQUIDAZIONI MAESTRO (TEACHER PAYMENTS)
    if (pathname === '/api/teacher-payments' && method === 'POST') {
      const mese = String(body.mese || '');
      const importo = round2(body.importo ?? body.quotaMaestro ?? body.totRetteIncassate);
      const data = /^\d{4}-\d{2}-\d{2}$/.test(body.data) ? body.data : today();
      const anno = Number(data.slice(0, 4));
      const numero = Math.max(0, ...db.teacherPayments.filter(tp => tp.anno === anno).map(tp => tp.numero || 0)) + 1;
      const paymentIds = Array.isArray(body.paymentIds)
        ? body.paymentIds
        : (Array.isArray(body.studentiCoinvolti) ? body.studentiCoinvolti.map(s => s.paymentId).filter(Boolean) : []);
      const tp = {
        id: uid(),
        numero,
        anno,
        data,
        mese,
        importo,
        totRetteIncassate: round2(body.totRetteIncassate || importo),
        quotaMaestro: importo,
        quotaScuola: 0,
        numRette: Number(body.numRette) || (Array.isArray(body.studentiCoinvolti) ? body.studentiCoinvolti.length : 0),
        studentiCoinvolti: Array.isArray(body.studentiCoinvolti) ? body.studentiCoinvolti : [],
        paymentIds,
        metodo: String(body.metodo || 'Bonifico bancario'),
        note: String(body.note || '').trim(),
        fattura: {
          numero: String(body.fatturaNumero || '').trim(),
          data: String(body.fatturaData || '').trim(),
          importo: round2(body.fatturaImporto || importo),
          stato: String(body.fatturaStato || 'Fattura registrata'),
          note: String(body.fatturaNote || '').trim()
        },
        emailInviata: null,
        creato: new Date().toISOString()
      };
      if (paymentIds.length > 0) {
        db.payments.forEach(p => {
          if (paymentIds.includes(p.id)) {
            p.teacherPaymentId = tp.id;
            p.teacherPaymentNumero = tp.numero;
          }
        });
      }
      db.teacherPayments.push(tp);
      save();
      return { teacherPayment: tp, emailResult: null };
    }

    if (pathname.match(/^\/api\/teacher-payments\/[^/]+\/email$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const tp = db.teacherPayments.find(x => x.id === id);
      if (!tp) throw new Error('Prospetto non trovato');
      const to = String(body.to || '').trim();
      if (window.Android && typeof window.Android.sendEmail === 'function') {
        const subj = `Prospetto liquidazione rette n. ${tp.numero}/${tp.anno} - ${db.settings.scuola}`;
        const text = `Prospetto di liquidazione rette n. ${tp.numero}/${tp.anno} per il mese ${tp.mese}.\nImporto: € ${tp.importo}\n\n${db.settings.scuola}`;
        window.Android.sendEmail(to, subj, text);
      }
      tp.emailInviata = { data: new Date().toISOString(), to };
      save();
      return tp;
    }

    if (pathname.startsWith('/api/teacher-payments/') && method === 'PUT') {
      const id = decodeURIComponent(pathname.replace('/api/teacher-payments/', ''));
      const tp = db.teacherPayments.find(x => x.id === id);
      if (!tp) throw new Error('Nota di pagamento non trovata');
      if ('importo' in body || 'quotaMaestro' in body) {
        const v = round2(body.importo ?? body.quotaMaestro);
        tp.importo = v; tp.quotaMaestro = v; tp.quotaScuola = 0;
      }
      if ('totRetteIncassate' in body) tp.totRetteIncassate = round2(body.totRetteIncassate || 0);
      if (body.mese) tp.mese = body.mese;
      if ('numRette' in body) tp.numRette = Number(body.numRette) || 0;
      if (Array.isArray(body.studentiCoinvolti)) tp.studentiCoinvolti = body.studentiCoinvolti;
      if (body.data) tp.data = body.data;
      if ('metodo' in body) tp.metodo = String(body.metodo);
      if ('note' in body) tp.note = String(body.note).trim();
      if (Array.isArray(body.paymentIds) || Array.isArray(body.studentiCoinvolti)) {
        const newPaymentIds = Array.isArray(body.paymentIds)
          ? body.paymentIds
          : body.studentiCoinvolti.map(s => s.paymentId).filter(Boolean);
        db.payments.forEach(p => {
          if (p.teacherPaymentId === tp.id && !newPaymentIds.includes(p.id)) {
            p.teacherPaymentId = null;
            p.teacherPaymentNumero = null;
          }
          if (newPaymentIds.includes(p.id)) {
            p.teacherPaymentId = tp.id;
            p.teacherPaymentNumero = tp.numero;
          }
        });
        tp.paymentIds = newPaymentIds;
      }
      const f = body.fattura || {};
      tp.fattura = {
        numero: String(body.fatturaNumero ?? f.numero ?? tp.fattura?.numero ?? '').trim(),
        data: String(body.fatturaData ?? f.data ?? tp.fattura?.data ?? '').trim(),
        importo: round2(body.fatturaImporto ?? f.importo ?? tp.importo),
        stato: String(body.fatturaStato ?? f.stato ?? tp.fattura?.stato ?? 'Fattura registrata'),
        note: String(body.fatturaNote ?? f.note ?? tp.fattura?.note ?? '').trim()
      };
      save();
      return { teacherPayment: tp };
    }

    if (pathname.startsWith('/api/teacher-payments/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.replace('/api/teacher-payments/', ''));
      db.payments.forEach(p => {
        if (p.teacherPaymentId === id) {
          p.teacherPaymentId = null;
          p.teacherPaymentNumero = null;
        }
      });
      db.teacherPayments = db.teacherPayments.filter(p => p.id !== id);
      save();
      return { ok: true };
    }

    // SPESE SCUOLA (EXPENSES)
    if (pathname === '/api/expenses' && method === 'POST') {
      const importo = round2(body.importo);
      if (!(importo > 0)) throw new Error('Importo spesa non valido');
      const e = {
        id: uid(),
        data: /^\d{4}-\d{2}-\d{2}$/.test(body.data) ? body.data : today(),
        categoria: String(body.categoria || 'Varie').trim(),
        descrizione: String(body.descrizione || '').trim(),
        importo,
        metodo: String(body.metodo || 'Contanti'),
        note: String(body.note || '').trim(),
        creato: new Date().toISOString()
      };
      db.expenses.push(e);
      save();
      return e;
    }
    if (pathname.startsWith('/api/expenses/') && method === 'PUT') {
      const id = decodeURIComponent(pathname.replace('/api/expenses/', ''));
      const e = db.expenses.find(x => x.id === id);
      if (!e) throw new Error('Spesa non trovata');
      if ('importo' in body) e.importo = round2(body.importo);
      if (body.data) e.data = body.data;
      if ('categoria' in body) e.categoria = String(body.categoria).trim();
      if ('descrizione' in body) e.descrizione = String(body.descrizione).trim();
      if ('metodo' in body) e.metodo = String(body.metodo);
      if ('note' in body) e.note = String(body.note).trim();
      save();
      return e;
    }
    if (pathname.startsWith('/api/expenses/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.replace('/api/expenses/', ''));
      db.expenses = db.expenses.filter(e => e.id !== id);
      save();
      return { ok: true };
    }

    // ENTRATE EXTRA (INCOME EXTRA)
    if (pathname === '/api/income-extra' && method === 'POST') {
      const importo = round2(body.importo);
      if (!(importo > 0)) throw new Error('Importo entrata non valido');
      const ie = {
        id: uid(),
        data: /^\d{4}-\d{2}-\d{2}$/.test(body.data) ? body.data : today(),
        categoria: String(body.categoria || 'Extra').trim(),
        descrizione: String(body.descrizione || '').trim(),
        importo,
        metodo: String(body.metodo || 'Contanti'),
        note: String(body.note || '').trim(),
        creato: new Date().toISOString()
      };
      db.incomeExtra.push(ie);
      save();
      return ie;
    }
    if (pathname.startsWith('/api/income-extra/') && method === 'PUT') {
      const id = decodeURIComponent(pathname.replace('/api/income-extra/', ''));
      const ie = db.incomeExtra.find(x => x.id === id);
      if (!ie) throw new Error('Entrata non trovata');
      if ('importo' in body) ie.importo = round2(body.importo);
      if (body.data) ie.data = body.data;
      if ('categoria' in body) ie.categoria = String(body.categoria).trim();
      if ('descrizione' in body) ie.descrizione = String(body.descrizione).trim();
      if ('metodo' in body) ie.metodo = String(body.metodo);
      if ('note' in body) ie.note = String(body.note).trim();
      save();
      return ie;
    }
    if (pathname.startsWith('/api/income-extra/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.replace('/api/income-extra/', ''));
      db.incomeExtra = db.incomeExtra.filter(i => i.id !== id);
      save();
      return { ok: true };
    }

    // IMPOSTAZIONI & STRUMENTI
    if (pathname === '/api/settings' && method === 'PUT') {
      const st = db.settings;
      for (const k of [
        'scuola', 'indirizzo', 'citta', 'codiceFiscale', 'firmatario',
        'firmatarioRicevute', 'firmatarioProspetti', 'firmatarioSegreteria',
        'firmatarioMaestro', 'notaRicevuta', 'emailTesto',
        'annoScolasticoInizio', 'annoScolasticoFine', 'emailTestoLiquidazione'
      ]) {
        if (k in body) st[k] = String(body[k]);
      }
      if (body.firmatarioSegreteria) {
        const segr = String(body.firmatarioSegreteria).trim();
        st.firmatarioSegreteria = segr;
        st.firmatarioRicevute = segr.toLowerCase().startsWith('segreteria chiesa') ? segr : `Segreteria chiesa: ${segr}`;
        st.firmatario = st.firmatarioRicevute;
      }
      if (body.firmatarioMaestro) {
        st.firmatarioMaestro = String(body.firmatarioMaestro).trim();
        st.firmatarioProspetti = st.firmatarioMaestro;
      }
      if ('rettaDefault' in body) st.rettaDefault = round2(body.rettaDefault || 0);
      if (Array.isArray(body.strumenti)) {
        st.strumenti = [...new Set(body.strumenti.map(x => String(x || '').trim()).filter(Boolean))];
      }
      if (body.smtp) {
        const c = st.smtp, b = body.smtp;
        for (const k of ['host', 'user', 'from']) if (k in b) c[k] = String(b[k]).trim();
        if ('port' in b) c.port = Number(b.port) || 465;
        if ('secure' in b) c.secure = !!b.secure;
        if (b.pass) c.pass = String(b.pass);
      }
      save();
      return publicState().settings;
    }

    if (pathname === '/api/instruments' && method === 'GET') {
      return db.settings.strumenti || ['Canto', 'Basso', 'Piano', 'Chitarra'];
    }
    if (pathname === '/api/instruments' && method === 'POST') {
      const nome = String(body.nome || '').trim();
      if (!nome) throw new Error('Il nome dello strumento è obbligatorio');
      db.settings.strumenti ||= ['Canto', 'Basso', 'Piano', 'Chitarra'];
      if (!db.settings.strumenti.some(x => x.toLowerCase() === nome.toLowerCase())) {
        db.settings.strumenti.push(nome);
        save();
      }
      return db.settings.strumenti;
    }
    if (pathname === '/api/instruments' && method === 'PUT') {
      const vecchioNome = String(body.vecchioNome || '').trim();
      const nuovoNome = String(body.nuovoNome || '').trim();
      if (!nuovoNome) throw new Error('Il nuovo nome dello strumento è obbligatorio');
      db.settings.strumenti ||= ['Canto', 'Basso', 'Piano', 'Chitarra'];
      const idx = db.settings.strumenti.findIndex(x => x.toLowerCase() === vecchioNome.toLowerCase());
      if (idx !== -1) db.settings.strumenti[idx] = nuovoNome;
      else if (!db.settings.strumenti.some(x => x.toLowerCase() === nuovoNome.toLowerCase())) {
        db.settings.strumenti.push(nuovoNome);
      }
      if (body.aggiornaStudenti !== false && vecchioNome && vecchioNome !== nuovoNome) {
        for (const s of db.students) {
          if (s.strumento && s.strumento.toLowerCase() === vecchioNome.toLowerCase()) {
            s.strumento = nuovoNome;
          }
        }
      }
      save();
      return db.settings.strumenti;
    }
    if (pathname.startsWith('/api/instruments/') && method === 'DELETE') {
      const nome = decodeURIComponent(pathname.replace('/api/instruments/', '')).trim().toLowerCase();
      db.settings.strumenti = (db.settings.strumenti || []).filter(x => x.toLowerCase() !== nome);
      save();
      return db.settings.strumenti;
    }

    if (pathname === '/api/test-email' && method === 'POST') {
      if (window.Android && typeof window.Android.sendEmail === 'function') {
        window.Android.sendEmail(body.to || '', `Email di prova - ${db.settings.scuola}`, 'Prova invio email da Tralci di Note Android.');
      }
      return { ok: true };
    }

    return { ok: true };
  }

  window.LocalDbEngine = {
    init,
    save,
    handle,
    getDb: () => db,
    buildDefaultWeekSchedule
  };

  window.onAndroidGoogleAuthCode = async function (code, redirectUri) {
    try {
      if (!window.gDriveClient) return;
      await window.gDriveClient.handleAuthCallback(code, redirectUri);
      try {
        await handle('/api/google/sync', { method: 'POST', body: { direction: 'auto' } });
      } catch (syncErr) {
        console.warn('Sync iniziale post-login Google:', syncErr);
      }
      window.postMessage({ type: 'google-auth-success' }, '*');
    } catch (err) {
      console.error('Errore callback OAuth Android:', err);
      window.postMessage({ type: 'google-auth-error', error: err.message || String(err) }, '*');
    }
  };
})();
