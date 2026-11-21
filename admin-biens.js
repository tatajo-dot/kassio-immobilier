// KASSIO IMMOBILIER — Espace KASSIO : biens immobiliers, suivi des demandes et visites, sources (scraping, WhatsApp)
import { sb, state, esc, toast, errMsg, dateFr, fcfa, quand } from './app.js';
import { TYPES, TRANSACTIONS, STATUTS_DEMANDE, prixBien } from './biens.js?v=1';

const ETAPES = [['nouveau', 'Nouveau'], ['contacte', 'Contacté'], ['visite_planifiee', 'Visite planifiée'], ['visite_realisee', 'Visite réalisée'], ['relance', 'Relance'], ['gagne', 'Gagné'], ['perdu', 'Perdu']];
const LIB = Object.fromEntries(ETAPES);
const MOTIFS = { prix: 'Prix', indisponible: 'Bien indisponible', proprietaire_injoignable: 'Propriétaire injoignable', prospect_absent: 'Prospect absent', documents: 'Documents incomplets', doublon: 'Doublon', autre: 'Autre' };
const RESULTATS = { realisee: 'Réalisée', annulee: 'Annulée', absent: 'Absent', non_conclue: 'Non conclue' };
const lieuB = (b) => [b.quartier && !String(b.quartier).toLowerCase().includes(String(b.commune || '').toLowerCase()) ? b.quartier : null, b.commune].filter(Boolean).join(', ');
const SRC = { pro: 'Pro', kassio: 'KASSIO', whatsapp: 'WhatsApp', web: 'Web' };
const intl = (t) => { let d = String(t || '').replace(/[^0-9]/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.length === 10 && d.startsWith('0')) d = '225' + d; return d; };
const wa = (t, msg) => t ? `<a class="btn sm soft" target="_blank" rel="noopener" href="https://wa.me/${intl(t)}${msg ? '?text=' + encodeURIComponent(msg) : ''}">WhatsApp</a>` : '';
const versLocal = (d) => d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '';
const enRetard = (d) => d.prochaine_action_le && new Date(d.prochaine_action_le) < Date.now() && !['gagne', 'perdu'].includes(d.statut);

// ---------- À traiter maintenant ----------
export async function traiter(box) {
  const { data: n, error } = await sb.rpc('admin_a_traiter');
  if (error) throw error;
  const { data: s } = await sb.rpc('admin_sources');
  const items = [
    ['Demandes nouvelles', n.nouvelles, '#/admin/demandes?f=nouveau', 'À appeler : premier contact'],
    ['Relances en retard', n.relances_retard, '#/admin/demandes?f=retard', 'La date de prochaine action est passée'],
    ['Visites sans compte rendu', n.visites_sans_cr, '#/admin/demandes?f=sans_cr', 'Visite passée, résultat à saisir'],
    ['Demandes non assignées', n.non_assignees, '#/admin/demandes?f=non_assignees', 'Personne n’en est responsable'],
    ['Offres à valider', n.biens_a_valider, '#/admin/validation', 'Publiées par des pros, en attente'],
    ['Comptes pros à vérifier', n.pros_a_valider, '#/admin/validation?o=pros', 'Agents, promoteurs, entreprises'],
    ['Doublons possibles', n.doublons, '#/admin/demandes?f=doublons', 'Même téléphone sur plusieurs demandes'],
    ['Identités à vérifier', n.kyc_a_verifier, '#/admin/identites', 'Pièces d’identité envoyées'],
    ['Erreurs de l’appli (24 h)', n.erreurs_24h, '#/admin/erreurs', 'Problèmes rencontrés par les membres']];
  const total = items.reduce((t, i) => t + (i[1] || 0), 0);
  box.innerHTML = `
  <section class="card at-box"><h2>À traiter maintenant</h2><p class="muted small">${total ? total + ' élément' + (total > 1 ? 's' : '') + ' bloquent le suivi commercial ou la qualité des offres.' : 'Rien en attente : tout est à jour.'}</p>
  <div class="at-grid">${items.map(([l, v, h, d]) => `<a class="at-i${v ? ' chaud' : ''}" href="${h}"><span class="at-n">${v || 0}</span><b>${esc(l)}</b><small>${esc(d)}</small></a>`).join('')}</div></section>
  <section class="card" style="margin-top:16px"><h2>Offres en ligne</h2>
  <div class="at-grid">
    <a class="at-i" href="#/admin/catalogue?src=pro"><span class="at-n">${s?.pro_publies ?? 0}</span><b>Pros et KASSIO</b><small>Vérifiées par KASSIO</small></a>
    <a class="at-i" href="#/admin/catalogue?src=whatsapp"><span class="at-n">${s?.wa_publies ?? 0}</span><b>Offres flash WhatsApp</b><small>${s?.wa_dernier ? 'Dernier message ' + esc(quand(s.wa_dernier).toLowerCase()) : 'Passerelle non branchée'}</small></a>
    <a class="at-i" href="#/admin/catalogue?src=web"><span class="at-n">${s?.web_publies ?? 0}</span><b>Annonces web</b><small>${s?.dernier_scraping ? 'Dernier passage ' + esc(quand(s.dernier_scraping.debut).toLowerCase()) : 'Aucun passage'}</small></a>
  </div><p style="margin-top:12px"><a href="#/admin/sources">Détail des sources ›</a></p></section>`;
}

// ---------- Suivi des demandes et visites ----------
export async function demandes(box) {
  const p = new URLSearchParams((location.hash.split('?')[1]) || ''), f = p.get('f') || 'ouvertes', sel = p.get('id');
  const [{ data: D, error }, { data: admins }] = await Promise.all([
    sb.from('demandes_biens').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('profiles').select('id,nom_affichage').eq('is_admin', true).eq('statut', 'actif')]);
  if (error) throw error;
  const nomAdm = new Map((admins || []).map(a => [a.id, a.nom_affichage || 'Admin']));
  const tels = new Map(); D.forEach(d => { if (d.telephone_norm && !['gagne', 'perdu'].includes(d.statut)) tels.set(d.telephone_norm, (tels.get(d.telephone_norm) || 0) + 1); });
  const FILTRES = {
    ouvertes: ['En cours', d => !['gagne', 'perdu'].includes(d.statut)],
    nouveau: ['Nouvelles', d => d.statut === 'nouveau'],
    retard: ['Relances en retard', enRetard],
    sans_cr: ['Visites sans compte rendu', d => d.statut === 'visite_planifiee' && d.visite_le && new Date(d.visite_le) < Date.now() && !d.visite_resultat],
    non_assignees: ['Non assignées', d => !d.assigne_a && !['gagne', 'perdu'].includes(d.statut)],
    miennes: ['Les miennes', d => d.assigne_a === state.session.user.id && !['gagne', 'perdu'].includes(d.statut)],
    doublons: ['Doublons', d => d.telephone_norm && tels.get(d.telephone_norm) > 1],
    gagne: ['Gagnées', d => d.statut === 'gagne'], perdu: ['Perdues', d => d.statut === 'perdu'], toutes: ['Toutes', () => true] };
  const liste = D.filter((FILTRES[f] || FILTRES.ouvertes)[1]);
  const compte = (k) => D.filter(FILTRES[k][1]).length;
  const parEtape = ETAPES.map(([k, l]) => [k, l, D.filter(d => d.statut === k).length]);
  const lien = (o) => '#/admin/demandes?' + new URLSearchParams({ f, ...o }).toString();
  box.innerHTML = `
  <div class="pipe">${parEtape.map(([k, l, n]) => `<a class="${f === k ? 'on' : ''}" href="#/admin/demandes?f=${k === 'nouveau' ? 'nouveau' : k === 'gagne' || k === 'perdu' ? k : 'ouvertes'}"><em>${n}</em><span>${l}</span></a>`).join('')}</div>
  <div class="chips">${Object.entries(FILTRES).map(([k, [l]]) => `<a class="chip ${f === k ? 'on' : ''}" href="#/admin/demandes?f=${k}">${l} <em>${compte(k)}</em></a>`).join('')}</div>
  <div class="dm-lay${sel ? ' ouvert' : ''}">
    <div class="list dm-list">${liste.length ? liste.map(d => `<a class="card dm-r${d.id === sel ? ' on' : ''}${enRetard(d) ? ' retard' : ''}" href="${lien({ id: d.id })}">
      <div class="dm-1"><b>${esc(d.nom || 'Membre')}</b><span class="badge ${d.statut === 'gagne' ? 'ok' : d.statut === 'perdu' ? 'soft' : d.statut === 'nouveau' ? '' : 'warn'}">${esc(LIB[d.statut])}</span></div>
      <div class="muted small">${esc(d.reference)} · ${esc(d.bien_ref || '')} ${esc(d.bien_titre || '')}</div>
      <div class="small">${d.type === 'visite' ? 'Visite' : 'Infos'}${d.date_souhaitee ? ' souhaitée le ' + esc(dateFr(d.date_souhaitee, true)) : ''} · ${esc(quand(d.created_at))}</div>
      ${d.prochaine_action ? `<div class="small${enRetard(d) ? ' err-t' : ''}">→ ${esc(d.prochaine_action)}${d.prochaine_action_le ? ' · ' + esc(dateFr(d.prochaine_action_le, true)) : ''}</div>` : ''}
      ${d.assigne_a ? `<div class="muted small">Suivi : ${esc(nomAdm.get(d.assigne_a) || '—')}</div>` : '<div class="small err-t">Non assignée</div>'}</a>`).join('')
      : '<div class="card center pad muted">Aucune demande dans cette vue.</div>'}</div>
    <div class="dm-fiche" id="fiche">${sel ? '<div class="card pad muted">Chargement…</div>' : '<div class="card pad muted dm-vide">Choisissez une demande pour la traiter.</div>'}</div>
  </div>`;
  if (sel) await ficheDemande(box.querySelector('#fiche'), D.find(d => d.id === sel), admins || [], tels, () => { location.hash = lien({}); }, () => demandes(box));
}

async function ficheDemande(z, d, admins, tels, fermer, recharger) {
  if (!d) { z.innerHTML = '<div class="card pad">Demande introuvable.</div>'; return; }
  const [{ data: H }, { data: b }] = await Promise.all([
    sb.from('demandes_historique').select('*, profiles(nom_affichage)').eq('demande_id', d.id).order('created_at', { ascending: false }),
    d.bien_id ? sb.from('biens').select('id,reference,titre,prix_fcfa,periodicite,commune,quartier,source,source_nom,statut').eq('id', d.bien_id).maybeSingle() : Promise.resolve({ data: null })]);
  const autres = d.telephone_norm && tels.get(d.telephone_norm) > 1;
  const opt = (obj, v) => Object.entries(obj).map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const msg = `Bonjour ${d.nom || ''}, ici KASSIO IMMOBILIER au sujet de votre demande ${d.reference} (${d.bien_ref || ''} ${d.bien_titre || ''}).`;
  z.innerHTML = `<div class="card dm-f">
    <div class="dm-1"><h2>${esc(d.reference)}</h2><button type="button" class="btn sm ghost" id="x">Fermer</button></div>
    <p><b>${esc(d.nom || 'Membre')}</b> · ${esc(d.telephone || 'sans téléphone')} ${wa(d.telephone, msg)} ${d.telephone ? `<a class="btn sm ghost" href="tel:+${intl(d.telephone)}">Appeler</a>` : ''}</p>
    ${autres ? `<p class="small err-t">Ce téléphone a ${tels.get(d.telephone_norm)} demandes ouvertes : vérifiez s’il s’agit d’un doublon.</p>` : ''}
    ${d.message ? `<blockquote class="dm-msg">${esc(d.message)}</blockquote>` : ''}
    <div class="dm-bien">${b ? `<a href="#/bien/${b.id}" target="_blank"><b>${esc(b.reference)}</b> ${esc(b.titre)}</a><div class="muted small">${esc(prixBien(b))} · ${esc(lieuB(b))} · ${esc(SRC[b.source] || b.source)}${b.source_nom ? ' (' + esc(b.source_nom) + ')' : ''}${b.statut !== 'publie' ? ' · ' + esc(b.statut) : ''}</div>
      <button type="button" class="btn sm soft" id="ct" style="margin-top:8px">Voir le contact de l’annonceur</button><div id="ctz"></div>` : `<span class="muted">Bien supprimé : ${esc(d.bien_ref || '')} ${esc(d.bien_titre || '')}</span>`}</div>
    <form id="mf" class="dm-form">
      <div class="grid2">
        <div><label for="st">Étape</label><select id="st">${opt(LIB, d.statut)}</select></div>
        <div><label for="as">Responsable</label><select id="as"><option value="">—</option>${admins.map(a => `<option value="${a.id}" ${d.assigne_a === a.id ? 'selected' : ''}>${esc(a.nom_affichage || 'Admin')}</option>`).join('')}</select></div>
      </div>
      <div id="zv"><label for="vl">Date de la visite</label><input id="vl" type="datetime-local" value="${versLocal(d.visite_le || d.date_souhaitee)}"></div>
      <div id="zr" class="grid2"><div><label for="vr">Résultat de la visite</label><select id="vr"><option value="">—</option>${opt(RESULTATS, d.visite_resultat)}</select></div>
        <div><label for="cr">Compte rendu</label><textarea id="cr" rows="2" placeholder="Intérêt, objections, budget, décision attendue">${esc(d.compte_rendu || '')}</textarea></div></div>
      <div id="zp"><label for="mp">Motif de perte *</label><select id="mp"><option value="">Choisir…</option>${opt(MOTIFS, d.motif_perte)}</select></div>
      <div class="grid2"><div><label for="pa">Prochaine action</label><input id="pa" type="text" maxlength="160" value="${esc(d.prochaine_action || '')}" placeholder="Rappeler, envoyer les photos…"></div>
        <div><label for="pl">Pour le</label><input id="pl" type="datetime-local" value="${versLocal(d.prochaine_action_le)}"></div></div>
      <label for="no">Note (historique)</label><textarea id="no" rows="2" placeholder="Ce qui s’est dit, ce qui a été fait"></textarea>
      <p class="err" id="er" hidden></p>
      <div class="row"><button class="btn">Enregistrer</button>${!d.assigne_a ? '<button type="button" class="btn soft" id="moi">Je m’en occupe</button>' : ''}</div>
    </form>
    <h3 style="margin-top:20px">Notes internes <span class="muted small">(visibles des seuls administrateurs)</span></h3>
    <div id="nz"></div>
    <h3 style="margin-top:20px">Historique</h3>
    <div class="dm-h">${(H || []).map(h => `<div><span class="muted small">${esc(dateFr(h.created_at, true))} · ${esc(h.profiles?.nom_affichage || 'Système')}</span><br>${h.type === 'statut' ? `${esc(LIB[h.de_statut] || h.de_statut || '')} → <b>${esc(LIB[h.vers_statut] || h.vers_statut)}</b>` : h.type === 'creation' ? '<b>Demande créée</b>' : esc({ note: 'Note', assignation: 'Assignée à', relance: 'Prochaine action', visite: 'Visite' }[h.type] || h.type)}${h.note ? ' · ' + esc(h.note) : ''}</div>`).join('') || '<p class="muted">—</p>'}</div>
  </div>`;
  const $ = (s) => z.querySelector(s);
  $('#x').onclick = fermer;
  notesInternes($('#nz'), 'demande', d.id);
  const majZones = () => { const s = $('#st').value; $('#zv').hidden = !['visite_planifiee', 'visite_realisee', 'relance', 'gagne', 'perdu'].includes(s) && !d.visite_le; $('#zr').hidden = !['visite_realisee', 'relance', 'gagne', 'perdu'].includes(s) && !d.visite_resultat; $('#zp').hidden = s !== 'perdu'; };
  $('#st').onchange = majZones; majZones();
  const ct = $('#ct');
  if (ct) ct.onclick = async () => {
    ct.disabled = true;
    const { data, error } = await sb.rpc('admin_contact_bien', { p_bien: d.bien_id });
    if (error) { ct.disabled = false; return toast(errMsg(error)); }
    const c = data || {};
    $('#ctz').innerHTML = `<div class="dm-ct"><b>${esc(c.contact_nom || c.auteur || 'Annonceur')}</b>${c.societe ? ' · ' + esc(c.societe) : ''} · ${esc(c.contact_tel || 'numéro inconnu')} ${wa(c.contact_tel, `Bonjour, je vous contacte de la part de KASSIO IMMOBILIER au sujet de votre annonce${b ? ' « ' + b.titre + ' »' : ''}. Est-elle toujours disponible ?`)}
      ${c.texte_original ? `<details><summary class="small">Message d’origine</summary><p class="small" style="white-space:pre-line">${esc(c.texte_original)}</p></details>` : ''}<p class="muted small">Consultation enregistrée.</p></div>`;
    ct.remove();
  };
  const err = (m) => { $('#er').textContent = m; $('#er').hidden = !m; };
  const envoyer = async (extra = {}) => {
    err('');
    const v = (s) => $(s).value, iso = (s) => v(s) ? new Date(v(s)).toISOString() : null;
    const statut = v('#st');
    const args = { p_id: d.id, p_statut: statut, p_motif_perte: statut === 'perdu' ? v('#mp') || null : null, p_note: v('#no').trim() || null,
      p_prochaine_action: v('#pa').trim() && v('#pa').trim() !== (d.prochaine_action || '') ? v('#pa').trim() : null,
      p_prochaine_action_le: iso('#pl') && iso('#pl') !== d.prochaine_action_le ? iso('#pl') : null,
      p_assigne_a: v('#as') || null,
      p_visite_le: !$('#zv').hidden && iso('#vl') ? iso('#vl') : null,
      p_visite_resultat: !$('#zr').hidden && v('#vr') && v('#vr') !== d.visite_resultat ? v('#vr') : null,
      p_compte_rendu: !$('#zr').hidden && v('#cr').trim() ? v('#cr').trim() : null, ...extra };
    if (args.p_prochaine_action_le && !args.p_prochaine_action && !d.prochaine_action) return err('Indiquez la prochaine action.');
    const { error } = await sb.rpc('admin_maj_demande', args);
    if (error) return err(errMsg(error));
    toast('Demande mise à jour.'); recharger();
  };
  $('#mf').onsubmit = (e) => { e.preventDefault(); envoyer(); };
  const moi = $('#moi'); if (moi) moi.onclick = () => { $('#as').value = state.session.user.id; if ($('#st').value === 'nouveau') $('#st').value = 'contacte'; majZones(); envoyer(); };
}

// ---------- Validation des offres et des comptes pros ----------
export async function validation(box) {
  const o = new URLSearchParams((location.hash.split('?')[1]) || '').get('o') || 'offres';
  const [{ data: B }, { data: P }] = await Promise.all([
    sb.from('biens').select('*, profiles:auteur_id(nom_affichage,societe,type_compte,pro_valide,telephone)').eq('statut', 'en_attente').order('created_at'),
    sb.from('profiles').select('id,nom_affichage,societe,type_compte,pro_valide,telephone,created_at').neq('type_compte', 'particulier').eq('statut', 'actif').order('pro_valide').order('created_at', { ascending: false })]);
  const aVerif = (P || []).filter(p => !p.pro_valide).length;
  box.innerHTML = `<div class="chips tabs"><a class="chip ${o === 'offres' ? 'on' : ''}" href="#/admin/validation">Offres en attente <em>${(B || []).length}</em></a><a class="chip ${o === 'pros' ? 'on' : ''}" href="#/admin/validation?o=pros">Comptes pros <em>${aVerif}</em></a></div>
  ${o === 'offres'
    ? ((B || []).length ? `<div class="list">${B.map(b => `<div class="card val-r" data-id="${b.id}">
        <div class="val-ph">${(b.photos || []).slice(0, 4).map(u => `<img src="${esc(u)}" alt="" referrerpolicy="no-referrer">`).join('') || '<span class="muted small">Sans photo</span>'}</div>
        <div class="val-t"><b>${esc(b.reference)} · ${esc(b.titre)}</b><div class="small">${esc(TRANSACTIONS[b.transaction] || '')} · ${esc(TYPES[b.type_bien] || b.type_bien)} · ${esc(lieuB(b))} · ${esc(prixBien(b))}</div>
        <div class="muted small">Par ${esc(b.profiles?.nom_affichage || '—')}${b.profiles?.societe ? ' (' + esc(b.profiles.societe) + ')' : ''} · ${esc(b.profiles?.type_compte || '')}${b.profiles?.pro_valide ? ' vérifié' : ''} · ${esc(quand(b.created_at))}</div>
        ${b.description ? `<p class="small val-d">${esc(b.description.slice(0, 400))}</p>` : ''}
        <div class="row"><button class="btn sm" data-pub="${b.id}">Publier</button><button class="btn sm ghost" data-ref="${b.id}">Refuser</button><a class="btn sm ghost" href="#/bien/${b.id}" target="_blank">Voir</a></div></div></div>`).join('')}</div>`
      : '<div class="card center pad muted">Aucune offre en attente.</div>')
    : ((P || []).length ? `<table class="adm"><thead><tr><th>Nom</th><th>Société</th><th>Type</th><th>Téléphone</th><th>Statut</th><th></th></tr></thead><tbody>${P.map(p => `<tr><td>${esc(p.nom_affichage || '—')}</td><td>${esc(p.societe || '—')}</td><td>${esc(p.type_compte)}</td><td>${esc(p.telephone || '—')}</td><td>${p.pro_valide ? '<span class="badge ok">Vérifié</span>' : '<span class="badge warn">À vérifier</span>'}</td><td><button class="btn sm ${p.pro_valide ? 'ghost' : ''}" data-pro="${p.id}" data-v="${p.pro_valide ? '0' : '1'}">${p.pro_valide ? 'Retirer la vérification' : 'Vérifier'}</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="card center pad muted">Aucun compte professionnel déclaré.</div>')}`;
  box.querySelectorAll('[data-pub]').forEach(x => x.onclick = async () => { x.disabled = true; const { error } = await sb.rpc('admin_moderer_bien', { p_bien: x.dataset.pub, p_decision: 'publie' }); if (error) { x.disabled = false; return toast(errMsg(error)); } toast('Offre publiée.'); validation(box); });
  box.querySelectorAll('[data-ref]').forEach(x => x.onclick = () => {
    const r = x.closest('.val-t'); if (r.querySelector('.val-mot')) return;
    r.insertAdjacentHTML('beforeend', `<form class="val-mot"><label>Motif du refus (envoyé à l’annonceur)</label><input type="text" maxlength="200" required placeholder="Photos floues, prix manquant…"><div class="row" style="margin-top:8px"><button class="btn sm">Confirmer le refus</button></div></form>`);
    const f = r.querySelector('.val-mot'); f.querySelector('input').focus();
    f.onsubmit = async (e) => { e.preventDefault(); const m = f.querySelector('input').value.trim(); if (!m) return; const { error } = await sb.rpc('admin_moderer_bien', { p_bien: x.dataset.ref, p_decision: 'refuse', p_motif: m }); if (error) return toast(errMsg(error)); toast('Offre refusée, l’annonceur est prévenu.'); validation(box); };
  });
  box.querySelectorAll('[data-pro]').forEach(x => x.onclick = async () => { const { error } = await sb.rpc('admin_valider_pro', { p_user: x.dataset.pro, p_valide: x.dataset.v === '1' }); if (error) return toast(errMsg(error)); toast('Compte mis à jour.'); validation(box); });
}

// ---------- Toutes les offres (modération, contact annonceur) ----------
export async function catalogueAdmin(box) {
  const p = new URLSearchParams((location.hash.split('?')[1]) || ''), src = p.get('src') || '', st = p.get('st') || 'publie', q = (p.get('q') || '').trim();
  let req = sb.from('biens').select('id,reference,titre,transaction,type_bien,commune,quartier,prix_fcfa,periodicite,source,source_nom,statut,verifie,vues,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(200);
  if (src === 'pro') req = req.in('source', ['pro', 'kassio']); else if (src) req = req.eq('source', src);
  if (st) req = req.eq('statut', st);
  if (q) { const m = q.replace(/[%,()]/g, ' '); req = req.or(`titre.ilike.%${m}%,reference.ilike.%${m}%,quartier.ilike.%${m}%,commune.ilike.%${m}%`); }
  const { data: B, count, error } = await req;
  if (error) throw error;
  const lien = (o) => '#/admin/catalogue?' + new URLSearchParams(Object.fromEntries(Object.entries({ src, st, q, ...o }).filter(([, v]) => v))).toString();
  box.innerHTML = `
  <form id="cq" role="search"><input id="q" type="search" placeholder="Référence, titre, quartier…" value="${esc(q)}"></form>
  <div class="chips">${[['', 'Toutes'], ['pro', 'Pros'], ['whatsapp', 'WhatsApp'], ['web', 'Web']].map(([k, l]) => `<a class="chip ${src === k ? 'on' : ''}" href="${lien({ src: k })}">${l}</a>`).join('')}
    <span class="chips-sep"></span>${[['publie', 'En ligne'], ['expire', 'Expirées'], ['retire', 'Retirées'], ['refuse', 'Refusées']].map(([k, l]) => `<a class="chip ${st === k ? 'on' : ''}" href="${lien({ st: k })}">${l}</a>`).join('')}</div>
  <p class="muted small">${count ?? 0} offre${count > 1 ? 's' : ''}${count > 200 ? ' (200 affichées : affinez la recherche)' : ''}</p>
  <table class="adm no-q"><thead><tr><th>Réf.</th><th>Offre</th><th>Prix</th><th>Source</th><th>Vues</th><th>Ajoutée</th><th></th></tr></thead><tbody>
  ${(B || []).map(b => `<tr><td>${esc(b.reference)}</td><td><a href="#/bien/${b.id}" target="_blank">${esc(b.titre)}</a><div class="muted small">${esc(TRANSACTIONS[b.transaction] || '')} · ${esc(lieuB(b))}</div></td>
    <td data-tri="${b.prix_fcfa || 0}">${esc(prixBien(b))}</td><td>${esc(SRC[b.source] || b.source)}${b.source_nom ? `<div class="muted small">${esc(b.source_nom)}</div>` : ''}${b.verifie ? ' <span class="badge ok">vérifié</span>' : ''}</td>
    <td>${b.vues || 0}</td><td>${esc(dateFr(b.created_at))}</td>
    <td><div class="row"><button class="btn sm soft" data-ct="${b.id}">Contact</button>${b.statut === 'publie' ? `<button class="btn sm ghost" data-ret="${b.id}">Retirer</button>` : `<button class="btn sm ghost" data-pub="${b.id}">Remettre en ligne</button>`}</div><div class="ctz"></div></td></tr>`).join('')}
  </tbody></table>`;
  box.querySelector('#cq').onsubmit = (e) => { e.preventDefault(); location.hash = lien({ q: box.querySelector('#q').value.trim() }); };
  box.querySelectorAll('[data-ct]').forEach(x => x.onclick = async () => {
    const { data, error } = await sb.rpc('admin_contact_bien', { p_bien: x.dataset.ct }); if (error) return toast(errMsg(error));
    const c = data || {}; x.closest('td').querySelector('.ctz').innerHTML = `<div class="small">${esc(c.contact_nom || c.auteur || '')} ${esc(c.contact_tel || 'numéro inconnu')} ${wa(c.contact_tel)}</div>`; x.remove();
  });
  box.querySelectorAll('[data-ret]').forEach(x => x.onclick = async () => { const { error } = await sb.rpc('admin_moderer_bien', { p_bien: x.dataset.ret, p_decision: 'retire' }); if (error) return toast(errMsg(error)); toast('Offre retirée.'); catalogueAdmin(box); });
  box.querySelectorAll('[data-pub]').forEach(x => x.onclick = async () => { const { error } = await sb.rpc('admin_moderer_bien', { p_bien: x.dataset.pub, p_decision: 'publie' }); if (error) return toast(errMsg(error)); toast('Offre remise en ligne.'); catalogueAdmin(box); });
}

// ---------- Sources automatiques ----------
export async function sources(box) {
  const [{ data: s }, { data: J }, { data: W }] = await Promise.all([
    sb.rpc('admin_sources'),
    sb.from('scraping_journal').select('*').order('id', { ascending: false }).limit(10),
    sb.from('wa_messages').select('recu_le,groupe,statut,extrait').order('id', { ascending: false }).limit(30)]);
  const w = s?.wa_24h || {};
  box.innerHTML = `
  <section class="card"><div class="dm-1"><h2>Sites immobiliers (scraping)</h2><button class="btn sm" id="go">Lancer maintenant</button></div>
  <p class="muted small">CoinAfrique Côte d’Ivoire : appartements, meublés, villas, chambres, terrains, immeubles, bureaux. Passage automatique toutes les 3 heures ; les offres non revues pendant 30 jours expirent.</p>
  <table class="adm no-q"><thead><tr><th>Début</th><th>Durée</th><th>Annonces lues</th><th>Nouvelles</th><th>Erreurs</th></tr></thead><tbody>
  ${(J || []).map(j => `<tr><td>${esc(dateFr(j.debut, true))}</td><td>${j.fin ? Math.round((new Date(j.fin) - new Date(j.debut)) / 1000) + ' s' : 'en cours'}</td><td>${j.trouves}</td><td>${j.nouveaux}</td><td>${j.erreurs ? `<span class="err-t" title="${esc(j.detail || '')}">${j.erreurs}</span>` : 0}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Aucun passage.</td></tr>'}</tbody></table></section>
  <section class="card" style="margin-top:16px"><h2>Groupes WhatsApp (offres flash)</h2>
  <p class="muted small">${s?.wa_dernier ? 'Dernier message reçu ' + esc(quand(s.wa_dernier).toLowerCase()) + '.' : 'Aucun message reçu : la passerelle WhatsApp n’est pas encore branchée.'} Sur 24 h : ${w.nouveau || 0} nouvelles offres, ${w.doublon || 0} doublons, ${w.recherche || 0} recherches de clients, ${w.ignore || 0} messages ignorés.</p>
  ${(s?.groupes || []).length ? `<table class="adm no-q"><thead><tr><th>Groupe (7 jours)</th><th>Messages</th><th>Offres</th></tr></thead><tbody>${s.groupes.map(g => `<tr><td>${esc(g.groupe || '—')}</td><td>${g.messages}</td><td>${g.offres}</td></tr>`).join('')}</tbody></table>` : ''}
  ${(W || []).length ? `<details style="margin-top:12px"><summary>Derniers messages</summary><div class="list no-q">${W.map(m => `<div class="small dm-w"><span class="badge ${m.statut === 'nouveau' ? 'ok' : 'soft'}">${esc(m.statut)}</span> <b>${esc(m.groupe || '')}</b> · ${esc(quand(m.recu_le))}<br><span class="muted">${esc(m.extrait || '')}</span></div>`).join('')}</div></details>` : ''}
  </section>`;
  box.querySelector('#go').onclick = async (e) => { const b = e.currentTarget; b.disabled = true; b.textContent = 'Lancé…'; const { error } = await sb.rpc('admin_lancer_scraping'); if (error) { b.disabled = false; return toast(errMsg(error)); } toast('Passage lancé : résultat dans 1 à 2 minutes.', 5000); setTimeout(() => sources(box), 90000); };
}

// ---------- Notes internes (bien, demande, profil) ----------
export async function notesInternes(z, type, id) {
  const { data: N } = await sb.from('notes_internes').select('id,texte,created_at,auteur_id,profiles:auteur_id(nom_affichage)').eq('cible_type', type).eq('cible_id', id).order('created_at', { ascending: false });
  z.innerHTML = `<form class="ni-f"><input type="text" maxlength="2000" placeholder="Ex. propriétaire négociable de 10 %, zone très demandée…" aria-label="Nouvelle note"><button class="btn sm">Ajouter</button></form>
    <div class="dm-h">${(N || []).map(n => `<div><span class="muted small">${esc(dateFr(n.created_at, true))} · ${esc(n.profiles?.nom_affichage || 'Admin')}</span>${n.auteur_id === state.session.user.id ? ` <a href="#" class="small" data-sup="${n.id}">supprimer</a>` : ''}<br>${esc(n.texte)}</div>`).join('')}</div>`;
  z.querySelector('form').onsubmit = async (e) => { e.preventDefault(); const t = z.querySelector('input').value.trim(); if (!t) return;
    const { error } = await sb.from('notes_internes').insert({ cible_type: type, cible_id: id, texte: t }); if (error) return toast(errMsg(error)); notesInternes(z, type, id); };
  z.querySelectorAll('[data-sup]').forEach(a => a.onclick = async (e) => { e.preventDefault(); await sb.from('notes_internes').delete().eq('id', a.dataset.sup); notesInternes(z, type, id); });
}

// ---------- Vérification des identités ----------
export async function identites(box) {
  const { data: K, error } = await sb.from('kyc_dossiers').select('*, profiles:user_id(nom_affichage,societe,type_compte,telephone)').order('statut').order('envoye_le', { ascending: false });
  if (error) throw error;
  const chemins = (K || []).flatMap(k => [k.cni_path, k.selfie_path, k.rccm_path].filter(Boolean));
  const { data: S } = chemins.length ? await sb.storage.from('kyc').createSignedUrls(chemins, 900) : { data: [] };
  const url = new Map((S || []).map(x => [x.path, x.signedUrl]));
  const doc = (p, l) => p ? (/\.pdf$/.test(p) ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${esc(url.get(p) || '#')}">${l} (PDF)</a>` : `<a target="_blank" rel="noopener" href="${esc(url.get(p) || '#')}"><img class="kyc-img" src="${esc(url.get(p) || '')}" alt="${l}"></a>`) : '';
  box.innerHTML = (K || []).length ? `<div class="list">${K.map(k => `<div class="card val-r"><div class="val-ph">${doc(k.cni_path, 'Pièce d’identité')}${doc(k.selfie_path, 'Selfie')}${doc(k.rccm_path, 'RCCM')}</div>
    <div><b>${esc(k.profiles?.nom_affichage || '—')}</b>${k.profiles?.societe ? ' · ' + esc(k.profiles.societe) : ''} <span class="muted small">${esc(k.profiles?.type_compte || '')}</span>
    <div class="small">${esc(k.profiles?.telephone || '')} · envoyé ${esc(quand(k.envoye_le).toLowerCase())}</div>
    <p><span class="badge ${k.statut === 'valide' ? 'ok' : k.statut === 'refuse' ? 'soft' : 'warn'}">${{ en_attente: 'À vérifier', valide: 'Validé', refuse: 'Refusé' }[k.statut]}</span>${k.motif ? ' ' + esc(k.motif) : ''}</p>
    ${k.statut === 'en_attente' ? `<div class="row"><button class="btn sm" data-ok="${k.user_id}">Valider l’identité</button><button class="btn sm ghost" data-ko="${k.user_id}">Refuser</button></div>` : ''}
    <p class="muted small">Liens des documents valables 15 minutes.</p></div></div>`).join('')}</div>` : '<div class="card center pad muted">Aucun dossier d’identité reçu.</div>';
  box.querySelectorAll('[data-ok]').forEach(x => x.onclick = async () => { const { error } = await sb.rpc('admin_decider_kyc', { p_user: x.dataset.ok, p_valide: true }); if (error) return toast(errMsg(error)); toast('Identité validée.'); identites(box); });
  box.querySelectorAll('[data-ko]').forEach(x => x.onclick = async () => { const m = prompt('Motif du refus (envoyé au membre) :'); if (!m) return; const { error } = await sb.rpc('admin_decider_kyc', { p_user: x.dataset.ko, p_valide: false, p_motif: m }); if (error) return toast(errMsg(error)); toast('Dossier refusé.'); identites(box); });
}

// ---------- Journal des erreurs ----------
export async function erreurs(box) {
  const voir = new URLSearchParams((location.hash.split('?')[1]) || '').get('v') || 'ouvertes';
  let r = sb.from('erreurs_app').select('*').order('dernier', { ascending: false }).limit(100);
  if (voir === 'ouvertes') r = r.eq('resolue', false);
  const { data: E, error } = await r; if (error) throw error;
  box.innerHTML = `<div class="chips"><a class="chip ${voir === 'ouvertes' ? 'on' : ''}" href="#/admin/erreurs">À regarder</a><a class="chip ${voir === 'toutes' ? 'on' : ''}" href="#/admin/erreurs?v=toutes">Toutes</a></div>
  ${(E || []).length ? `<table class="adm no-q"><thead><tr><th>Erreur</th><th>Écran</th><th>Fois</th><th>Dernière</th><th></th></tr></thead><tbody>${E.map(e => `<tr><td><b>${esc(e.message)}</b><div class="muted small">${esc(e.source || '')}</div><div class="muted small">${esc((e.navigateur || '').slice(0, 90))}</div></td><td>${esc(e.page || '')}</td><td>${e.nb}</td><td>${esc(quand(e.dernier))}</td><td>${e.resolue ? '<span class="badge ok">Résolue</span>' : `<button class="btn sm ghost" data-res="${e.id}">Marquer résolue</button>`}</td></tr>`).join('')}</tbody></table>`
    : '<div class="card center pad muted">Aucune erreur remontée. Les erreurs rencontrées par les membres apparaissent ici automatiquement.</div>'}`;
  box.querySelectorAll('[data-res]').forEach(x => x.onclick = async () => { await sb.from('erreurs_app').update({ resolue: true }).eq('id', x.dataset.res); erreurs(box); });
}
