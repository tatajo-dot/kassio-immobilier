// KASSIO IMMOBILIER — biens immobiliers : catalogue multi-sources, fiche, demande de visite, publication par les pros
import { sb, state, esc, toast, errMsg, fcfa, dateFr, quand, compress } from './app.js';

export const TYPES = {
  appartement: 'Appartement', studio: 'Studio', villa: 'Villa', duplex: 'Duplex', maison: 'Maison', chambre: 'Chambre',
  residence_meublee: 'Résidence meublée', bureau: 'Bureau', commerce: 'Commerce', magasin: 'Magasin', entrepot: 'Entrepôt',
  terrain: 'Terrain', immeuble: 'Immeuble', autre: 'Autre'
};
export const TRANSACTIONS = { location: 'À louer', vente: 'À vendre', location_courte: 'Courte durée' };
export const COMMUNES = ['Cocody', 'Marcory', 'Yopougon', 'Plateau', 'Koumassi', 'Treichville', 'Port-Bouët', 'Adjamé', 'Abobo', 'Attécoubé',
  'Bingerville', 'Songon', 'Anyama', 'Grand-Bassam', 'Assinie', 'Jacqueville', 'Dabou', 'Yamoussoukro', 'Bouaké', 'San-Pédro'];
export const EQUIPEMENTS = { climatisation: 'Climatisation', parking: 'Parking', gardien: 'Gardien / sécurité', piscine: 'Piscine', jardin: 'Jardin',
  meuble: 'Meublé', groupe_electrogene: 'Groupe électrogène', ascenseur: 'Ascenseur', cuisine_equipee: 'Cuisine équipée', wifi: 'Wifi', terrasse: 'Terrasse', balcon: 'Balcon' };
export const SOURCES = { pro: 'Pro', kassio: 'KASSIO', whatsapp: 'Offre flash', web: 'Annonce web' };
export const STATUTS_DEMANDE = { nouveau: 'Envoyée', contacte: 'Prise en charge', visite_planifiee: 'Visite planifiée', visite_realisee: 'Visite réalisée',
  relance: 'En cours', gagne: 'Conclue', perdu: 'Clôturée' };
const STATUTS_BIEN = { brouillon: 'Brouillon', en_attente: 'En validation', publie: 'En ligne', refuse: 'Refusée', retire: 'Retirée', expire: 'Expirée' };
const PAGE = 24;

const qs = () => new URLSearchParams((location.hash.split('?')[1]) || '');
const casseTitre = (t) => { t = String(t || '').trim(); return t === t.toUpperCase() && t.length > 4 ? t.charAt(0) + t.slice(1).toLowerCase() : t; };
export const prixBien = (b) => !b.prix_fcfa ? 'Prix sur demande'
  : fcfa(b.prix_fcfa) + (b.periodicite === 'mois' ? ' / mois' : b.periodicite === 'nuit' ? ' / nuit' : '');
const lieu = (b) => [b.quartier && !String(b.quartier).toLowerCase().includes(String(b.commune || '').toLowerCase()) ? b.quartier : null, b.commune].filter(Boolean).join(', ');
const caracts = (b) => [b.nb_pieces ? b.nb_pieces + ' pièce' + (b.nb_pieces > 1 ? 's' : '') : null, b.nb_chambres ? b.nb_chambres + ' ch.' : null, b.surface_m2 ? b.surface_m2 + ' m²' : null].filter(Boolean).join(' · ');
const badgeSource = (b) => b.verifie ? '<span class="badge ok">Pro vérifié</span>' : b.source === 'whatsapp' ? '<span class="badge soft">Offre flash</span>' : b.source === 'web' ? '<span class="badge soft">Annonce web</span>' : '<span class="badge soft">Pro</span>';
const imgSure = (u) => /^https:\/\//.test(u || '') ? u : '';
// Pas de photo : visuel neutre honnête (jamais d'image de banque d'images)
const vide = (b) => `<div class="bi-vide"><span>${esc(TYPES[b.type_bien] || 'Bien')}</span><small>Photos sur demande</small></div>`;
const coeur = '<svg class="pi" viewBox="0 0 256 256" aria-hidden="true"><path d="M178,34c-21,0-39.26,9.47-50,25.34C117.26,43.47,99,34,78,34a60.07,60.07,0,0,0-60,60c0,29.2,18.2,59.59,54.1,90.31a334.68,334.68,0,0,0,53.06,37,6,6,0,0,0,5.68,0,334.68,334.68,0,0,0,53.06-37C219.8,153.59,238,123.2,238,94A60.07,60.07,0,0,0,178,34ZM128,209.11C111.59,199.64,30,149.72,30,94A48.05,48.05,0,0,1,78,46c20.28,0,37.31,10.83,44.45,28.27a6,6,0,0,0,11.1,0C140.69,56.83,157.72,46,178,46a48.05,48.05,0,0,1,48,48C226,149.72,144.41,199.64,128,209.11Z"/></svg>';

export function carteBien(b, favs) {
  const ph = imgSure((b.photos || [])[0]);
  return `<div class="card item bien-c" data-txt="${esc([b.titre, b.commune, b.quartier, b.reference].join(' '))}">
    <a href="#/bien/${b.id}"><div class="ph bi-ph">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${vide(b)}</div>
    <span class="badge st">${esc(TRANSACTIONS[b.transaction] || '')}</span>
    <div class="bd"><div class="p">${esc(prixBien(b))}</div><div class="t">${esc(casseTitre(b.titre))}</div>
    <div class="muted small">${esc([lieu(b), caracts(b)].filter(Boolean).join(' · '))}</div>
    <div class="bi-meta">${badgeSource(b)}<span class="muted small">${esc(b.reference)}</span></div></div></a>
    ${favs ? `<button class="fav${favs.has(b.id) ? ' on' : ''}" data-favb="${b.id}" aria-label="${favs.has(b.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${coeur}</button>` : ''}
  </div>`;
}

function filtrer(req, p) {
  const t = p.get('t'), ty = p.get('ty'), c = p.get('c'), max = parseInt(p.get('max') || '', 10), src = p.get('src'), q = (p.get('q') || '').trim(), pc = parseInt(p.get('pc') || '', 10);
  req = req.eq('statut', 'publie');
  if (t) req = req.eq('transaction', t);
  if (ty) req = req.eq('type_bien', ty);
  if (c) req = req.eq('commune', c);
  if (max > 0) req = req.lte('prix_fcfa', max);
  if (pc > 0) req = req.gte('nb_pieces', pc);
  if (src === 'verifies') req = req.eq('verifie', true);
  else if (src) req = req.eq('source', src);
  if (q) { const m = q.replace(/[%,()]/g, ' ').trim(); req = req.or(`titre.ilike.%${m}%,quartier.ilike.%${m}%,description.ilike.%${m}%,reference.ilike.%${m}%`); }
  const tri = p.get('tri');
  if (tri === 'prix') req = req.order('prix_fcfa', { ascending: true, nullsFirst: false });
  else if (tri === 'prix_desc') req = req.order('prix_fcfa', { ascending: false, nullsFirst: false });
  else req = req.order('verifie', { ascending: false }).order('publie_le', { ascending: false, nullsFirst: false });
  return req;
}

// ---------- Catalogue ----------
async function catalogue(app) {
  const p = qs(), vue = p.get('vue');
  const lien = (o) => '#/biens?' + new URLSearchParams(Object.fromEntries(Object.entries({ ...Object.fromEntries(p), ...o }).filter(([, v]) => v))).toString();
  const champs = 'id,reference,titre,transaction,type_bien,commune,quartier,prix_fcfa,periodicite,nb_pieces,nb_chambres,surface_m2,photos,source,verifie,publie_le';
  let req;
  if (vue === 'favoris') {
    const { data: f } = await sb.from('favoris_biens').select('bien_id');
    const ids = (f || []).map(x => x.bien_id);
    req = ids.length ? sb.from('biens').select(champs, { count: 'exact' }).in('id', ids).eq('statut', 'publie') : null;
  } else req = filtrer(sb.from('biens').select(champs, { count: 'exact' }), p);
  const [{ data, count, error }, fav] = await Promise.all([req ? req.range(0, PAGE - 1) : Promise.resolve({ data: [], count: 0 }), sb.from('favoris_biens').select('bien_id')]);
  if (error) throw error;
  const favs = new Set((fav.data || []).map(f => f.bien_id));
  const t = p.get('t') || '';
  const opt = (obj, v) => Object.entries(obj).map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
  app.innerHTML = `
  <a class="back" href="#/">‹ Accueil</a>
  <div class="bi-h"><div><h1>Biens immobiliers</h1><p class="muted">${count ?? 0} offre${count > 1 ? 's' : ''} · agences, promoteurs, offres flash et sites partenaires</p></div>
  <a class="btn sm" href="#/publier-bien">+ Publier un bien</a></div>
  <form id="s" role="search" style="margin-top:10px"><label class="sr" for="q">Rechercher</label><input id="q" type="search" placeholder="Quartier, référence KAS-…, mot-clé" value="${esc(p.get('q') || '')}"></form>
  <div class="chips">
    <a class="chip ${!t && vue !== 'favoris' ? 'on' : ''}" href="${lien({ t: '', vue: '' })}">Tout</a>
    ${Object.entries(TRANSACTIONS).map(([k, l]) => `<a class="chip ${t === k ? 'on' : ''}" href="${lien({ t: k, vue: '' })}">${l}</a>`).join('')}
    <a class="chip ${vue === 'favoris' ? 'on' : ''}" href="${lien({ vue: 'favoris' })}">Favoris</a>
    <a class="chip" href="#/mes-biens">Mes demandes</a>
    <a class="chip" href="#/assistant">Conseiller IA</a>
  </div>
  ${vue === 'favoris' ? '' : `<details class="bi-filtres" ${p.get('ty') || p.get('c') || p.get('max') || p.get('src') || p.get('pc') ? 'open' : ''}><summary>Filtres</summary>
  <form id="flt" class="bi-grid">
    <div><label for="ty">Type</label><select id="ty"><option value="">Tous</option>${opt(TYPES, p.get('ty'))}</select></div>
    <div><label for="c">Commune</label><select id="c"><option value="">Toutes</option>${COMMUNES.map(c => `<option ${p.get('c') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div><label for="pc">Pièces min.</label><select id="pc"><option value="">Indifférent</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${p.get('pc') == n ? 'selected' : ''}>${n}+</option>`).join('')}</select></div>
    <div><label for="max">Budget max (FCFA)</label><input id="max" type="number" inputmode="numeric" min="0" step="5000" value="${esc(p.get('max') || '')}" placeholder="ex. 300000"></div>
    <div><label for="src">Origine</label><select id="src"><option value="">Toutes</option><option value="verifies" ${p.get('src') === 'verifies' ? 'selected' : ''}>Pros vérifiés</option>${opt({ pro: 'Pros', whatsapp: 'Offres flash', web: 'Annonces web' }, p.get('src'))}</select></div>
    <div><label for="tri">Trier</label><select id="tri">${opt({ '': 'Pertinence', prix: 'Prix croissant', prix_desc: 'Prix décroissant' }, p.get('tri') || '')}</select></div>
    <div class="bi-act"><button class="btn sm">Appliquer</button><a class="btn sm ghost" href="${'#/biens' + (t ? '?t=' + t : '')}">Effacer</a></div>
  </form></details>`}
  ${(data || []).length ? `<div class="grid2 grid3" id="lst">${data.map(b => carteBien(b, favs)).join('')}</div>
    ${count > PAGE ? `<button class="btn ghost block" id="plus" style="margin-top:18px">Voir plus (${count - PAGE} autres)</button>` : ''}`
  : `<div class="card center pad">${vue === 'favoris' ? 'Aucun bien en favori. Touchez le cœur d’une offre pour la retrouver ici.' : 'Aucune offre ne correspond à ces critères.'}<br><br><a class="btn ghost" href="#/biens">Voir toutes les offres</a></div>`}`;

  const go = (o) => { location.hash = lien(o); };
  app.querySelector('#s').onsubmit = (e) => { e.preventDefault(); go({ q: app.querySelector('#q').value.trim() }); };
  const flt = app.querySelector('#flt');
  if (flt) flt.onsubmit = (e) => { e.preventDefault(); const v = (id) => flt.querySelector('#' + id).value; go({ ty: v('ty'), c: v('c'), pc: v('pc'), max: v('max'), src: v('src'), tri: v('tri') }); };
  let offset = PAGE;
  const plus = app.querySelector('#plus');
  if (plus) plus.onclick = async () => {
    plus.disabled = true; plus.textContent = 'Chargement…';
    const { data: d2, error: e2 } = await filtrer(sb.from('biens').select(champs), p).range(offset, offset + PAGE - 1);
    if (e2) { plus.disabled = false; return toast(errMsg(e2)); }
    app.querySelector('#lst').insertAdjacentHTML('beforeend', d2.map(b => carteBien(b, favs)).join('')); brancherFavs(app, favs);
    offset += PAGE; const reste = count - offset;
    if (reste > 0) { plus.disabled = false; plus.textContent = `Voir plus (${reste} autres)`; } else plus.remove();
  };
  brancherFavs(app, favs);
}

function brancherFavs(root, favs) {
  root.querySelectorAll('[data-favb]').forEach(b => { if (b._ok) return; b._ok = true; b.onclick = async () => {
    const id = b.dataset.favb, on = b.classList.contains('on');
    const r = on ? await sb.from('favoris_biens').delete().eq('bien_id', id) : await sb.from('favoris_biens').insert({ user_id: state.session.user.id, bien_id: id });
    if (r.error) return toast(errMsg(r.error));
    on ? favs.delete(id) : favs.add(id);
    b.classList.toggle('on', !on); b.setAttribute('aria-label', on ? 'Ajouter aux favoris' : 'Retirer des favoris');
  }; });
}

// ---------- Fiche d'un bien ----------
async function fiche(app, id) {
  const { data: b } = await sb.from('biens').select('*').eq('id', id).maybeSingle();
  if (!b) { app.innerHTML = `<a class="back" href="#/biens">‹ Biens</a><div class="card center pad"><b>Cette offre n’est plus disponible.</b><br><br><a class="btn" href="#/biens">Voir les offres</a></div>`; return; }
  const moi = b.auteur_id === state.session.user.id;
  const [{ data: dem }, { data: fv }, { data: sim }] = await Promise.all([
    sb.from('demandes_biens').select('reference,statut,visite_le').eq('bien_id', b.id).eq('demandeur_id', state.session.user.id).not('statut', 'in', '(gagne,perdu)').maybeSingle(),
    sb.from('favoris_biens').select('bien_id').eq('bien_id', b.id).maybeSingle(),
    sb.from('biens').select('id,reference,titre,transaction,type_bien,commune,quartier,prix_fcfa,periodicite,nb_pieces,nb_chambres,surface_m2,photos,source,verifie')
      .eq('statut', 'publie').eq('transaction', b.transaction).eq('type_bien', b.type_bien).neq('id', b.id).eq('commune', b.commune || '').limit(6)]);
  if (b.statut === 'publie' && !moi) sb.rpc('vue_bien', { p_bien: b.id }).then(() => {});
  const [{ data: note }, { data: mesDem }, { data: monAvis }] = await Promise.all([
    sb.from('v_notes_biens').select('moyenne,nb').eq('bien_id', b.id).maybeSingle(),
    sb.from('demandes_biens').select('id').eq('bien_id', b.id).eq('demandeur_id', state.session.user.id).or('visite_resultat.eq.realisee,statut.in.(visite_realisee,gagne)').limit(1),
    sb.from('avis_biens').select('id').eq('bien_id', b.id).eq('auteur_id', state.session.user.id).maybeSingle()]);
  const peutNoter = (mesDem || []).length && !monAvis;
  const photos = (b.photos || []).map(imgSure).filter(Boolean);
  const eq = (b.equipements || []).map(e => EQUIPEMENTS[e] || e);
  const favs = new Set(fv ? [b.id] : []);
  app.innerHTML = `
  <a class="back" href="#/biens">‹ Biens immobiliers</a>
  <div class="detail"><div class="detail-media">
    ${photos.length ? `<div class="gal" tabindex="0" aria-label="Photos du bien">${photos.map(u => `<img src="${esc(u)}" alt="${esc(b.titre)}" referrerpolicy="no-referrer" onerror="this.remove()">`).join('')}</div>
      ${photos.length > 1 ? `<p class="muted small">${photos.length} photos : faites glisser</p>` : ''}`
    : `<div class="ph bi-ph bi-grand">${vide(b)}</div><p class="muted small">Les photos sont transmises par votre conseiller KASSIO, qui les obtient auprès de l’annonceur.</p>`}
  </div><div class="detail-info">
    <div class="tags">${badgeSource(b)}<span class="badge soft">${esc(TRANSACTIONS[b.transaction] || '')}</span>${moi ? `<span class="badge warn">${esc(STATUTS_BIEN[b.statut])}</span>` : ''}</div>
    <h1>${esc(casseTitre(b.titre))}</h1>
    <h2 style="margin-top:4px">${esc(prixBien(b))}</h2>
    <div class="tags"><span class="tag">${esc(TYPES[b.type_bien] || b.type_bien)}</span>${lieu(b) ? `<span class="tag">${esc(lieu(b))}</span>` : ''}${caracts(b) ? `<span class="tag">${esc(caracts(b))}</span>` : ''}<span class="tag">Réf. ${esc(b.reference)}</span></div>
    ${eq.length ? `<p class="small"><b>Équipements :</b> ${esc(eq.join(', '))}</p>` : ''}
    ${b.description ? `<div class="bi-desc">${esc(b.description)}</div>` : ''}
    ${note?.nb ? `<p class="bi-note">${'★'.repeat(Math.round(note.moyenne))}${'☆'.repeat(5 - Math.round(note.moyenne))} <b>${String(note.moyenne).replace('.', ',')}</b> <span class="muted small">(${note.nb} avis après visite)</span></p>` : ''}
    <p class="muted small">Publiée ${b.publie_le ? quand(b.publie_le).toLowerCase() : 'récemment'}${b.vues ? ` · ${b.vues} vue${b.vues > 1 ? 's' : ''}` : ''}</p>
    ${moi ? `<div class="row"><a class="btn block" href="#/publier-bien?id=${b.id}">Modifier</a><a class="btn ghost block" href="#/mes-biens">Mes biens</a></div>`
      : b.statut !== 'publie' ? '<p class="muted">Cette offre n’est plus proposée.</p>'
      : dem ? `<div class="zoo"><b>Demande ${esc(dem.reference)} : ${esc(STATUTS_DEMANDE[dem.statut])}</b>${dem.visite_le ? `<p>Visite prévue le ${esc(dateFr(dem.visite_le, true))}.</p>` : '<p>Un conseiller KASSIO vous recontacte.</p>'}<a href="#/mes-biens">Suivre mes demandes</a></div>`
      : `<button class="btn block" id="dv">Demander une visite</button><button class="btn ghost block" id="di" style="margin-top:8px">Demander plus d’informations</button><div id="frm"></div>
        <p class="muted small">KASSIO vérifie la disponibilité auprès de l’annonceur et organise la visite : vous n’avez pas à négocier seul.</p>`}
    ${!moi ? `<button class="fav fav-inline${favs.has(b.id) ? ' on' : ''}" data-favb="${b.id}" aria-label="${favs.has(b.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${coeur}<span>Favori</span></button>` : ''}
  </div></div>
  ${peutNoter ? `<section class="card" style="margin-top:20px" id="avz"><h2>Vous avez visité ce bien : votre avis ?</h2><div class="bi-etoiles" role="radiogroup" aria-label="Note">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" aria-label="${n} sur 5">☆</button>`).join('')}</div>
    <textarea id="avc" maxlength="1000" placeholder="État réel du bien, accueil, conformité à l’annonce…"></textarea><button class="btn sm" id="avg" style="margin-top:8px" disabled>Publier mon avis</button></section>` : ''}
  ${(sim || []).length ? `<section style="margin-top:28px"><h2>Offres similaires${b.commune ? ' à ' + esc(b.commune) : ''}</h2><div class="grid2 grid3">${sim.map(s => carteBien(s, null)).join('')}</div></section>` : ''}`;
  brancherFavs(app, favs);
  const formulaire = (type) => {
    const z = app.querySelector('#frm'); const tel = state.profil.telephone || '';
    const demain = new Date(Date.now() + 864e5); demain.setHours(10, 0, 0, 0);
    const loc = new Date(demain.getTime() - demain.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    z.innerHTML = `<form class="card ask-tel" novalidate><b>${type === 'visite' ? 'Votre demande de visite' : 'Votre question'}</b>
      ${type === 'visite' ? `<label for="dt">Date et heure souhaitées</label><input id="dt" type="datetime-local" value="${loc}">` : ''}
      <label for="tl">Votre téléphone (WhatsApp de préférence)</label><input id="tl" type="tel" inputmode="tel" autocomplete="tel" value="${esc(tel)}" placeholder="+225 07 00 00 00 00">
      <label for="ms">Message ${type === 'visite' ? '(facultatif)' : ''}</label><textarea id="ms" maxlength="1000" placeholder="${type === 'visite' ? 'Disponibilités, questions…' : 'Disponibilité, charges, caution…'}"></textarea>
      <p class="err" id="er" hidden></p>
      <div class="row"><button class="btn" type="submit">Envoyer</button><button class="btn ghost" type="button" id="xx">Annuler</button></div></form>`;
    z.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const err = (m) => { const e = z.querySelector('#er'); e.textContent = m; e.hidden = !m; };
    z.querySelector('#xx').onclick = () => { z.innerHTML = ''; };
    z.querySelector('form').onsubmit = async (e) => {
      e.preventDefault(); err('');
      const t = z.querySelector('#tl').value.trim(), m = z.querySelector('#ms').value.trim(), d = z.querySelector('#dt')?.value;
      if (t.replace(/[^0-9]/g, '').length < 8) return err('Indiquez un numéro pour que votre conseiller vous joigne.');
      if (type === 'info' && m.length < 3) return err('Écrivez votre question.');
      const bt = z.querySelector('[type=submit]'); bt.disabled = true; bt.textContent = 'Envoi…';
      const { data, error } = await sb.rpc('demander_bien', { p_bien: b.id, p_type: type, p_message: m || null, p_date: d ? new Date(d).toISOString() : null, p_telephone: t });
      if (error) { bt.disabled = false; bt.textContent = 'Envoyer'; return err(errMsg(error)); }
      if (!state.profil.telephone) state.profil.telephone = t;
      app.querySelector('#dv')?.remove(); app.querySelector('#di')?.remove();
      z.innerHTML = `<div class="zoo"><b>Demande ${esc(data.reference)} envoyée</b><p>${data.existante ? 'Vous aviez déjà une demande en cours pour ce bien.' : 'Un conseiller KASSIO vous contacte rapidement au ' + esc(t) + '.'}</p><a href="#/mes-biens">Suivre mes demandes</a></div>`;
      window.dispatchEvent(new Event('kas-fete'));
    };
  };
  const avz = app.querySelector('#avz');
  if (avz) { let n = 0; const et = avz.querySelectorAll('[data-n]');
    et.forEach(x => x.onclick = () => { n = +x.dataset.n; et.forEach(y => { y.textContent = +y.dataset.n <= n ? '★' : '☆'; y.classList.toggle('on', +y.dataset.n <= n); }); avz.querySelector('#avg').disabled = false; });
    avz.querySelector('#avg').onclick = async () => { const { error } = await sb.from('avis_biens').insert({ bien_id: b.id, note: n, commentaire: avz.querySelector('#avc').value.trim() || null });
      if (error) return toast(errMsg(error)); avz.innerHTML = '<b>Merci pour votre avis.</b>'; }; }
  app.querySelector('#dv')?.addEventListener('click', () => formulaire('visite'));
  app.querySelector('#di')?.addEventListener('click', () => formulaire('info'));
}

// ---------- Publier / modifier un bien (pros et particuliers) ----------
async function publierBien(app) {
  const id = qs().get('id');
  let b = null;
  if (id) {
    const { data } = await sb.from('biens').select('*').eq('id', id).maybeSingle();
    if (!data || data.auteur_id !== state.session.user.id) { app.innerHTML = `<a class="back" href="#/mes-biens">‹ Mes biens</a><div class="card center pad">Cette offre ne peut pas être modifiée.</div>`; return; }
    b = data;
  }
  const pr = state.profil, MAXP = 10;
  let gardees = [...(b?.photos || [])], files = [];
  const opt = (obj, v) => Object.entries(obj).map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
  app.innerHTML = `
  <a class="back" href="${b ? '#/bien/' + b.id : '#/biens'}">‹ ${b ? 'Retour à l’offre' : 'Biens immobiliers'}</a>
  <h1>${b ? 'Modifier l’offre ' + esc(b.reference) : 'Publier un bien'}</h1>
  <p class="muted">Chaque offre est vérifiée par KASSIO avant sa mise en ligne. Les visiteurs ne voient jamais votre numéro : KASSIO organise les visites.</p>
  <form id="f" class="narrow" novalidate>
    <fieldset class="bi-pro"><legend>Vous publiez en tant que</legend>
      <div class="grid2"><div><label for="tc">Type de compte</label><select id="tc">${opt({ particulier: 'Particulier', agent: 'Agent immobilier', promoteur: 'Promoteur', entreprise: 'Entreprise' }, pr.type_compte || 'particulier')}</select></div>
      <div><label for="so">Société / agence</label><input id="so" type="text" maxlength="80" value="${esc(pr.societe || '')}" placeholder="Nom commercial"></div></div>
      ${pr.type_compte && pr.type_compte !== 'particulier' ? `<p class="hint">${pr.pro_valide ? 'Compte pro vérifié : vos offres portent le badge « Pro vérifié ».' : 'Compte pro en cours de vérification par KASSIO.'}</p>` : ''}
    </fieldset>
    <div class="chips" id="tr">${Object.entries(TRANSACTIONS).map(([k, l]) => `<a class="chip ${(b?.transaction || 'location') === k ? 'on' : ''}" data-v="${k}">${l}</a>`).join('')}</div>
    <div class="grid2">
      <div><label for="ty">Type de bien *</label><select id="ty">${opt(TYPES, b?.type_bien || 'appartement')}</select></div>
      <div><label for="cm">Commune *</label><select id="cm"><option value="">Choisir…</option>${COMMUNES.map(c => `<option ${b?.commune === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    </div>
    <label for="qu">Quartier</label><input id="qu" type="text" maxlength="80" value="${esc(b?.quartier || '')}" placeholder="Riviera Palmeraie, Zone 4…">
    <label for="ti">Titre de l’annonce *</label><input id="ti" type="text" maxlength="120" value="${esc(b?.titre || '')}" placeholder="Appartement 3 pièces avec parking">
    <div class="grid2">
      <div><label for="px">Prix (FCFA) <span id="per"></span></label><input id="px" type="number" inputmode="numeric" min="0" step="1000" value="${b?.prix_fcfa || ''}" placeholder="250000"></div>
      <div><label for="sf">Surface (m²)</label><input id="sf" type="number" inputmode="numeric" min="0" value="${b?.surface_m2 || ''}"></div>
      <div><label for="np">Pièces</label><input id="np" type="number" inputmode="numeric" min="0" max="50" value="${b?.nb_pieces || ''}"></div>
      <div><label for="nc">Chambres</label><input id="nc" type="number" inputmode="numeric" min="0" max="50" value="${b?.nb_chambres || ''}"></div>
    </div>
    <label>Équipements</label><div class="bi-eq">${Object.entries(EQUIPEMENTS).map(([k, l]) => `<label class="check"><input type="checkbox" value="${k}" ${(b?.equipements || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <label for="de">Description</label><textarea id="de" maxlength="4000" placeholder="État, charges, caution, disponibilité…">${esc(b?.description || '')}</textarea>
    <label>Photos (jusqu’à ${MAXP})</label>
    <label class="drop" for="ph">Ajouter des photos<small>JPEG ou PNG, compressées automatiquement</small></label>
    <input id="ph" type="file" accept="image/*" multiple class="sr"><div class="thumbs" id="th"></div>
    <label for="tl">Téléphone de contact (visible de KASSIO uniquement)</label><input id="tl" type="tel" inputmode="tel" value="${esc(pr.telephone || '')}" placeholder="+225 07 00 00 00 00">
    <p class="err" id="err" hidden></p>
    <button class="btn block" id="go" style="margin-top:16px">${b ? 'Enregistrer (nouvelle vérification)' : 'Envoyer pour vérification'}</button>
  </form>`;
  const $ = (s) => app.querySelector(s);
  let tr = b?.transaction || 'location';
  const per = () => { $('#per').textContent = tr === 'vente' ? '(prix total)' : tr === 'location_courte' ? '(par nuit)' : '(par mois)'; };
  per();
  app.querySelectorAll('#tr .chip').forEach(c => c.onclick = () => { tr = c.dataset.v; app.querySelectorAll('#tr .chip').forEach(x => x.classList.toggle('on', x === c)); per(); });
  const dessiner = () => {
    $('#th').innerHTML = gardees.map((u, i) => `<div class="th"><img src="${esc(u)}" alt="Photo ${i + 1}" referrerpolicy="no-referrer"><button type="button" data-rg="${i}" aria-label="Retirer la photo">×</button></div>`).join('')
      + files.map((f, i) => `<div class="th"><img src="${URL.createObjectURL(f)}" alt="Nouvelle photo ${i + 1}"><button type="button" data-rf="${i}" aria-label="Retirer la photo">×</button></div>`).join('');
    app.querySelectorAll('[data-rg]').forEach(x => x.onclick = () => { gardees.splice(+x.dataset.rg, 1); dessiner(); });
    app.querySelectorAll('[data-rf]').forEach(x => x.onclick = () => { files.splice(+x.dataset.rf, 1); dessiner(); });
  };
  dessiner();
  $('#ph').onchange = (e) => { const place = MAXP - gardees.length; files = files.concat([...e.target.files]).slice(0, place); if (e.target.files.length > place) toast(`${MAXP} photos maximum.`); e.target.value = ''; dessiner(); };
  const err = (m) => { $('#err').textContent = m; $('#err').hidden = !m; if (m) $('#err').scrollIntoView({ block: 'center' }); };
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault(); err('');
    const v = (s) => $(s).value.trim(), n = (s) => { const x = parseInt($(s).value, 10); return Number.isFinite(x) && x > 0 ? x : null; };
    const titre = v('#ti'), commune = v('#cm'), tc = $('#tc').value, so = v('#so'), tel = v('#tl');
    if (titre.length < 5) return err('Donnez un titre d’au moins 5 caractères.');
    if (!commune) return err('Choisissez la commune.');
    if (tc !== 'particulier' && so.length < 2) return err('Indiquez le nom de votre société ou agence.');
    if (tel.replace(/[^0-9]/g, '').length < 8) return err('Indiquez un téléphone pour que KASSIO vous joigne.');
    const go = $('#go'); go.disabled = true; go.textContent = 'Envoi…';
    try {
      if (tc !== (pr.type_compte || 'particulier') || so !== (pr.societe || '')) {
        const { error } = await sb.rpc('declarer_compte_pro', { p_type: tc, p_societe: so });
        if (error) throw error; pr.type_compte = tc; pr.societe = so;
      }
      const uid = state.session.user.id, nouvelles = [];
      for (const f of files) {
        go.textContent = `Envoi des photos (${nouvelles.length + 1}/${files.length})…`;
        const blob = await compress(f, 1600, 0.82), path = `${uid}/${crypto.randomUUID()}.jpg`;
        const { error } = await sb.storage.from('biens').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
        if (error) throw error;
        nouvelles.push(sb.storage.from('biens').getPublicUrl(path).data.publicUrl);
      }
      const ligne = { transaction: tr, type_bien: $('#ty').value, commune, quartier: v('#qu') || null, titre, description: v('#de'),
        prix_fcfa: n('#px'), periodicite: tr === 'vente' ? 'total' : tr === 'location_courte' ? 'nuit' : 'mois',
        surface_m2: n('#sf'), nb_pieces: n('#np'), nb_chambres: n('#nc'),
        equipements: [...app.querySelectorAll('.bi-eq input:checked')].map(x => x.value), photos: [...gardees, ...nouvelles], statut: 'en_attente' };
      go.textContent = 'Enregistrement…';
      const r = b ? await sb.from('biens').update(ligne).eq('id', b.id).select('id').single() : await sb.from('biens').insert(ligne).select('id').single();
      if (r.error) throw r.error;
      await sb.from('biens_prives').upsert({ bien_id: r.data.id, contact_nom: pr.nom_affichage || null, contact_tel: tel });
      toast('Offre envoyée : KASSIO la vérifie avant sa mise en ligne.', 5000);
      location.hash = '#/mes-biens';
    } catch (e) { go.disabled = false; go.textContent = b ? 'Enregistrer (nouvelle vérification)' : 'Envoyer pour vérification'; err(errMsg(e)); }
  };
}

// ---------- Mes biens publiés et mes demandes ----------
async function mesBiens(app) {
  const uid = state.session.user.id;
  const [{ data: mb }, { data: md }] = await Promise.all([
    sb.from('biens').select('id,reference,titre,statut,motif_refus,prix_fcfa,periodicite,transaction,vues,created_at,photos').eq('auteur_id', uid).order('created_at', { ascending: false }),
    sb.from('demandes_biens').select('id,reference,bien_id,bien_ref,bien_titre,type,statut,visite_le,created_at,statut_change_le').eq('demandeur_id', uid).order('created_at', { ascending: false })]);
  const o = qs().get('o') || ((md || []).length || !(mb || []).length ? 'demandes' : 'offres');
  app.innerHTML = `<a class="back" href="#/biens">‹ Biens immobiliers</a><h1>Mes biens</h1>
  <div class="chips tabs"><a class="chip ${o === 'demandes' ? 'on' : ''}" href="#/mes-biens?o=demandes">Mes demandes (${(md || []).length})</a><a class="chip ${o === 'offres' ? 'on' : ''}" href="#/mes-biens?o=offres">Mes offres (${(mb || []).length})</a><a class="chip" href="#/publier-bien">+ Publier un bien</a></div>
  ${o === 'demandes'
    ? ((md || []).length ? md.map(d => `<a class="card line bi-line" href="#/bien/${d.bien_id}"><div><b>${esc(d.bien_titre || d.bien_ref || 'Bien')}</b><div class="muted small">${esc(d.reference)} · ${esc(d.bien_ref || '')} · envoyée ${esc(quand(d.created_at).toLowerCase())}</div>
        ${d.visite_le ? `<div class="small">Visite le ${esc(dateFr(d.visite_le, true))}</div>` : ''}</div><span class="badge ${d.statut === 'gagne' ? 'ok' : d.statut === 'perdu' ? 'soft' : 'warn'}">${esc(STATUTS_DEMANDE[d.statut])}</span></a>`).join('')
      : '<div class="card center pad">Vous n’avez encore demandé aucune visite.<br><br><a class="btn" href="#/biens">Parcourir les offres</a></div>')
    : ((mb || []).length ? mb.map(b => `<div class="card line bi-line"><div><a href="#/bien/${b.id}"><b>${esc(b.titre)}</b></a><div class="muted small">${esc(b.reference)} · ${esc(prixBien(b))} · ${b.vues || 0} vue${b.vues > 1 ? 's' : ''}</div>
        ${b.statut === 'refuse' && b.motif_refus ? `<div class="small err-t">Motif : ${esc(b.motif_refus)}</div>` : ''}</div>
        <div class="bi-acts"><span class="badge ${b.statut === 'publie' ? 'ok' : b.statut === 'refuse' ? 'warn' : 'soft'}">${esc(STATUTS_BIEN[b.statut])}</span>
        <a class="btn sm ghost" href="#/publier-bien?id=${b.id}">Modifier</a>${b.statut === 'publie' || b.statut === 'en_attente' ? `<button class="btn sm ghost" data-ret="${b.id}">Retirer</button>` : ''}</div></div>`).join('')
      : '<div class="card center pad">Vous n’avez publié aucune offre.<br><br><a class="btn" href="#/publier-bien">Publier un bien</a></div>')}`;
  app.querySelectorAll('[data-ret]').forEach(x => x.onclick = async () => {
    if (!confirm('Retirer cette offre du catalogue ?')) return;
    const { error } = await sb.from('biens').update({ statut: 'retire' }).eq('id', x.dataset.ret);
    if (error) return toast(errMsg(error)); toast('Offre retirée.'); mesBiens(app);
  });
}

// ---------- Assistant immobilier (IA) ----------
const HISTO = [];
async function assistant(app) {
  const bulle = (r, t) => `<div class="as-b ${r}">${esc(t).replace(/\b(KAS-\d+)\b/g, '<b>$1</b>')}</div>`;
  app.innerHTML = `<a class="back" href="#/biens">‹ Biens immobiliers</a><h1>Votre conseiller KASSIO</h1>
  <p class="muted">Décrivez ce que vous cherchez : commune, type de bien, budget. Exemple : « appartement 3 pièces à Cocody, 300 000 par mois ».</p>
  <div class="as-fil" id="fil">${HISTO.length ? HISTO.map(h => bulle(h.role === 'user' ? 'moi' : 'kas', h.content)).join('') : bulle('kas', 'Bonjour, je suis votre conseiller KASSIO. Que recherchez-vous ?')}</div>
  <div id="res"></div>
  <form id="af" class="as-f"><label class="sr" for="aq">Votre message</label><input id="aq" type="text" maxlength="800" autocomplete="off" placeholder="Votre recherche…"><button class="btn">Envoyer</button></form>
  <p class="muted small">Le conseiller ne voit que les offres du catalogue KASSIO. Pour visiter, ouvrez une offre puis « Demander une visite ».</p>`;
  const fil = app.querySelector('#fil'), f = app.querySelector('#af'), q = app.querySelector('#aq');
  f.onsubmit = async (e) => {
    e.preventDefault(); const t = q.value.trim(); if (!t) return;
    q.value = ''; fil.insertAdjacentHTML('beforeend', bulle('moi', t) + '<div class="as-b kas att">…</div>'); fil.scrollTop = fil.scrollHeight;
    const btn = f.querySelector('button'); btn.disabled = true;
    const { data, error } = await sb.functions.invoke('assistant', { body: { question: t, historique: HISTO } });
    fil.querySelector('.att')?.remove(); btn.disabled = false;
    if (error || !data?.reponse) { fil.insertAdjacentHTML('beforeend', bulle('kas', 'Le conseiller est indisponible pour le moment. Réessayez dans un instant.')); return; }
    HISTO.push({ role: 'user', content: t }, { role: 'assistant', content: data.reponse }); if (HISTO.length > 12) HISTO.splice(0, HISTO.length - 12);
    fil.insertAdjacentHTML('beforeend', bulle('kas', data.reponse)); fil.scrollTop = fil.scrollHeight;
    app.querySelector('#res').innerHTML = (data.biens || []).length ? `<div class="grid2 grid3" style="margin:14px 0">${data.biens.map(b => carteBien(b, null)).join('')}</div>` : '';
    q.focus();
  };
}

// ---------- Vérification d'identité ----------
async function verification(app) {
  const { data: k } = await sb.from('kyc_dossiers').select('statut,motif,envoye_le').eq('user_id', state.session.user.id).maybeSingle();
  const pro = state.profil.type_compte && state.profil.type_compte !== 'particulier';
  const etat = !k ? '' : k.statut === 'valide' ? '<div class="zoo"><b>Identité vérifiée</b><p>Le badge apparaît sur vos offres.</p></div>'
    : k.statut === 'en_attente' ? `<div class="zoo"><b>Dossier en cours d’examen</b><p>Envoyé ${esc(quand(k.envoye_le).toLowerCase())}. Vous serez notifié de la décision.</p></div>`
    : `<div class="zoo"><b>Dossier refusé</b><p>${esc(k.motif || '')}</p><p>Vous pouvez renvoyer vos pièces ci-dessous.</p></div>`;
  app.innerHTML = `<a class="back" href="#/profil">‹ Mon compte</a><h1>Vérifier mon identité</h1>
  <p class="muted">Pour publier des offres en confiance, KASSIO vérifie l’identité des annonceurs. Vos documents restent privés : seuls les administrateurs KASSIO y ont accès.</p>${etat}
  ${k?.statut === 'valide' || k?.statut === 'en_attente' ? '' : `<form id="kf" class="narrow" novalidate>
    <label for="cni">Pièce d’identité (CNI, passeport) *</label><input id="cni" type="file" accept="image/*,application/pdf">
    <label for="sel">Selfie avec la pièce d’identité *</label><input id="sel" type="file" accept="image/*" capture="user">
    ${pro ? '<label for="rc">Registre du commerce (RCCM) ou attestation professionnelle</label><input id="rc" type="file" accept="image/*,application/pdf">' : ''}
    <p class="err" id="ke" hidden></p><button class="btn block" style="margin-top:16px">Envoyer mon dossier</button></form>`}`;
  const f = app.querySelector('#kf'); if (!f) return;
  f.onsubmit = async (e) => {
    e.preventDefault(); const err = (m) => { const x = f.querySelector('#ke'); x.textContent = m; x.hidden = !m; };
    const cni = f.querySelector('#cni').files[0], sel = f.querySelector('#sel').files[0], rc = f.querySelector('#rc')?.files[0];
    if (!cni || !sel) return err('La pièce d’identité et le selfie sont obligatoires.');
    const bt = f.querySelector('button'); bt.disabled = true; bt.textContent = 'Envoi…';
    try {
      const uid = state.session.user.id;
      const envoi = async (file, nom) => { const pdf = file.type === 'application/pdf'; const blob = pdf ? file : await compress(file, 1600, 0.85);
        const path = `${uid}/${Date.now()}-${nom}.${pdf ? 'pdf' : 'jpg'}`; const { error } = await sb.storage.from('kyc').upload(path, blob, { contentType: pdf ? 'application/pdf' : 'image/jpeg' }); if (error) throw error; return path; };
      const p1 = await envoi(cni, 'cni'), p2 = await envoi(sel, 'selfie'), p3 = rc ? await envoi(rc, 'rccm') : null;
      const { error } = await sb.rpc('envoyer_kyc', { p_cni: p1, p_selfie: p2, p_rccm: p3 }); if (error) throw error;
      toast('Dossier envoyé.'); verification(app);
    } catch (x) { bt.disabled = false; bt.textContent = 'Envoyer mon dossier'; err(errMsg(x)); }
  };
}

export async function renderBiens(app, vue, param) {
  if (vue === 'assistant') return assistant(app);
  if (vue === 'verification') return verification(app);
  if (vue === 'bien') return fiche(app, param);
  if (vue === 'publier-bien') return publierBien(app);
  if (vue === 'mes-biens') return mesBiens(app);
  return catalogue(app);
}
