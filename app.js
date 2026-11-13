var CLE = 'vinted-stock-v2';
var courant = null;
var photoCourante = '';
var ETATS = ['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant'];
var etatChoisi = 'Très bon état';

/* ---------- Stockage ---------- */
function lire() { try { return JSON.parse(localStorage.getItem(CLE)) || []; } catch (e) { return []; } }
function ecrire(d) {
  try { localStorage.setItem(CLE, JSON.stringify(d)); }
  catch (e) { alert('Espace plein : supprime des photos ou télécharge une sauvegarde.'); }
}
function v(id) { return document.getElementById(id).value.trim(); }
function majuscule(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function euros(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €'; }

/* ---------- Thème sombre / clair ---------- */
function themeClair() { return document.documentElement.getAttribute('data-theme') === 'clair'; }
function basculerTheme() {
  if (themeClair()) { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('vinted-theme', 'sombre'); }
  else { document.documentElement.setAttribute('data-theme', 'clair'); localStorage.setItem('vinted-theme', 'clair'); }
  if (document.getElementById('page-dash').classList.contains('actif')) dessiner();
}

/* ---------- Menus déroulants personnalisés ---------- */
var menus = {};
var FLECHE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

function creerMenu(id, surChoix) {
  var el = document.getElementById(id), options = el.getAttribute('data-options').split('|');
  var etat = { valeur: options[0], options: options };
  menus[id] = etat;
  el.innerHTML = '<button type="button" class="menu-btn"><span></span>' + FLECHE + '</button><div class="menu-liste"></div>';
  var btn = el.querySelector('.menu-btn'), liste = el.querySelector('.menu-liste'), texte = btn.querySelector('span');
  texte.textContent = etat.valeur;
  options.forEach(function (o) {
    var d = document.createElement('div'); d.textContent = o;
    if (o === etat.valeur) d.classList.add('choisi');
    d.onclick = function () {
      etat.valeur = o; texte.textContent = o;
      Array.prototype.forEach.call(liste.children, function (c) { c.classList.toggle('choisi', c === d); });
      el.classList.remove('ouvert');
      if (surChoix) surChoix(o);
    };
    liste.appendChild(d);
  });
  btn.onclick = function (e) {
    e.stopPropagation();
    var etaitOuvert = el.classList.contains('ouvert');
    fermerMenus();
    if (!etaitOuvert) el.classList.add('ouvert');
  };
}
function fermerMenus() {
  Array.prototype.forEach.call(document.querySelectorAll('.menu.ouvert'), function (m) { m.classList.remove('ouvert'); });
}
document.addEventListener('click', fermerMenus);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermerMenus(); });
function valeurMenu(id) { return menus[id].valeur; }

/* ---------- Pastilles d'état ---------- */
function creerPastilles() {
  var zone = document.getElementById('pastilles-etat'); zone.innerHTML = '';
  ETATS.forEach(function (e) {
    var b = document.createElement('button'); b.type = 'button';
    b.className = 'pastille' + (e === etatChoisi ? ' actif' : ''); b.textContent = e;
    b.onclick = function () {
      etatChoisi = e;
      Array.prototype.forEach.call(zone.children, function (c) { c.classList.toggle('actif', c === b); });
    };
    zone.appendChild(b);
  });
}

/* ---------- Navigation ---------- */
function aller(nom) {
  ['dash', 'nouveau', 'stock'].forEach(function (p) {
    document.getElementById('page-' + p).classList.toggle('actif', p === nom);
    document.getElementById('nav-' + p).classList.toggle('actif', p === nom);
  });
  fermerMenus();
  if (nom === 'dash') dessiner();
  if (nom === 'stock') afficherStock();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function facteurEtat(etat) {
  var t = { 'Neuf avec étiquette': 1.1, 'Neuf sans étiquette': 1.0, 'Très bon état': 0.95, 'Bon état': 0.85, 'Satisfaisant': 0.7 };
  return t[etat] || 1;
}

/* ---------- Photo : redimensionnée pour économiser l'espace ---------- */
document.getElementById('photo').addEventListener('change', function (e) {
  var f = e.target.files[0];
  if (!f) { photoCourante = ''; return; }
  var lecteur = new FileReader();
  lecteur.onload = function () {
    var img = new Image();
    img.onload = function () {
      var max = 500, ratio = Math.min(1, max / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      photoCourante = c.toDataURL('image/jpeg', 0.7);
      if (courant) courant.photo = photoCourante;
    };
    img.src = lecteur.result;
  };
  lecteur.readAsDataURL(f);
});

/* ---------- Génération de l'annonce ---------- */
function generer() {
  var type = valeurMenu('m-type'), cat = v('cat'), marque = v('marque'), taille = v('taille'), couleur = v('couleur');
  var etat = etatChoisi, details = v('details');
  var achat = parseFloat(v('achat')), marge = parseFloat(v('marge'));
  if (!cat || !marque || !taille || isNaN(achat) || isNaN(marge)) {
    alert('Remplis au moins : catégorie, marque, taille, prix d\'achat et marge.');
    return;
  }
  var titre = majuscule((cat + ' ' + marque + ' ' + (couleur ? couleur + ' ' : '') + 'taille ' + taille + ' - ' + etat).replace(/\s+/g, ' '));

  var lignes = [];
  lignes.push(majuscule(cat) + ' ' + marque + (couleur ? ' de couleur ' + couleur : '') + ', taille ' + taille + '.');
  lignes.push('État : ' + etat.toLowerCase() + '.');
  if (details) lignes.push(majuscule(details) + (/[.!?]$/.test(details) ? '' : '.'));
  lignes.push('');
  lignes.push('Envoi rapide et soigné. N\'hésitez pas à me poser vos questions ou à regrouper plusieurs articles pour économiser les frais de port !');
  var desc = lignes.join('\n');

  var prix = Math.max(1, Math.round(achat * marge * facteurEtat(etat)));
  var benef = prix - achat;
  var prixTxt = 'Prix conseillé : ' + prix + ' €\n(achat ' + achat.toFixed(2) + ' € x marge ' + marge + ' x coefficient d\'état ' + facteurEtat(etat) + ')\nBénéfice estimé avant frais : ' + benef.toFixed(2) + ' €\nVérifie toujours avec les annonces similaires avant de publier.';

  var sortie = document.getElementById('sortie');
  sortie.style.display = 'none'; void sortie.offsetWidth; sortie.style.display = 'block';
  document.getElementById('outTitre').textContent = titre;
  document.getElementById('outDesc').textContent = desc;
  document.getElementById('outPrix').textContent = prixTxt;
  document.getElementById('lienVinted').href = 'https://www.vinted.fr/catalog?search_text=' + encodeURIComponent([marque, cat, taille].join(' '));

  courant = { type: type, cat: cat, marque: marque, titre: titre, desc: desc, achat: achat, prix: prix,
              vendu: null, statut: 'En vente', photo: photoCourante, dateAjout: Date.now(), dateVente: null };
}

function copier(id, bouton) {
  var texte = document.getElementById(id).textContent;
  if (navigator.clipboard) { navigator.clipboard.writeText(texte); }
  else {
    var t = document.createElement('textarea'); t.value = texte; document.body.appendChild(t);
    t.select(); document.execCommand('copy'); document.body.removeChild(t);
  }
  if (bouton) {
    var avant = bouton.textContent; bouton.textContent = 'Copié !';
    bouton.classList.remove('copie'); void bouton.offsetWidth; bouton.classList.add('copie');
    setTimeout(function () { bouton.textContent = avant; }, 1400);
  }
}

function sauver() {
  if (!courant) return;
  var d = lire(); courant.id = Date.now(); d.push(courant); ecrire(d);
  reinit(); aller('stock');
}

function reinit() {
  ['cat', 'marque', 'taille', 'couleur', 'achat', 'details', 'photo'].forEach(function (i) { document.getElementById(i).value = ''; });
  document.getElementById('marge').value = 2;
  document.getElementById('sortie').style.display = 'none';
  courant = null; photoCourante = ''; etatChoisi = 'Très bon état'; creerPastilles();
}

/* ---------- Stock : recherche, filtres, tri ---------- */
function afficherStock() {
  var d = lire();
  var q = v('fRecherche').toLowerCase(), st = valeurMenu('m-statut'), ty = valeurMenu('m-ftype'), tri = valeurMenu('m-tri');
  d = d.filter(function (a) {
    var texte = (a.titre + ' ' + (a.marque || '') + ' ' + (a.cat || '')).toLowerCase();
    return (!q || texte.indexOf(q) !== -1) && (st === 'Tous' || a.statut === st) && (ty === 'Tous' || a.type === ty);
  });
  d.sort(function (a, b) {
    if (tri === 'Prix croissant') return a.prix - b.prix;
    if (tri === 'Prix décroissant') return b.prix - a.prix;
    if (tri === 'Meilleure marge') return (b.prix - b.achat) - (a.prix - a.achat);
    return b.id - a.id;
  });

  document.getElementById('compte').textContent = d.length + (d.length > 1 ? ' articles' : ' article');
  var g = document.getElementById('grille');
  g.innerHTML = '';
  if (!d.length) { g.innerHTML = '<div class="vide">Aucun article ne correspond.</div>'; return; }

  d.forEach(function (a, i) {
    var carte = document.createElement('div'); carte.className = 'article';
    carte.style.animationDelay = Math.min(i * 40, 400) + 'ms';
    var photo = document.createElement('div'); photo.className = 'photo';
    if (a.photo) { var im = document.createElement('img'); im.src = a.photo; im.alt = a.titre; photo.appendChild(im); }
    else photo.textContent = 'Pas de photo';
    carte.appendChild(photo);

    var corps = document.createElement('div'); corps.className = 'corps';
    var badge = document.createElement('span');
    badge.className = 'badge' + (a.statut === 'Vendu' ? ' vendu' : ''); badge.textContent = a.statut;
    var titre = document.createElement('div'); titre.className = 'titre'; titre.textContent = a.titre;
    var prix = document.createElement('div'); prix.className = 'prix';
    var b = document.createElement('b'); b.textContent = (a.statut === 'Vendu' ? a.vendu : a.prix) + ' €';
    prix.appendChild(b); prix.appendChild(document.createTextNode(' (achat ' + a.achat.toFixed(2) + ' €)'));
    corps.appendChild(badge); corps.appendChild(titre); corps.appendChild(prix);
    carte.appendChild(corps);

    var actions = document.createElement('div'); actions.className = 'actions';
    if (a.statut !== 'Vendu') {
      var bv = document.createElement('button'); bv.className = 'btn petit'; bv.textContent = 'Vendu';
      bv.onclick = function () { marquerVendu(a.id); }; actions.appendChild(bv);
    }
    var bs = document.createElement('button'); bs.className = 'btn petit danger'; bs.textContent = 'Suppr.';
    bs.onclick = function () { supprimer(a.id); }; actions.appendChild(bs);
    carte.appendChild(actions);
    g.appendChild(carte);
  });
}

function marquerVendu(id) {
  var d = lire();
  d.forEach(function (a) {
    if (a.id === id) {
      var p = prompt('Prix de vente réel (€) :', a.prix);
      if (p === null) return;
      var n = parseFloat(p.replace(',', '.'));
      if (isNaN(n)) return;
      a.vendu = n; a.statut = 'Vendu'; a.dateVente = Date.now();
    }
  });
  ecrire(d); afficherStock();
}

function supprimer(id) {
  if (!confirm('Supprimer cet article ?')) return;
  ecrire(lire().filter(function (a) { return a.id !== id; })); afficherStock();
}

/* ---------- Compteurs animés ---------- */
function compteur(id, cible, estEuro) {
  var el = document.getElementById(id), debut = null, duree = 900;
  el.classList.toggle('rouge', cible < 0);
  el.classList.toggle('vert', cible >= 0 && id === 'sBen');
  function pas(t) {
    if (!debut) debut = t;
    var p = Math.min((t - debut) / duree, 1), e = 1 - Math.pow(1 - p, 3);
    var val = cible * e;
    el.textContent = estEuro ? euros(val) : Math.round(val);
    if (p < 1) requestAnimationFrame(pas);
  }
  requestAnimationFrame(pas);
}

/* ---------- Tableau de bord ---------- */
function dessiner() {
  var d = lire(), enVente = 0, inv = 0, ven = 0, coutVendus = 0;
  d.forEach(function (a) {
    if (a.statut === 'Vendu') { ven += a.vendu; coutVendus += a.achat; } else { enVente++; inv += a.achat; }
  });
  compteur('sNb', enVente, false);
  compteur('sInv', inv, true);
  compteur('sVen', ven, true);
  compteur('sBen', ven - coutVendus, true);

  var mois = {}, ordre = [], now = new Date();
  for (var i = 5; i >= 0; i--) {
    var m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var cle = m.getFullYear() + '-' + (m.getMonth() + 1);
    mois[cle] = 0; ordre.push({ cle: cle, nom: m.toLocaleDateString('fr-FR', { month: 'short' }) });
  }
  d.forEach(function (a) {
    if (a.statut === 'Vendu' && a.dateVente) {
      var dt = new Date(a.dateVente), c = dt.getFullYear() + '-' + (dt.getMonth() + 1);
      if (c in mois) mois[c] += a.vendu - a.achat;
    }
  });
  barres('gMois', ordre.map(function (o) { return o.nom; }), ordre.map(function (o) { return mois[o.cle]; }), ['#6366f1', '#8b5cf6']);
  barres('gStatut', ['En vente', 'Vendus'], [enVente, d.length - enVente], ['#f59e0b', '#10b981']);

  var parMarque = {};
  d.forEach(function (a) { if (a.statut === 'Vendu') { var k = a.marque || 'Sans marque'; parMarque[k] = (parMarque[k] || 0) + (a.vendu - a.achat); } });
  var top = Object.keys(parMarque).sort(function (x, y) { return parMarque[y] - parMarque[x]; }).slice(0, 6);
  barres('gMarque', top, top.map(function (k) { return parMarque[k]; }), ['#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1']);
}

/* Graphique en barres dessiné à la main : couleurs vives, animé, adapté au thème */
function barres(id, noms, valeurs, couleurs) {
  var c = document.getElementById(id), r = window.devicePixelRatio || 1;
  var w = c.clientWidth, h = c.clientHeight;
  c.width = w * r; c.height = h * r;
  var x = c.getContext('2d');
  var texteCouleur = themeClair() ? '#0a0a0a' : '#fafafa', mute = themeClair() ? '#6f6f6f' : '#8c8c8c', trait = themeClair() ? '#e3e3df' : '#262626';
  var debut = null, duree = 800;

  function image(t) {
    if (!debut) debut = t;
    var p = Math.min((t - debut) / duree, 1), e = 1 - Math.pow(1 - p, 3);
    x.setTransform(r, 0, 0, r, 0, 0); x.clearRect(0, 0, w, h);

    if (!noms.length) {
      x.fillStyle = mute; x.font = '13px system-ui'; x.textAlign = 'center';
      x.fillText('Pas encore de données', w / 2, h / 2); return;
    }
    var max = Math.max.apply(null, valeurs.concat([1])), min = Math.min.apply(null, valeurs.concat([0]));
    var haut = 26, bas = 28, zone = h - haut - bas, plage = max - min || 1;
    var zero = haut + zone * (max / plage), pas = w / noms.length, lg = Math.min(46, pas * 0.6);
    x.strokeStyle = trait; x.beginPath(); x.moveTo(0, zero); x.lineTo(w, zero); x.stroke();

    noms.forEach(function (nom, i) {
      var val = valeurs[i], bh = Math.abs(val) / plage * zone * e, bx = i * pas + (pas - lg) / 2;
      var by = val >= 0 ? zero - bh : zero;
      var base = val < 0 ? '#ef4444' : couleurs[i % couleurs.length];
      var degrade = x.createLinearGradient(0, by, 0, by + bh);
      degrade.addColorStop(0, base); degrade.addColorStop(1, base + '66');
      x.fillStyle = degrade;
      x.beginPath();
      if (x.roundRect) x.roundRect(bx, by, lg, Math.max(bh, val ? 2 : 0), 6); else x.rect(bx, by, lg, Math.max(bh, val ? 2 : 0));
      x.fill();
      x.fillStyle = texteCouleur; x.font = '600 12px system-ui'; x.textAlign = 'center';
      x.fillText(Math.round(val * e * 100) / 100, bx + lg / 2, val >= 0 ? by - 6 : by + bh + 14);
      x.fillStyle = mute; x.font = '12px system-ui'; x.fillText(nom.length > 10 ? nom.slice(0, 9) + '.' : nom, bx + lg / 2, h - 8);
    });
    if (p < 1) requestAnimationFrame(image);
  }
  requestAnimationFrame(image);
}
window.addEventListener('resize', function () {
  if (document.getElementById('page-dash').classList.contains('actif')) dessiner();
});

/* ---------- Sauvegarde ---------- */
function exporter() {
  var blob = new Blob([JSON.stringify(lire())], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sauvegarde-vinted.json'; a.click();
}
function importer(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try { var d = JSON.parse(r.result); if (Array.isArray(d)) { ecrire(d); afficherStock(); alert('Sauvegarde restaurée.'); } }
    catch (err) { alert('Fichier invalide.'); }
  };
  r.readAsText(f);
}

/* ---------- Démarrage ---------- */
creerMenu('m-type');
creerMenu('m-statut', afficherStock);
creerMenu('m-ftype', afficherStock);
creerMenu('m-tri', afficherStock);
creerPastilles();
dessiner();