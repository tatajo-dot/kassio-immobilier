// KASSIO IMMOBILIER — motion design : transitions entre écrans, photo partagée, révélations au défilement,
// parallaxe, compteurs, indicateur de navigation, intro. Tout est désactivé si l'appareil demande moins d'animations.
const app = document.getElementById('app');
// emblème KASSIO (les deux arcs du logo, redessinés en vectoriel pour rester nets)
const MARK = null; // ancien tracé du logo ADRESS retiré
// Kassio : le motif décoratif du logo ADRESS (courbes rouge et grise) est retiré ; à remplacer par celui de Kassio si besoin
const markSvg = () => '';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
let pending = null, shared = false, vignette = null, parClic = false; // vignette : [lien de l'annonce, image de fond de la carte]

// ---------- intro : à chaque ouverture de l'appli (logo puis « CLUB ») ----------
let seen = false; try { seen = sessionStorage.getItem('kas-intro') === 'off'; } catch (_) {}
let intro = null; const t0 = Date.now();
if (!reduce && !seen) {
  // v118 : le logo se dévoile de gauche à droite, le trait rouge se trace, « CLUB » arrive lettre par lettre, puis un reflet balaie le logo
  intro = document.createElement('div'); intro.className = 'intro intro2 intro3';
  intro.innerHTML = '<div class="intro-stage"><div class="nl-w"><img class="nl" src="logo-adress.png" alt="KASSIO IMMOBILIER"><em class="nl-sh" aria-hidden="true"></em></div><div class="intro-in"><i></i><span class="cl" aria-hidden="true">' + ''.split('').map((c, k) => '<b style="--k:' + k + '" aria-hidden="true">' + c + '</b>').join('') + '</span></div></div>';
  document.body.appendChild(intro);
  // impact ressenti : légère vibration quand les deux traits se croisent
  setTimeout(() => { try { if (matchMedia('(pointer: coarse)').matches && navigator.vibrate) navigator.vibrate([14, 60, 22]); } catch (_) {} }, 1050);
}
const closeIntro = () => {
  if (!intro) return; const el = intro; intro = null;
  // l'intro s'efface dès que le premier écran est prêt (au plus tôt 2,6 s, le temps que toute l'animation se joue)
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 750); }, Math.max(0, 2600 - (Date.now() - t0)));
};
setTimeout(closeIntro, 4200);

// ---------- transitions entre écrans (View Transitions API) ----------
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const href = a.getAttribute('href'); if (href === location.hash) return;
  // sens du mouvement : onglets et filtres = sur place, lien « retour » = vers la gauche, le reste = on avance
  root.dataset.dir = a.closest('.tabbar, .top, .chips, .cat-bar, .tabs, .adm-g, .adm-s') ? 'tab' : a.classList.contains('back') || href === '#/' ? 'back' : 'fwd'; parClic = true;
  const ph = a.querySelector('.ph');
  shared = !!(ph && /^#\/annonce\//.test(href));
  if (shared) vignette = [href, ph.style.backgroundImage];
  if (reduce || !document.startViewTransition) { shared = false; return; }
  e.preventDefault();
  if (shared) ph.style.viewTransitionName = 'photo';
  root.classList.add('vt');
  const t = document.startViewTransition(() => new Promise((res) => {
    pending = res; setTimeout(() => { if (pending === res) { pending = null; res(); } }, 600);
    location.hash = href;
  }));
  t.finished.finally(() => { root.classList.remove('vt'); shared = false; document.querySelectorAll('[style*="view-transition-name"]').forEach(el => el.style.viewTransitionName = ''); });
}, true);
// retour (bouton du téléphone, geste) ou navigation lancée par l'appli elle-même : le sens se déduit du chemin parcouru
const pile = [location.hash];
window.addEventListener('hashchange', () => {
  const h = location.hash, retour = pile.length > 1 && pile[pile.length - 2] === h;
  if (retour) pile.pop(); else if (pile[pile.length - 1] !== h) pile.push(h);
  if (!parClic) root.dataset.dir = retour ? 'back' : 'tab';
  parClic = false; if (vignette && h !== vignette[0]) vignette = null;
});
// La transition part dès que le squelette de l'écran suivant est affiché : l'écran ne reste jamais figé pendant le chargement
addEventListener('kas-squelette', () => {
  // l'attente se voit : la vignette touchée s'agrandit quand même jusqu'à la place de la grande photo
  const sp = shared && vignette && app.querySelector('.sk-photo'); if (sp) { sp.style.backgroundImage = vignette[1]; sp.classList.add('has-ph'); sp.style.viewTransitionName = 'photo'; }
  if (pending) { const r = pending; pending = null; r(); } });

// ---------- après chaque rendu d'écran ----------
new MutationObserver(() => {
  if (!app.classList.contains('page-in')) return;
  decorate();
  closeIntro();
  if (pending) { const r = pending; pending = null; r(); }
}).observe(app, { attributes: true, attributeFilter: ['class'] });

// éléments qui apparaissent ensemble au défilement : l'un après l'autre (80 ms d'écart)
const io = 'IntersectionObserver' in window ? new IntersectionObserver((list) => { let k = 0; list.forEach(x => { if (x.isIntersecting) { x.target.style.transitionDelay = (k++ * 60) + 'ms'; x.target.classList.add('in'); io.unobserve(x.target); } }); }, { rootMargin: '0px 0px -8% 0px' }) : null;

const vus = new Set();
function photos() {
  app.querySelectorAll('.ph:not(.ld)').forEach(el => {
    const m = /url\(["']?(.*?)["']?\)/.exec(el.style.backgroundImage || ''); if (!m || !m[1] || vus.has(m[1])) { el.classList.add('ld'); return; }
    const im = new Image(); im.onload = () => { vus.add(m[1]); el.classList.add('ld'); }; im.onerror = () => { el.classList.add('ld', 'ko'); window.dispatchEvent(new CustomEvent('kas-photo-ko', { detail: m[1] })); }; im.src = m[1];
  });
  app.querySelectorAll('.gal img:not(.ld)').forEach(im => { if (im.complete) im.classList.add('ld'); else im.addEventListener('load', () => im.classList.add('ld'), { once: true }); });
}
new MutationObserver(photos).observe(app, { childList: true, subtree: true });
// page de connexion : emblème animé en fond
const loginFx = () => { const l = app.querySelector('.login'); if (l && !l.querySelector('.login-mark')) l.insertAdjacentHTML('afterbegin', markSvg('login-mark') + markSvg('login-mark lm2')); };
loginFx(); new MutationObserver(loginFx).observe(app, { childList: true, subtree: true });

function decorate() {
  const g = app.querySelector('.gal img');
  if (g && shared) g.style.viewTransitionName = 'photo';
  // la vignette reste affichée sous la grande photo le temps qu'elle charge : pas de flou, pas de trou
  if (g && vignette && location.hash === vignette[0]) { g.style.backgroundImage = vignette[1]; g.classList.add('de-vignette', 'ld'); g.closest('.detail')?.classList.add('depuis-vignette'); }
  // emblème KASSIO animé : sur le bandeau d'accueil (depuis la v105, à côté du « Bonjour »)
  const hero = app.querySelector('.hero, .accueil-b .salut');
  if (hero && !hero.querySelector('.mark-anim')) hero.insertAdjacentHTML('beforeend', markSvg('mark-anim'));
  app.querySelectorAll('.fc-cover').forEach(c => { if (!c.querySelector('.mark-anim')) c.insertAdjacentHTML('beforeend', markSvg('mark-anim sm')); });
  // chargement progressif des photos (flou → net)
  photos();
  if (reduce) return;
  // révélation au défilement pour ce qui est sous la ligne de flottaison
  if (io) app.querySelectorAll('.grid2 > .item, .rayon, .mini, .menu a, .list > .card, .stat, .feature, section:not(.rayon) > h2').forEach(el => {
    if (el.getBoundingClientRect().top > innerHeight * .92) { el.classList.add('rv'); io.observe(el); }
  });
  // compteurs animés (indicateurs)
  app.querySelectorAll('.stat .v').forEach(el => {
    // Compte jusqu'à la valeur en gardant l'unité (« 93 % », « 4 j », « 1,5 mois »)
    const txt = String(el.textContent), m = /^(\d+(?:[.,]\d+)?)(.*)$/.exec(txt.trim()); if (!m) return;
    const n = parseFloat(m[1].replace(',', '.')), suf = m[2], virg = m[1].includes(','); if (!isFinite(n) || n === 0) return;
    const dec = /[.,]/.test(m[1]) ? 1 : 0, t0 = performance.now(), d = 1100;
    const step = (t) => { const p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3); const v = (n * e).toFixed(dec); el.textContent = (virg ? v.replace('.', ',') : v) + suf; if (p < 1) requestAnimationFrame(step); else el.textContent = txt; };
    requestAnimationFrame(step);
  });
  moveIndicator();
}

// ---------- indicateur de navigation qui glisse ----------
const bar = document.getElementById('nav');
let ind = null;
function moveIndicator() {
  if (!bar) return;
  if (!ind) { ind = document.createElement('i'); ind.className = 'tab-ind'; bar.appendChild(ind); bar.classList.add('has-ind'); }
  const on = bar.querySelector('a.on:not(.tab-pub)');
  if (!on) { ind.style.opacity = '0'; return; }
  const r = on.getBoundingClientRect(), b = bar.getBoundingClientRect();
  ind.style.opacity = '1'; ind.style.transform = `translateX(${r.left - b.left + r.width / 2 - 11}px)`;
}
addEventListener('resize', moveIndicator);

// ---------- parallaxe du bandeau ----------
let ticking = false;
addEventListener('scroll', () => {
  if (reduce || ticking) return; ticking = true;
  requestAnimationFrame(() => { const z = app.querySelector('.hero .bgz'); if (z) z.style.translate = `0 ${Math.min(scrollY, 400) * 0.3}px`; ticking = false; });
}, { passive: true });

// ---------- mobile : vibrations, points de galerie, tirer pour actualiser, glisser pour revenir ----------
const touch = matchMedia('(pointer: coarse)').matches;
const buzz = (ms = 8) => { try { if (touch && navigator.vibrate) navigator.vibrate(ms); } catch (_) {} };
document.addEventListener('click', (e) => { if (e.target.closest('.tabbar a, .fav, #int, .chip, [data-act], .btn')) buzz(); }, true);

new MutationObserver(() => {
  const gal = app.querySelector('.gal');
  if (!gal || gal.children.length < 2 || gal.dataset.dots) return;
  gal.dataset.dots = '1';
  const d = document.createElement('div'); d.className = 'dots';
  d.innerHTML = [...gal.children].map((_, i) => '<i' + (i ? '' : ' class="on"') + '></i>').join('');
  gal.after(d);
  // flèches précédent / suivant + points cliquables
  const n = gal.children.length, w = document.createElement('div'); w.className = 'gal-w';
  gal.before(w); w.appendChild(gal);
  w.insertAdjacentHTML('beforeend', '<button type="button" class="gal-nav prev" aria-label="Photo précédente">‹</button><button type="button" class="gal-nav next" aria-label="Photo suivante">›</button><span class="gal-n">1 / ' + n + '</span>');
  const aller = (i) => gal.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * gal.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  w.querySelector('.prev').onclick = () => aller(last - 1);
  w.querySelector('.next').onclick = () => aller(last + 1);
  d.querySelectorAll('i').forEach((x, k) => x.onclick = () => aller(k));
  const maj = () => { w.querySelector('.prev').disabled = last === 0; w.querySelector('.next').disabled = last === n - 1; w.querySelector('.gal-n').textContent = (last + 1) + ' / ' + n; };
  let last = 0; maj();
  gal.addEventListener('scroll', () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); if (i !== last) { last = i; buzz(5); d.querySelectorAll('i').forEach((x, k) => x.classList.toggle('on', k === i)); maj(); } }, { passive: true });
}).observe(app, { childList: true });

if (touch && !reduce) {
  const ptr = document.createElement('div'); ptr.className = 'ptr'; ptr.innerHTML = '<i></i>'; document.body.appendChild(ptr);
  let y0 = null, pulled = 0, sx = null, sy = 0;
  const iosBrowser = /iP(hone|ad|od)/.test(navigator.userAgent) && !navigator.standalone;
  addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    y0 = scrollY <= 0 && !e.target.closest('.gal, .strip, .flip, input, textarea, select, .tabs') ? t.clientY : null;
    sx = !iosBrowser && t.clientX < 24 ? t.clientX : null; sy = t.clientY;
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    pulled = Math.max(0, Math.min(110, (e.touches[0].clientY - y0) * 0.5));
    if (pulled > 4) { ptr.classList.add('drag'); ptr.style.opacity = Math.min(1, pulled / 60); ptr.style.transform = `translate(-50%, ${pulled - 50}px) rotate(${pulled * 3}deg)`; }
  }, { passive: true });
  addEventListener('touchend', (e) => {
    ptr.classList.remove('drag');
    if (y0 !== null && pulled > 70) {
      buzz(12); ptr.style.opacity = ''; ptr.style.transform = ''; ptr.classList.add('spin');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      setTimeout(() => ptr.classList.remove('spin'), 900);
    } else if (y0 !== null) { ptr.style.opacity = ''; ptr.style.transform = ''; }
    y0 = null; pulled = 0;
    if (sx !== null) {
      const t = e.changedTouches[0];
      if (t.clientX - sx > 80 && Math.abs(t.clientY - sy) < 70 && location.hash && location.hash !== '#/') {
        buzz(); root.dataset.dir = 'back';
        if (document.startViewTransition) {
          root.classList.add('vt');
          const v = document.startViewTransition(() => new Promise((res) => { pending = res; setTimeout(() => { if (pending === res) { pending = null; res(); } }, 600); history.back(); }));
          v.finished.finally(() => root.classList.remove('vt'));
        } else history.back();
      }
      sx = null;
    }
  }, { passive: true });
}

// ================= v45 : finitions premium =================
const fin = matchMedia('(pointer: fine)').matches;
const CONF = ['#D4101D', '#E8323E', '#9A9CA3', '#C9CBD0', '#111214'];
// Fête aux couleurs KASSIO : petits arcs du logo qui jaillissent (annonce publiée, demande envoyée, appli installée…)
function feteAdress(x = innerWidth / 2, y = innerHeight * .42) {
  if (reduce) return;
  const box = document.createElement('div'); box.className = 'confetti'; document.body.appendChild(box);
  for (let i = 0; i < 34; i++) {
    const s = document.createElement('i'), c = CONF[i % CONF.length], arc = i % 3 !== 2;
    s.innerHTML = arc ? `<svg viewBox="0 0 24 14"><path d="M2 12 Q12 -4 22 12" fill="none" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/></svg>` : '';
    if (!arc) s.style.background = c;
    s.style.left = x + 'px'; s.style.top = y + 'px'; box.appendChild(s);
    const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 220, dx = Math.cos(a) * v, dy = Math.sin(a) * v - 160, r = (Math.random() - .5) * 720;
    s.animate([{ transform: 'translate(-50%,-50%) scale(.4) rotate(0)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * .8}px), calc(-50% + ${dy * .8}px)) scale(1) rotate(${r * .6}deg)`, opacity: 1, offset: .45 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 260}px)) scale(.9) rotate(${r}deg)`, opacity: 0 }],
      { duration: 1300 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
  }
  setTimeout(() => box.remove(), 2300);
}
addEventListener('kas-fete', () => { const b = document.querySelector('#int, .zoo, .toast:not([hidden])'); const r = b && b.getBoundingClientRect(); feteAdress(r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 2 : undefined); });

// Cœur des favoris : petite gerbe de particules
document.addEventListener('animationstart', (e) => {
  if (reduce || e.animationName !== 'heart' || !e.target.classList.contains('on')) return;
  const b = e.target, r = b.getBoundingClientRect();
  for (let i = 0; i < 9; i++) {
    const p = document.createElement('i'); p.className = 'spark'; p.style.left = r.left + r.width / 2 + 'px'; p.style.top = r.top + r.height / 2 + 'px';
    document.body.appendChild(p); const a = (i / 9) * Math.PI * 2, d = 22 + Math.random() * 10;
    p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0)`, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => p.remove();
  }
});

// Titres : les mots apparaissent un à un
function titres() {
  if (reduce) return;
  app.querySelectorAll('h1:not(.wd)').forEach(h => {
    h.classList.add('wd'); if (h.children.length || !h.textContent.trim()) return;
    h.innerHTML = h.textContent.trim().split(/\s+/).map((w, i) => `<span class="w" style="--i:${i}"><span>${w.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span></span>`).join(' ');
  });
}

// Ordinateur : cartes en relief qui suivent la souris, avec reflet ; boutons « aimantés »
if (fin && !reduce) {
  let cur = null, raf = 0, ev = null;
  const SEL = '.item, .fc, .mini, .rs-card';
  document.addEventListener('pointermove', (e) => {
    ev = e; if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; const t = ev.target.closest && ev.target.closest(SEL);
      if (cur && cur !== t) { cur.style.transform = ''; cur.classList.remove('tilt'); cur = null; }
      if (t) {
        const r = t.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
        if (!t.querySelector(':scope > .glare')) t.insertAdjacentHTML('beforeend', '<i class="glare"></i>');
        t.classList.add('tilt'); cur = t;
        t.style.transform = `perspective(1000px) rotateX(${(.5 - py) * 4}deg) rotateY(${(px - .5) * 5}deg) translateY(-3px)`;
        t.style.setProperty('--gx', px * 100 + '%'); t.style.setProperty('--gy', py * 100 + '%');
      }
      const h = ev.target.closest && ev.target.closest('.hero');
      if (h) { if (!h.querySelector(':scope > .spot')) h.insertAdjacentHTML('beforeend', '<i class="spot"></i>'); const r = h.getBoundingClientRect(); h.style.setProperty('--mx', ev.clientX - r.left + 'px'); h.style.setProperty('--my', ev.clientY - r.top + 'px'); }
    });
  }, { passive: true });
}

// Fine barre de progression de lecture sous l'en-tête
const prog = document.createElement('i'); prog.className = 'read-prog'; document.body.appendChild(prog);
let tk2 = false;
addEventListener('scroll', () => {
  if (tk2) return; tk2 = true;
  requestAnimationFrame(() => { const m = document.documentElement.scrollHeight - innerHeight; prog.style.transform = `scaleX(${m > 200 ? Math.min(1, scrollY / m) : 0})`; tk2 = false; });
}, { passive: true });

// Boutons principaux : reflet qui passe de temps en temps
function reflets() { app.querySelectorAll('#int:not([disabled]), .inst1').forEach(b => b.classList.add('shine')); }

new MutationObserver(() => { if (app.classList.contains('page-in')) { titres(); reflets(); } }).observe(app, { attributes: true, attributeFilter: ['class'] });
titres(); reflets();

// ================= v107 : l'emblème KASSIO remplace le rond de chargement et les confettis de publication =================
// Deux anneaux séparés (gris puis rouge) pour pouvoir les dessiner l'un après l'autre
// Kassio : roue de chargement simple (l'emblème animé reprenait le logo ADRESS)
const emb = (cls) => '<span class="emb ' + cls + '" aria-hidden="true"><span class="spinner"></span></span>';
// Écran de démarrage
{ const s = app.querySelector('.splash .spinner'); if (s) s.outerHTML = '<span role="status" aria-label="Chargement">' + emb('boucle') + '</span>'; }
// Chargement d'un écran : l'emblème n'apparaît que si l'attente se prolonge (pas de clignotement sur les chargements rapides)
addEventListener('kas-squelette', () => { const sk = app.querySelector('.sk'); if (sk && !sk.querySelector('.emb')) sk.insertAdjacentHTML('beforeend', '<span class="sk-emb" role="status" aria-label="Chargement">' + emb('boucle') + '</span>'); });
// Annonce publiée : l'emblème se dessine une fois, puis le message
addEventListener('kas-publiee', (e) => {
  const d = e.detail || {}, h = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  document.querySelector('.publiee')?.remove();
  const o = document.createElement('div'); o.className = 'publiee'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'pub-t');
  o.innerHTML = emb('unefois') + '<div class="pub-txt"><h2 id="pub-t">Votre annonce<br>est en ligne.</h2><p>Vos voisins la voient dès maintenant dans le Market.</p>'
    + (d.titre ? '<div class="pub-fiche">' + (d.photo ? '<img src="' + h(d.photo) + '" alt="">' : '') + '<span><b>' + h(d.titre) + '</b><small>' + h(d.prix) + '</small></span></div>' : '')
    + '<button class="btn" type="button" data-pub="voir">Voir mon annonce</button><button class="pub-lien" type="button" data-pub="accueil">Retour à l’accueil</button></div>';
  const fermer = () => { if (!o.isConnected) return; o.classList.add('sort'); setTimeout(() => o.remove(), reduce ? 0 : 260); };
  o.addEventListener('click', (ev) => { const b = ev.target.closest('[data-pub]'); if (!b) return; if (b.dataset.pub === 'accueil') location.hash = '#/'; fermer(); });
  addEventListener('hashchange', function f() { if (location.hash !== '#/annonce/' + d.id) { removeEventListener('hashchange', f); fermer(); } });
  o.tabIndex = -1; document.body.appendChild(o); o.focus({ preventScroll: true });
});
