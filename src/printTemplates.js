// printTemplates.js - Template HTML ufficiali per stampa nativa Android (PrintManager)
'use strict';

(function () {
  const MESI = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];
  const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  const WD = { 'Domenica': 0, 'Lunedì': 1, 'Martedì': 2, 'Mercoledì': 3, 'Giovedì': 4, 'Venerdì': 5, 'Sabato': 6 };
  const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const WD_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const euro = n => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const meseLabel = ym => {
    if (!ym || !ym.includes('-')) return ym || '';
    const [y, m] = ym.split('-').map(Number);
    return `${MESI[m - 1]} ${y}`;
  };
  const dataIt = d => (d || '').split('-').reverse().join('/');
  const fullName = s => `${s?.nome || ''} ${s?.cognome || ''}`.trim();

  const UNITA = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci',
    'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
  const DECINE = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

  function sotto100(n) {
    if (n < 20) return UNITA[n];
    let t = DECINE[Math.floor(n / 10)];
    const r = n % 10;
    if (r === 1 || r === 8) t = t.slice(0, -1);
    if (r === 3) return t + 'tré';
    return t + UNITA[r];
  }
  function sotto1000(n) {
    const c = Math.floor(n / 100), r = n % 100;
    let s = c === 0 ? '' : (c === 1 ? 'cento' : UNITA[c] + 'cento');
    if (c > 0 && Math.floor(r / 10) === 8) s = s.slice(0, -1);
    return s + sotto100(r);
  }
  function intero(n) {
    if (n === 0) return 'zero';
    const mil = Math.floor(n / 1e6), mig = Math.floor((n % 1e6) / 1000), r = n % 1000;
    let s = '';
    if (mil) s += mil === 1 ? 'unmilione' : intero(mil) + 'milioni';
    if (mig) s += mig === 1 ? 'mille' : sotto1000(mig) + 'mila';
    return s + sotto1000(r);
  }
  function inLettere(importo) {
    const cent = Math.round(Number(importo || 0) * 100);
    const s = intero(Math.floor(cent / 100));
    return s.charAt(0).toUpperCase() + s.slice(1) + '/' + String(cent % 100).padStart(2, '0');
  }

  function renderReceiptHtml(p, s, st = {}) {
    const allievo = fullName(s);
    const intest = s?.intestatario || allievo;
    return `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<title>Ricevuta ${p.numero}/${p.anno} - ${esc(allievo)}</title>
<style>
  body{margin:0;padding:24px;font-family:Arial,Helvetica,'Segoe UI',sans-serif;color:#0f172a;background:#fff;}
  @page{size:A4;margin:15mm}
</style>
</head>
<body>
<div style="max-width:660px;margin:0 auto;border:2px solid #1e3a8a;border-radius:8px;padding:30px 36px;background:#ffffff">
  <div style="text-align:center;border-bottom:2px solid #1e3a8a;padding-bottom:14px;margin-bottom:18px">
    <div style="font-size:21px;font-weight:bold;letter-spacing:0.5px;color:#0f172a">${esc(st.scuola)}</div>
    ${st.indirizzo ? `<div style="font-size:13px;color:#475569;margin-top:4px">${esc(st.indirizzo)}</div>` : ''}
    ${st.codiceFiscale ? `<div style="font-size:13px;color:#475569">C.F. / P.IVA ${esc(st.codiceFiscale)}</div>` : ''}
  </div>

  <table width="100%" style="border-collapse:collapse;margin-bottom:14px;font-size:14.5px">
    <tr>
      <td style="font-size:18px;font-weight:bold;color:#1e3a8a">RICEVUTA N. ${p.numero}/${p.anno}</td>
      <td style="text-align:right;color:#334155">${esc(st.citta)}${st.citta ? ', ' : ''}${dataIt(p.data)}</td>
    </tr>
  </table>

  <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px 18px;margin:16px 0 20px">
    <table width="100%" style="border-collapse:collapse">
      <tr>
        <td>
          <div style="font-size:11.5px;color:#1e40af;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px">IMPORTO CORRISPOSTO:</div>
          <div style="font-size:13px;color:#475569;margin-top:3px">(in lettere: <i>${esc(inLettere(p.importo))}</i>)</div>
        </td>
        <td style="text-align:right;font-size:24px;font-weight:bold;color:#1e3a8a">&euro; ${euro(p.importo)}</td>
      </tr>
    </table>
  </div>

  <table width="100%" style="border-collapse:collapse;font-size:14.5px;line-height:1.7;margin-bottom:18px">
    <tr>
      <td style="width:130px;color:#64748b;vertical-align:top;padding:4px 0"><b>Ricevuto da:</b></td>
      <td style="padding:4px 0;color:#0f172a"><b>${esc(intest)}</b></td>
    </tr>
    ${intest !== allievo ? `
    <tr>
      <td style="color:#64748b;vertical-align:top;padding:4px 0"><b>Per l'allievo/a:</b></td>
      <td style="padding:4px 0;color:#0f172a"><b>${esc(allievo)}</b></td>
    </tr>` : ''}
    <tr>
      <td style="color:#64748b;vertical-align:top;padding:4px 0"><b>Causale:</b></td>
      <td style="padding:4px 0;color:#0f172a">Retta mensile${s?.strumento ? ` corso di <b>${esc(s.strumento)}</b>` : ''} &ndash; <b>${meseLabel(p.mese)}</b></td>
    </tr>
    <tr>
      <td style="color:#64748b;vertical-align:top;padding:4px 0"><b>Pagamento:</b></td>
      <td style="padding:4px 0;color:#0f172a">${esc(p.metodo)}</td>
    </tr>
  </table>

  ${p.note ? `<p style="font-size:13px;color:#475569;margin:8px 0;background:#f8fafc;padding:8px 12px;border-radius:4px"><b>Note:</b> ${esc(p.note)}</p>` : ''}
  ${st.notaRicevuta ? `<p style="font-size:12px;color:#64748b;margin:10px 0 0;line-height:1.4">${esc(st.notaRicevuta)}</p>` : ''}

  <table width="100%" style="margin-top:36px;border-collapse:collapse;font-size:13.5px">
    <tr>
      <td></td>
      <td style="width:45%;text-align:center">
        Firma<br><br><br>
        <div style="border-top:1px solid #0f172a;padding-top:4px">${esc(st.firmatarioRicevute || st.firmatario || '')}</div>
      </td>
    </tr>
  </table>
</div>
</body></html>`;
  }

  function renderSettlementCard(p, st = {}, copyType = 'maestro', copyLabel = 'Copia per il Maestro') {
    const fatt = p.fattura || {};
    const hasFattura = !!(fatt.numero && String(fatt.numero).trim() && fatt.numero !== '—' && fatt.stato !== 'In attesa di fattura');
    const importoTot = p.importo || p.quotaMaestro || p.totRetteIncassate || 0;
    const rows = (p.studentiCoinvolti || []).map((s, i) => `
      <tr>
        <td style="border:1px solid #e2e8f0;padding:4px 8px;text-align:center;color:#64748b">${i + 1}</td>
        <td style="border:1px solid #e2e8f0;padding:4px 8px;font-weight:600;color:#0f172a">${esc(s.nome)}</td>
        <td style="border:1px solid #e2e8f0;padding:4px 8px;color:#334155">${esc(s.strumento || '—')}</td>
        <td style="border:1px solid #e2e8f0;padding:4px 8px;text-align:center;color:#475569">${s.ricevuta ? 'Ric. ' + esc(s.ricevuta) : '—'}</td>
        <td style="border:1px solid #e2e8f0;padding:4px 8px;text-align:right;font-weight:600">&euro; ${euro(s.importo)}</td>
      </tr>`).join('');
    const fatturaDisplay = hasFattura
      ? `N. <b>${esc(fatt.numero)}</b> del ${dataIt(fatt.data)}`
      : `<span style="color:#b45309;font-weight:600">In attesa</span>`;
    const firmSegreteria = st.firmatarioRicevute || st.firmatario || 'Segreteria chiesa: Bruno Astemio';
    const firmMaestro = st.firmatarioMaestro || st.firmatarioProspetti || 'Maestro Dario Artuso';

    const signaturesHtml = copyType === 'maestro'
      ? `<table width="100%" style="border-collapse:collapse;margin-top:16px;font-size:10.5px">
          <tr><td style="width:50%"></td><td style="width:50%;text-align:center">
            <div style="color:#64748b;margin-bottom:20px">Firma della Segreteria</div>
            <div style="border-top:1px solid #334155;padding-top:3px;font-weight:600;color:#0f172a">${esc(firmSegreteria)}</div>
          </td></tr></table>`
      : `<table width="100%" style="border-collapse:collapse;margin-top:16px;font-size:10.5px">
          <tr>
            <td style="width:48%;text-align:center"><div style="color:#64748b;margin-bottom:20px">Firma per la Scuola</div><div style="border-top:1px solid #334155;padding-top:3px;font-weight:600;color:#0f172a">${esc(firmSegreteria)}</div></td>
            <td style="width:4%"></td>
            <td style="width:48%;text-align:center"><div style="color:#64748b;margin-bottom:20px">Firma del Maestro per ricevuta</div><div style="border-top:1px solid #334155;padding-top:3px;font-weight:600;color:#0f172a">${esc(firmMaestro)}</div></td>
          </tr></table>`;

    return `
<div style="border:1px solid #94a3b8;border-radius:8px;padding:16px 20px;background:#ffffff;color:#0f172a;font-family:Arial,Helvetica,sans-serif;margin-bottom:18px;page-break-inside:avoid">
  <table width="100%" style="border-collapse:collapse;margin-bottom:8px">
    <tr>
      <td style="vertical-align:top">
        <div style="font-size:13.5px;font-weight:bold;color:#0f172a;text-transform:uppercase">${esc(st.scuola)}</div>
        ${(st.indirizzo || st.citta) ? `<div style="font-size:10.5px;color:#64748b;margin-top:2px">${[st.indirizzo, st.citta].filter(Boolean).map(esc).join(' - ')}</div>` : ''}
      </td>
      <td style="text-align:right;vertical-align:top">
        <span style="display:inline-block;padding:2.5px 8px;font-size:9.5px;font-weight:700;text-transform:uppercase;border-radius:4px;border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af">${esc(copyLabel)}</span>
        <div style="font-size:12.5px;font-weight:bold;color:#1e3a8a;margin-top:3px">PROSPETTO LIQUIDAZIONE N. ${p.numero}/${p.anno}</div>
        <div style="font-size:10px;color:#64748b">${dataIt(p.data)}</div>
      </td>
    </tr>
  </table>
  <table width="100%" style="border-collapse:collapse;margin:6px 0 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px">
    <tr><td style="padding:6px 10px;color:#334155;line-height:1.5">
      <b>Periodo:</b> ${meseLabel(p.mese)} &nbsp;|&nbsp; <b>Modalità di pagamento:</b> ${esc(p.metodo || 'Contanti')} &nbsp;|&nbsp; <b>Fattura:</b> ${fatturaDisplay}
      ${p.note ? `<div style="margin-top:3px;color:#475569"><b>Note:</b> ${esc(p.note)}</div>` : ''}
    </td></tr>
  </table>
  ${rows ? `
  <table width="100%" style="border-collapse:collapse;font-size:11px;margin:6px 0">
    <thead>
      <tr style="background:#f1f5f9;color:#334155;font-size:9.5px;text-transform:uppercase">
        <th style="border:1px solid #e2e8f0;padding:4px 8px;width:26px">#</th>
        <th style="border:1px solid #e2e8f0;padding:4px 8px;text-align:left">Allievo</th>
        <th style="border:1px solid #e2e8f0;padding:4px 8px;text-align:left">Strumento</th>
        <th style="border:1px solid #e2e8f0;padding:4px 8px;text-align:center">Ricevuta</th>
        <th style="border:1px solid #e2e8f0;padding:4px 8px;text-align:right">Importo</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>` : ''}
  <table width="100%" style="border-collapse:collapse;margin:6px 0 8px;background:#eff6ff;border:1px solid #93c5fd;border-radius:6px">
    <tr>
      <td style="padding:6px 12px;font-size:11px;color:#1e40af"><b>TOTALE LIQUIDATO:</b> &nbsp; <span style="font-size:10.5px;color:#475569">(in lettere: <i>${esc(inLettere(importoTot))}</i>)</span></td>
      <td style="padding:6px 12px;text-align:right;font-size:14.5px;font-weight:bold;color:#1e3a8a">&euro; ${euro(importoTot)}</td>
    </tr>
  </table>
  ${signaturesHtml}
</div>`;
  }

  function renderSettlementReceiptHtml(p, st = {}) {
    return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Prospetto liquidazione ${p.numero}/${p.anno}</title>
<style>body{margin:0;padding:16px;font-family:Arial,sans-serif;background:#fff}@page{size:A4 portrait;margin:12mm}</style>
</head><body>
${renderSettlementCard(p, st, 'maestro', 'Copia per il Maestro')}
<div style="page-break-before:always"></div>
${renderSettlementCard(p, st, 'scuola', 'Copia per la Segreteria')}
</body></html>`;
  }

  function renderCashbookHtml(db, { da, a, tipoFiltro = '' } = {}) {
    const st = db.settings || {};
    const start = da || st.annoScolasticoInizio || '2026-10-01';
    const end = a || st.annoScolasticoFine || '2027-06-30';
    const studentsMap = Object.fromEntries((db.students || []).map(s => [s.id, s]));
    const entries = [];
    (db.payments || []).forEach(p => {
      const s = studentsMap[p.studentId];
      const sName = s ? fullName(s) : 'Allievo';
      entries.push({ data: p.data, tipo: 'ENTRATA', categoria: 'Retta allievo', descrizione: `Retta ${meseLabel(p.mese)} - ${sName} (Ric. n. ${p.numero}/${p.anno})`, metodo: p.metodo || 'Contanti', entrata: p.importo, uscita: 0 });
    });
    (db.incomeExtra || []).forEach(e => {
      entries.push({ data: e.data, tipo: 'ENTRATA', categoria: e.categoria || 'Entrata extra', descrizione: e.descrizione || 'Entrata', metodo: e.metodo || 'Contanti', entrata: e.importo, uscita: 0 });
    });
    (db.teacherPayments || []).forEach(tp => {
      const imp = tp.importo || tp.quotaMaestro || 0;
      entries.push({ data: tp.data, tipo: 'USCITA', categoria: 'Liquidazione rette', descrizione: `Liquidazione rette ${meseLabel(tp.mese)}`, metodo: tp.metodo || 'Bonifico bancario', entrata: 0, uscita: imp });
    });
    (db.expenses || []).forEach(ex => {
      entries.push({ data: ex.data, tipo: 'USCITA', categoria: ex.categoria || 'Spese scuola', descrizione: ex.descrizione || 'Spesa', metodo: ex.metodo || 'Contanti', entrata: 0, uscita: ex.importo });
    });
    let filtered = entries.filter(e => (!start || e.data >= start) && (!end || e.data <= end));
    if (tipoFiltro === 'E' || tipoFiltro === 'ENTRATA') filtered = filtered.filter(e => e.tipo === 'ENTRATA');
    if (tipoFiltro === 'U' || tipoFiltro === 'USCITA') filtered = filtered.filter(e => e.tipo === 'USCITA');
    filtered.sort((x, y) => (x.data || '').localeCompare(y.data || ''));

    let totE = 0, totU = 0, saldoProg = 0;
    const rows = filtered.map((e, idx) => {
      totE += e.entrata;
      totU += e.uscita;
      saldoProg += (e.entrata - e.uscita);
      return `<tr>
        <td style="text-align:center">${idx + 1}</td>
        <td style="text-align:center">${dataIt(e.data)}</td>
        <td style="text-align:center;font-weight:bold;color:${e.tipo === 'ENTRATA' ? '#059669' : '#dc2626'}">${e.tipo}</td>
        <td><b>${esc(e.categoria)}</b></td>
        <td>${esc(e.descrizione)}</td>
        <td>${esc(e.metodo)}</td>
        <td style="text-align:right;color:#059669">${e.entrata ? euro(e.entrata) : '—'}</td>
        <td style="text-align:right;color:#dc2626">${e.uscita ? euro(e.uscita) : '—'}</td>
        <td style="text-align:right;font-weight:bold">${euro(saldoProg)}</td>
      </tr>`;
    }).join('');

    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Prima Nota - ${esc(st.scuola)}</title>
<style>body{font-family:Arial,sans-serif;padding:16px;color:#0f172a}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px}th{background:#f1f5f9}@page{size:A4 portrait;margin:12mm}</style></head>
<body>
<h2 style="margin:0 0 4px">${esc(st.scuola)} — Registro di Prima Nota</h2>
<p style="margin:0 0 14px;font-size:13px;color:#475569">Periodo: <b>${dataIt(start)} – ${dataIt(end)}</b> · Entrate: <b style="color:#059669">&euro; ${euro(totE)}</b> · Uscite: <b style="color:#dc2626">&euro; ${euro(totU)}</b> · Saldo: <b style="color:#2563eb">&euro; ${euro(totE - totU)}</b></p>
<table><thead><tr><th>#</th><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrizione</th><th>Metodo</th><th>Entrata</th><th>Uscita</th><th>Saldo</th></tr></thead>
<tbody>${rows || '<tr><td colspan="9" style="text-align:center;padding:18px">Nessun movimento</td></tr>'}</tbody></table>
</body></html>`;
  }

  function renderAttendanceSheetHtml(db, mese) {
    const [y, m] = (mese || ymd(new Date()).slice(0, 7)).split('-').map(Number);
    const gi = s => { const i = GIORNI.indexOf(s.giorno); return i < 0 ? 99 : i; };
    const studs = (db.students || []).filter(s => s.stato === 'Attivo').sort((a, b) => (gi(a) - gi(b))
      || String(a.orario || '').localeCompare(String(b.orario || '')) || fullName(a).localeCompare(fullName(b)));
    const recs = db.recoveries || [];
    const recDates = new Set(recs.map(r => r.date));
    const wds = new Set(studs.map(s => WD[s.giorno]).filter(x => x !== undefined));
    const attDates = new Set();
    for (const [k, v] of Object.entries(db.attendance || {})) {
      if (!v) continue;
      const dt = k.split('|')[1];
      if (dt && dt.startsWith(`${mese}-`)) attDates.add(dt);
    }
    const cols = [];
    for (let d = 1, n = new Date(y, m, 0).getDate(); d <= n; d++) {
      const wd = new Date(y, m - 1, d).getDay();
      const dStr = `${y}-${pad(m)}-${pad(d)}`;
      if (!wds.size || wds.has(wd) || recDates.has(dStr) || attDates.has(dStr)) cols.push({ date: dStr, d, wd });
    }
    const closed = new Set(db.closures || []);
    const rows = studs.map((s, i) => {
      let P = 0, A = 0;
      const cells = cols.map(c => {
        const isLessonDay = WD[s.giorno] === c.wd;
        const rawV = (db.attendance || {})[`${s.id}|${c.date}`] || '';
        const rec = recs.find(r => r.studentId === s.id && r.date === c.date && r.stato !== 'ANNULLATO');
        const v = (isLessonDay && rec && (!rawV || rawV === 'REC')) ? 'P' : rawV;
        if (!isLessonDay && !v && !rec) return '<td style="background:#f8fafc"></td>';
        if (!v && !rec && closed.has(c.date)) return '<td style="background:#e2e8f0">–</td>';
        if (v === 'P' || rec || (!isLessonDay && v === 'REC')) P++;
        if (v === 'A') A++;
        return `<td><b>${esc(v || (rec ? 'REC' : ''))}</b></td>`;
      }).join('');
      return `<tr><td>${i + 1}</td><td style="text-align:left"><b>${esc(fullName(s))}</b><br><small style="color:#64748b">${esc(s.strumento)} · ${esc(s.giorno)} ${esc(s.orario)}</small></td>${cells}<td><b>${P}</b></td><td><b>${A}</b></td></tr>`;
    }).join('');

    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Foglio presenze ${meseLabel(mese)}</title>
<style>body{font-family:Arial,sans-serif;padding:12px;color:#0f172a}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #94a3b8;padding:4px;text-align:center}th{background:#f1f5f9}@page{size:A4 landscape;margin:10mm}</style></head>
<body>
<h2 style="margin:0 0 10px">${esc(db.settings?.scuola || 'Tralci di Note')} — Foglio Presenze ${meseLabel(mese)}</h2>
<table><thead><tr><th>#</th><th style="text-align:left">Allievo</th>${cols.map(c => `<th>${WD_SHORT[c.wd]}<br><b>${c.d}</b></th>`).join('')}<th>Pres.</th><th>Ass.</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
  }

  function renderWeeklySheetHtml(db, weekStart, schedule) {
    const st = db.settings || {};
    const daysObj = schedule?.days || {};
    const daysKeys = Object.keys(daysObj).sort().filter(d => (daysObj[d] || []).length > 0);
    const sections = daysKeys.map(dStr => {
      const [y, m, d] = dStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const label = `${WD_NAMES[dt.getDay()]} ${d} ${MESI[m - 1]} ${y}`.toUpperCase();
      const slots = daysObj[dStr] || [];
      return `<div style="margin-bottom:18px;page-break-inside:avoid">
        <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-bottom:0;padding:6px 12px;font-weight:bold;font-size:13px">📅 ${esc(label)} (${slots.length} lezioni)</div>
        <table width="100%" style="border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#f8fafc"><th style="border:1px solid #cbd5e1;padding:6px;width:30px">#</th><th style="border:1px solid #cbd5e1;padding:6px;width:120px;text-align:left">Orario</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:left">Allievo</th><th style="border:1px solid #cbd5e1;padding:6px;width:110px;text-align:left">Strumento</th><th style="border:1px solid #cbd5e1;padding:6px;width:100px;text-align:left">Stato</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:left">Note</th></tr></thead>
          <tbody>${slots.map((s, idx) => `<tr><td style="border:1px solid #cbd5e1;padding:6px;text-align:center">${idx + 1}</td><td style="border:1px solid #cbd5e1;padding:6px"><b>${esc(s.orario || '—')}</b></td><td style="border:1px solid #cbd5e1;padding:6px"><b>${esc(s.nome)}</b></td><td style="border:1px solid #cbd5e1;padding:6px">${esc(s.strumento || '—')}</td><td style="border:1px solid #cbd5e1;padding:6px"><b>${esc(s.stato || 'CONFERMATO')}</b></td><td style="border:1px solid #cbd5e1;padding:6px">${esc(s.note || '—')}</td></tr>`).join('')}</tbody>
        </table>
      </div>`;
    }).join('');
    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Orario Settimanale ${esc(weekStart)}</title>
<style>body{font-family:Arial,sans-serif;padding:16px;color:#0f172a}@page{size:A4 portrait;margin:10mm}</style></head>
<body>
<h2 style="margin:0 0 12px">${esc(st.scuola || 'Tralci di Note')} — Prospetto Lezioni Settimanale (${dataIt(weekStart)})</h2>
${sections || '<p>Nessuna lezione in programma per questa settimana.</p>'}
</body></html>`;
  }

  window.PrintTemplates = {
    renderReceiptHtml,
    renderSettlementReceiptHtml,
    renderCashbookHtml,
    renderAttendanceSheetHtml,
    renderWeeklySheetHtml,
    fullName,
    meseLabel,
    euro,
    inLettere
  };
})();
