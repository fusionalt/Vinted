(() => {
  const el = id => document.getElementById('radar-' + id);
  const all = 'Toutes les marques';
  const brands = ['Ralph Lauren', 'Lacoste', 'Tommy Hilfiger', 'Nike', 'Carhartt',
    'Stüssy', 'C.P. Company', 'Arc’teryx', 'Patagonia', 'JOTT', 'Columbia', 'Stone Island', 'Levi’s'];
  const key = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {poloralphlauren:'ralphlauren', carharttwip:'carhartt'};
  const brandKey = value => aliases[key(value)] || key(value);
  const money = new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'});
  const date = new Intl.DateTimeFormat('fr-FR', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
  let source = localStorage.getItem('fusiona-radar-url') || '';
  let channel = all, listings = [], request, timer, active = false;
  const element = (tag, text) => {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  };
  function https(value) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password) return url;
    } catch {}
    return null;
  }
  function normalize(raw) {
    if (!raw || typeof raw.title !== 'string' || typeof raw.brand !== 'string') return null;
    const link = https(raw.url);
    if (!link || !/^(www\.)?vinted\.fr$/.test(link.hostname) || !/^\/items\/\d+/.test(link.pathname)) return null;
    const when = Date.parse(raw.published_at);
    if (!Number.isFinite(when) || !Number.isFinite(raw.price) || raw.price < 0 || (raw.currency && raw.currency !== 'EUR')) return null;
    const reference = Number.isFinite(raw.reference_price) && raw.reference_price > 0 ? raw.reference_price : null;
    return {title:raw.title, brand:raw.brand, size:raw.size, condition:raw.condition, price:raw.price,
      total:Number.isFinite(raw.price_including_fees) && raw.price_including_fees >= raw.price ? raw.price_including_fees : null,
      reference, discount:reference === null ? null : (1 - raw.price/reference)*100,
      link:link.href, id:link.pathname.match(/^\/items\/(\d+)/)[1], image:https(raw.photo_url)?.href, when};
  }
  function showBrands() {
    const names = new Map(brands.map(name => [brandKey(name), name]));
    for (const item of listings) if (!names.has(brandKey(item.brand))) names.set(brandKey(item.brand), item.brand);
    if (channel !== all && !names.has(brandKey(channel))) names.set(brandKey(channel),channel);
    el('brands').replaceChildren(...[all, ...names.values()].map(name => {
      const button = element('button', name);
      button.className = 'chip' + (channel === name ? ' on' : '');
      button.setAttribute('aria-pressed', String(channel === name));
      button.onclick = () => { channel = name; showBrands(); render(); };
      return button;
    }));
  }
  function card(item) {
    const article = document.createElement('article');
    article.className = 'card radar-listing';
    if (item.example) {
      article.classList.add('radar-example');
      article.append(element('small','Exemple de ta capture'));
    } else if (item.image) {
      const img = new Image();
      img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.src = item.image;
      article.append(img);
    }
    const details = document.createElement('div');
    details.className='listing-overlay';
    const price=element('div','');
    price.append(element('strong', money.format(item.price)));
    if(item.total != null) price.append(element('small',' '+money.format(item.total)+' frais inclus'));
    if (item.reference) {
      const below = item.discount > 0 ? ' · ' + Math.floor(item.discount + 1e-9) + ' % sous la référence' : '';
      details.append(element('p', 'Référence du flux ' + money.format(item.reference) + below));
    }
    if(!item.example) details.append(element('small','Publié le '+date.format(item.when)));
    const tags=element('div',''); tags.className='listing-tags';
    tags.append(...[item.brand,item.size,item.condition].filter(Boolean).map(t=>element('span',t)));
    details.append(element('h3',item.title),price,tags);
    if(item.link){
      const link=element('a','↗');
      link.setAttribute('aria-label','Ouvrir '+item.title+' sur Vinted');
      link.title='Ouvrir sur Vinted'; link.href=item.link; link.target='_blank'; link.rel='noopener noreferrer'; details.append(link);
    }
    article.append(details);
    return article;
  }
  function render() {
    const maximum = el('cap').valueAsNumber, discount = Number(el('discount').value);
    const url = new URL('https://www.vinted.fr/catalog');
    url.searchParams.set('order','newest_first');
    if (channel !== all) url.searchParams.set('search_text', channel);
    if (Number.isFinite(maximum) && maximum >= 0) url.searchParams.set('price_to', maximum);
    el('search').href = url.href; el('title').textContent = channel;
    const pool=source ? listings : [{example:true,title:'Pull à col zippé',brand:'Ralph Lauren',size:'XL',condition:'Très bon état',price:30,discount:null}];
    const items = pool.filter(item => (channel === all || brandKey(item.brand) === brandKey(channel))
      && (!Number.isFinite(maximum) || item.price <= maximum)
      && (!discount || (item.discount !== null && item.discount + 1e-9 >= discount)));
    el('feed').replaceChildren(...items.map(card));
    if (source && listings.length && !items.length) el('feed').append(element('p','Aucune annonce ne correspond à ces filtres.'));
  }
  function stop() {
    clearTimeout(timer);
    request?.abort(); request = null;
  }
  async function refresh() {
    stop();
    if (!active || document.hidden) return;
    if (!source) { el('status').textContent = 'Aucun flux connecté. Tu peux déjà ouvrir la recherche Vinted de chaque marque.'; return; }
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    el('status').textContent = 'Actualisation du flux…';
    try {
      const response = await fetch(source,{signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
      if (!response.ok) throw Error();
      const data = await response.json();
      if (request !== controller) return;
      const rows = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(rows)) throw Error();
      const unique = new Map();
      let skipped = 0;
      for (const row of rows) {
        const item = normalize(row);
        if (item) unique.set(item.id,item); else skipped++;
      }
      listings = [...unique.values()].sort((a,b) => b.when - a.when);
      el('status').textContent = 'Relevé à ' + new Date().toLocaleTimeString('fr-FR') + ' · ' + listings.length + ' annonce(s)'
        + (skipped ? ' · ' + skipped + ' ligne(s) au format incompatible' : '') + ' · actualisation toutes les 30 s.';
      showBrands(); render();
    } catch {
      if (request === controller) el('status').textContent = 'Actualisation impossible. Vérifie l’URL, le format JSON et l’accès depuis ce site.' + (listings.length ? ' Dernier relevé affiché.' : '');
    } finally {
      clearTimeout(timeout);
      if (request === controller) { request = null; timer = setTimeout(refresh,30000); }
    }
  }
  el('url').value = source;
  el('config').onsubmit = event => {
    event.preventDefault();
    const value = el('url').value.trim();
    if (value && !https(value)) { el('status').textContent = 'Indique une URL HTTPS publique.'; return; }
    source = value; localStorage.setItem('fusiona-radar-url',source);
    listings = []; channel = all; showBrands(); render(); refresh();
  };
  el('cap').oninput = render; el('discount').onchange = render;
  const button = element('button','Radar Vinted');
  button.id = 'n-radar'; button.onclick = () => go('radar');
  document.querySelector('nav').append(button);
  const previousGo = go;
  go = function(page) {
    previousGo(page);
    active = page === 'radar';
    document.getElementById('p-radar').classList.toggle('on',active);
    button.classList.toggle('on',active);
    if (active) { showBrands(); render(); refresh(); } else stop();
  };
  document.addEventListener('visibilitychange',refresh);
})();
