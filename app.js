const K='fusiona-v3',CATS=['Vêtements','Chaussures','Électronique','Accessoires','Autres'],ETATS=['Neuf avec étiquette','Neuf sans étiquette','Très bon état','Bon état','Satisfaisant'],COL=['#417ed4','#10b981','#f59e0b','#bf7742','#06b6d4'];
const $=i=>document.getElementById(i),eur=n=>(Math.round(n*100)/100).toFixed(2).replace('.',',')+' €',up=s=>s.charAt(0).toUpperCase()+s.slice(1);
const S={cat:'Tous',st:'Tous',tri:'Plus récents',vue:'Cartes',per:'6 mois',edit:null,photos:[],fc:CATS[0],fe:ETATS[1],busy:false};

/* ---- Couche données : seul ce bloc changera quand on branchera les comptes ---- */
const workspaceNames=['Gatien','Jules'];
let teamMember=workspaceNames.includes(localStorage.getItem('fusiona-espace'))?localStorage.getItem('fusiona-espace'):'';
function inWorkspace(row){return !teamMember || row.member===teamMember;}
function workspaceStock(){return Store.all().filter(inWorkspace);}
function budgetKey(key){return teamMember ? key+'_'+teamMember : key;}
function budgetOption(key){return BUD[budgetKey(key)] ?? (key==='ventes'?true:0);}
function setArticleOwner(member){const field=$('article-member');field.value=teamMember || member || '';field.disabled=!!teamMember;}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let forceMotion=localStorage.getItem('fusiona-anim')==='on';
let counterSound=localStorage.getItem('fusiona-counter-sound')==='on';
let audioContext=null, lastTone=-Infinity, counterFrame=0, finishCounters=null;
const dataAnimations=new Set();
function stopCounters(){
  for(const animation of dataAnimations)animation.cancel();
  dataAnimations.clear();
  cancelAnimationFrame(counterFrame);
  if(finishCounters) finishCounters();
  finishCounters=null;
}
function updateControls(){
  const root=document.documentElement;
  root.dataset.anim=forceMotion?'on':'';
  root.dataset.motion=(forceMotion || !reducedMotion.matches)?'on':'off';
  $('motion-toggle').setAttribute('aria-pressed',String(forceMotion));
  $('motion-toggle').title=forceMotion?'Animations forcées · revenir au réglage système':'Forcer les animations sur cet appareil';
  $('sound-toggle').setAttribute('aria-pressed',String(counterSound));
  $('sound-toggle').title=counterSound?'Couper le son des compteurs':'Activer le son discret des compteurs';
  if(root.dataset.motion==='off') stopCounters();
}
function prepareSound(){
  if(!counterSound || document.hidden || document.documentElement.dataset.motion!=='on')return;
  try{
    const Audio=window.AudioContext || window.webkitAudioContext;
    if(!Audio)return;
    audioContext ||= new Audio();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  }catch{}
}
function playCounterTone(){
  if(!counterSound || document.hidden || audioContext?.state!=='running' || performance.now()-lastTone<4000)return;
  lastTone=performance.now();
  const t=audioContext.currentTime, tone=audioContext.createOscillator(), gain=audioContext.createGain();
  tone.type='sine'; tone.frequency.setValueAtTime(550,t); tone.frequency.exponentialRampToValueAtTime(660,t+.09);
  gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(.025,t+.016);
  gain.gain.exponentialRampToValueAtTime(.0001,t+.13);
  tone.connect(gain);gain.connect(audioContext.destination);tone.onended=()=>{tone.disconnect();gain.disconnect();};
  tone.start(t);tone.stop(t+.14);
}
function animateData(page){
  stopCounters();
  if(document.documentElement.dataset.motion!=='on' || document.hidden)return;
  const panel=$('p-'+page);
  if(!panel?.classList.contains('on'))return;
  function play(node,frames,duration){
    if(!node.animate)return;
    const animation=node.animate(frames,{duration:duration*2,easing:'cubic-bezier(.2,.7,.25,1)'});
    dataAnimations.add(animation);
    animation.onfinish=()=>dataAnimations.delete(animation);
  }
  for(const line of panel.querySelectorAll('svg polyline')){
    if(line.classList.contains('chart-previous')){
      play(line,[{opacity:0},{opacity:1}],440);
      continue;
    }
    const length=line.getTotalLength();
    if(length>0)play(line,[{strokeDasharray:String(length),strokeDashoffset:String(length)},{strokeDasharray:String(length),strokeDashoffset:'0'}],590);
  }
  for(const node of panel.querySelectorAll('#c-mois circle,#hour-chart circle')){
    play(node,[{opacity:0},{opacity:0,offset:.6},{opacity:1}],590);
  }
  for(const node of panel.querySelectorAll('.status-track,.bar i,#obj-b,#c-mois rect')){
    const vertical=node.tagName.toLowerCase()==='rect';
    play(node,[{transform:vertical?'scaleY(0)':'scaleX(0)'},{transform:vertical?'scaleY(1)':'scaleX(1)'}],500);
  }
  if(page==='watch') {
    for(const row of [...panel.querySelectorAll('#watch-list tbody tr')].slice(0,12)) {
      play(row,[{opacity:.35},{opacity:1}],480);
    }
  }
  const elements=[...panel.querySelectorAll('#watch-balance,#volume-total,#kpis .kpi b,.big,#team-total,#preview-price,#preview-cost,#preview-profit,#v-out .sum b,#t-out .pr b,.pc>b,.t2 td.r')].slice(0,40);
  const counters=elements.flatMap(node=>{
    const label=node.textContent, match=label.match(/^(-?\d+)(,\d+)?( €| %| j)$/);
    if(!match)return [];
    const number=Number((match[1]+(match[2]||'')).replace(',','.'));
    return number?[{node,label,last:label,number,digits:(match[2]?.length||1)-1,unit:match[3]}]:[];
  });
  if(!counters.length)return;
  if(page==='dash')prepareSound();
  finishCounters=()=>counters.forEach(c=>{if(c.node.textContent===c.last)c.node.textContent=c.label;});
  const start=performance.now();
  function draw(now){
    const p=Math.min(1,(now-start)/1050), fraction=1-(1-p)**3;
    for(const c of counters){
      if(!c.node.isConnected || c.node.textContent!==c.last)continue;
      c.last=(c.number*fraction).toFixed(c.digits).replace('.',',')+c.unit;
      c.node.textContent=c.last;
    }
    if(p<1)counterFrame=requestAnimationFrame(draw);
    else {finishCounters();finishCounters=null;counterFrame=0;if(page==='dash')playCounterTone();}
  }
  counterFrame=requestAnimationFrame(draw);
}
$('motion-toggle').onclick=()=>{
  forceMotion=!forceMotion;localStorage.setItem('fusiona-anim',forceMotion?'on':'off');updateControls();
  toast(forceMotion?'Animations forcées':'Animations selon le réglage système');
  if(forceMotion)animateData(document.body.dataset.pg);
};
$('sound-toggle').onclick=()=>{
  counterSound=!counterSound;localStorage.setItem('fusiona-counter-sound',counterSound?'on':'off');updateControls();
  prepareSound();toast(counterSound?'Son discret activé':'Son coupé');
};
reducedMotion.addEventListener('change',updateControls);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCounters();});
updateControls();

const Store={
 all(){try{let d=JSON.parse(localStorage.getItem(K));if(d)return d;d=JSON.parse(localStorage.getItem('vinted-stock-v2')||'[]').map(a=>({id:a.id,nom:a.titre,marque:a.marque||'',taille:'',couleur:'',details:'',cat:a.type==='Chaussures'?'Chaussures':'Vêtements',etat:'',achat:a.achat,frais:0,prix:a.prix,photos:a.photo?[a.photo]:[],statut:a.statut,vendu:a.vendu,ajout:a.dateAjout||a.id,vente:a.dateVente}));this.set(d);return d}catch(e){return[]}},
 set(d){try{localStorage.setItem(K,JSON.stringify(d));return true}catch(e){toast('Espace plein : supprime des photos');return false}}
};
const titre=a=>[up(a.nom),a.marque,a.couleur,a.taille?'taille '+a.taille:'',a.etat?'- '+a.etat:''].filter(Boolean).join(' ');
const cout=a=>a.achat+(a.frais||0);

function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2200)}
function theme(){const c=document.documentElement.dataset.theme==='clair';c?delete document.documentElement.dataset.theme:document.documentElement.dataset.theme='clair';localStorage.setItem('fusiona-theme',c?'sombre':'clair');dash()}
function chips(id,opts,get,set){const z=$(id);z.innerHTML='';opts.forEach(o=>{const b=document.createElement('button');b.type='button';b.className='chip'+(get()===o?' on':'');b.textContent=o;b.onclick=()=>{[...z.children].forEach(c=>c.classList.toggle('on',c===b));set(o)};z.appendChild(b)})}
function go(p){['dash','new','stock'].forEach(x=>{$('p-'+x).classList.toggle('on',x===p);$('n-'+x).classList.toggle('on',x===p)});if(p==='dash')dash();if(p==='stock')stock();if(p==='new')previewArticle();scrollTo({top:0,behavior:'instant'})}

/* ---- Formulaire ---- */
function num(i){const v=parseFloat($(i).value);return isNaN(v)?null:v}
function calc(src){const a=num('achat'),f=num('frais')||0;if(a!==null){const c=a+f;if(src==='marge'||src==='achat'){const m=num('marge');if(m!==null)$('prix').value=Math.round(c*(1+m/100)*100)/100}else if(src==='prix'&&c>0){const p=num('prix');if(p!==null)$('marge').value=Math.round((p/c-1)*1000)/10}}
 const c=(a||0)+f,p=num('prix')||0,b=p-c;$('sum').innerHTML=`<div>Coût total<b>${eur(c)}</b></div><div>Prix de vente<b>${eur(p)}</b></div><div>Bénéfice<b class="${b>=0?'ok':'bad'}">${eur(b)}</b></div><div>Marge sur coût<b>${c?Math.round(b/c*100):0} %</b></div><div>Taux de marque<b>${p?Math.round(b/p*100):0} %</b></div><div>Rentabilité<b>${b>0?'Bonne':b===0?'Nulle':'Négative'}</b></div>`}
function formCats(){chips('f-cat',CATS,()=>S.fc,v=>S.fc=v);chips('f-etat',ETATS,()=>S.fe,v=>S.fe=v)}
function thumbs(){$('th').innerHTML='';S.photos.forEach((p,i)=>{const d=document.createElement('div');d.innerHTML='<img alt=""><button type="button" aria-label="Supprimer">×</button>';d.querySelector('img').src=p;d.querySelector('button').onclick=()=>{S.photos.splice(i,1);thumbs()};$('th').appendChild(d)});previewArticle()}
function addFiles(fs){[...fs].filter(f=>f.type.startsWith('image/')).forEach(f=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,600/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);S.photos.push(c.toDataURL('image/jpeg',.72));thumbs()};im.src=r.result};r.readAsDataURL(f)})}
const dz=$('drop');dz.onclick=()=>$('file').click();$('file').onchange=e=>{addFiles(e.target.files);e.target.value=''};
['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('ov')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('ov')}));dz.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
function valid(){if(num('frais')<0){toast('Les frais doivent être positifs ou nuls.');$('frais').focus();return false;}let ok=true;[['nom','Indique l\'article'],['marque','Indique la marque'],['achat','Prix d\'achat requis']].forEach(([i,m])=>{const bad=i==='achat'?num(i)===null||num(i)<0:!$(i).value.trim();$(i).classList.toggle('err',bad);$('e-'+i).textContent=bad?m:'';if(bad)ok=false});if(!(num('prix')>0)){toast('Indique un prix voulu ou une marge');ok=false}return ok}
function read(){return{member:teamMember || $('article-member').value,nom:$('nom').value.trim(),marque:$('marque').value.trim(),taille:$('taille').value.trim(),couleur:$('couleur').value.trim(),details:$('details').value.trim(),location:$('storage-place').value.trim(),cat:S.fc,etat:S.fe,achat:num('achat'),frais:num('frais')||0,prix:num('prix'),photos:S.photos.slice()}}
function uniqueArticleId(){let id=Date.now();const used=new Set(Store.all().map(a=>a.id));while(used.has(id))id++;return id;}
function applyArticleStatus(item,status){
  if(item.statut==='Vendu') return;
  if(status==='Réservé' && item.statut!=='Réservé') item.reserve=Date.now();
  if(status!=='Réservé') item.reserve=null;
  item.statut=status;
}
function save(){if(S.busy||!valid())return;S.busy=true;$('save').disabled=true;const d=Store.all(),v=read();let ok;if(S.edit){const i=d.findIndex(a=>a.id===S.edit);if(i<0){S.busy=false;$('save').disabled=false;toast('Cet article a été supprimé.');return;}applyArticleStatus(d[i],$('article-status').value);d[i]=Object.assign(d[i],v);ok=Store.set(d)}else{const item={id:uniqueArticleId(),vendu:null,ajout:Date.now(),vente:null,...v};applyArticleStatus(item,$('article-status').value);d.push(item);ok=Store.set(d)}
 S.busy=false;$('save').disabled=false;if(!ok)return;toast(S.edit?'Modifications enregistrées':'Article ajouté');reset();go('stock')}
function reset(){$('article-status').value='En vente';$('article-status').disabled=false;setArticleOwner('');$('storage-place').value='';S.edit=null;S.photos=[];S.fc=CATS[0];S.fe=ETATS[1];['nom','marque','taille','couleur','details','achat','prix'].forEach(i=>{$(i).value='';$(i).classList.remove('err')});$('frais').value=0;$('marge').value=100;$('out').style.display='none';$('f-titre').textContent='Nouvel article';$('save').textContent='Enregistrer dans mon stock';formCats();thumbs();calc('achat')}
function edit(id){const a=Store.all().find(x=>x.id===id);if(!a)return;reset();$('article-status').value=a.statut;$('article-status').disabled=a.statut==='Vendu';setArticleOwner(a.member);$('storage-place').value=a.location||'';S.edit=id;['nom','marque','taille','couleur','details'].forEach(i=>$(i).value=a[i]||'');$('achat').value=a.achat;$('frais').value=a.frais||0;$('prix').value=a.prix;S.fc=a.cat;S.fe=a.etat||ETATS[1];S.photos=(a.photos||[]).slice();$('f-titre').textContent='Modifier l\'article';$('save').textContent='Enregistrer les modifications';formCats();thumbs();calc('prix');go('new')}
function gen(){const v=read();if(!v.nom||!v.marque){valid();return}const L=[up(v.nom)+' '+v.marque+(v.couleur?' de couleur '+v.couleur:'')+(v.taille?', taille '+v.taille:'')+'.','État : '+v.etat.toLowerCase()+'.'];if(v.details)L.push(up(v.details)+(/[.!?]$/.test(v.details)?'':'.'));L.push('','Envoi rapide et soigné. N\'hésitez pas à poser vos questions ou à regrouper plusieurs articles pour économiser les frais de port !');$('o-t').textContent=titre(v);$('o-d').textContent=L.join('\n');$('o-l').href='https://www.vinted.fr/catalog?search_text='+encodeURIComponent([v.marque,v.nom,v.taille].join(' '));$('out').style.display='block'}
async function cp(id,b){try{await navigator.clipboard.writeText($(id).textContent);toast('Texte copié');}catch{const range=document.createRange();range.selectNodeContents($(id));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);toast('Texte sélectionné pour la copie');}}

/* ---- Stock ---- */
function stock(){let d=Store.all();const q=$('q').value.toLowerCase();d=d.filter(a=>(!q||(titre(a)+' '+a.cat).toLowerCase().includes(q))&&(S.st==='Tous'||a.statut===S.st)&&(S.cat==='Tous'||a.cat===S.cat));
 const pf=a=>a.prix-cout(a),T={'Plus récents':(a,b)=>b.ajout-a.ajout,'Prix croissant':(a,b)=>a.prix-b.prix,'Prix décroissant':(a,b)=>b.prix-a.prix,'Rentabilité':(a,b)=>pf(b)-pf(a),'Nom':(a,b)=>titre(a).localeCompare(titre(b))};d.sort(T[S.tri]);
 $('cnt').textContent='· '+d.length+(d.length>1?' articles':' article');const z=$('liste');z.innerHTML='';if(!d.length){z.innerHTML='<div class="vide card">Aucun article ne correspond.</div>';return}
 const act=a=>`${a.statut!=='Vendu'?`<button class="btn p" onclick="sell(${a.id})">Vendu</button>`:''}<button class="btn s p" onclick="edit(${a.id})">Modifier</button><button class="btn d p" onclick="del(${a.id})">Suppr.</button>`;
 if(S.vue==='Tableau'){z.innerHTML='<div class="card" style="overflow:auto"><table><thead><tr><th>Article</th><th>Cat.</th><th>Achat</th><th>Prix</th><th>Bénéf.</th><th>Statut</th><th></th></tr></thead><tbody>'+d.map(a=>`<tr><td></td><td>${a.cat}</td><td>${eur(cout(a))}</td><td>${eur(a.statut==='Vendu'?a.vendu:a.prix)}</td><td>${eur((a.statut==='Vendu'?a.vendu:a.prix)-cout(a))}</td><td>${a.statut}</td><td>${act(a)}</td></tr>`).join('')+'</tbody></table></div>';[...z.querySelectorAll('tbody tr')].forEach((r,i)=>r.firstChild.textContent=titre(d[i]));return}
 const g=document.createElement('div');g.className='gr';d.forEach((a,i)=>{const p=a.statut==='Vendu'?a.vendu:a.prix,c=document.createElement('div');c.className='it';c.style.animationDelay=Math.min(i*40,400)+'ms';c.innerHTML=`<div class="ph"></div><div class="bd"><span class="bg ${a.statut==='Vendu'?'v':''}">${a.statut}</span><span class="bg">${a.cat}</span><p></p><div class="pr"><b>${eur(p)}</b> · achat ${eur(cout(a))}</div><div class="pr" style="margin:6px 0 10px">Bénéfice ${eur(p-cout(a))} · ${cout(a)?Math.round((p/cout(a)-1)*100):0} %</div>${act(a)}</div>`;c.querySelector('p').textContent=titre(a);const ph=c.querySelector('.ph');if(a.photos&&a.photos[0]){const im=new Image();im.src=a.photos[0];im.alt='';ph.appendChild(im)}else ph.textContent='Pas de photo';g.appendChild(c)});z.appendChild(g)}
function sell(id){ openSale(id); }
function previewArticle(){
  const item=read(), cost=(item.achat||0)+item.frais, profit=(item.prix||0)-cost;
  $('preview-name').textContent=item.nom?up(item.nom):'Ton article';
  $('preview-brand').textContent=item.marque || '';
  $('preview-meta').textContent=[item.taille,item.couleur,item.etat].filter(Boolean).join(' · ');
  $('preview-price').textContent=item.prix===null?'—':eur(item.prix);
  $('preview-cost').textContent=item.achat===null?'—':eur(cost);
  const known=item.prix!==null && item.achat!==null;
  $('preview-profit').textContent=known?eur(profit):'—';
  $('preview-profit').className=known?(profit<0?'bad':'ok'):'';
  const image=$('preview-image'), source=item.photos[0];
  if(source && image.getAttribute('src')!==source) image.src=source;
  if(!source) image.removeAttribute('src');
  image.hidden=!source; $('preview-empty').hidden=!!source;
}
$('p-new').addEventListener('input',previewArticle);
$('p-new').addEventListener('click',previewArticle);
function openSale(id){
  const item=Store.all().find(a=>a.id===id);
  if(!item || item.statut==='Vendu') return;
  const dialog=$('sale-dialog'), price=$('sale-price');
  $('sale-name').textContent=nm(item);
  $('sale-cost').textContent=eur(cout(item));
  price.value=item.prix;
  function showProfit(){
    const profit=price.valueAsNumber-cout(item);
    $('sale-profit').textContent=Number.isFinite(profit)?eur(profit):'—';
    $('sale-profit').className=profit<0?'bad':'ok';
  }
  price.oninput=showProfit; showProfit();
  $('sale-form').onsubmit=event=>{
    event.preventDefault();
    const data=Store.all(), current=data.find(a=>a.id===id), amount=price.valueAsNumber;
    if(!current || current.statut==='Vendu'){dialog.close();stock();toast('Le stock a changé.');return;}
    if(!Number.isFinite(amount)||amount<0)return;
    if(!Store.set(data.map(a=>a.id===id?{...a,statut:'Vendu',vendu:amount,vente:Date.now()}:a)))return;
    dialog.close();stock();toast('Vente enregistrée');
  };
  dialog.showModal();price.focus();price.select();
}
function del(id){if(!confirm('Supprimer cet article ?'))return;Store.set(Store.all().filter(a=>a.id!==id));toast('Article supprimé');stock()}
function exp(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(workspaceStock())],{type:'application/json'}));a.download='sauvegarde-fusiona.json';a.click()}
async function imp(event){
  if(teamMember){toast('Ouvre En commun pour restaurer la sauvegarde du stock.');event.target.value='';return;}
  const input=event.target, file=input.files[0];
  if(!file)return;
  input.value='';
  try{
    const articles=JSON.parse(await file.text()), ids=new Set();
    if(!Array.isArray(articles))throw Error();
    for(const item of articles){
      if(!item || !Number.isSafeInteger(item.id) || ids.has(item.id) ||
        typeof item.nom!=='string' || !item.nom.trim() || !Number.isFinite(item.prix) ||
        !Number.isFinite(item.achat) || !CATS.includes(item.cat) ||
        !['En stock','En vente','Réservé','Vendu'].includes(item.statut) ||
        (item.statut==='Vendu' && !Number.isFinite(item.vendu))) throw Error();
      for(const field of ['marque','couleur','taille','etat','source','details','location']){
        if(item[field]!=null && typeof item[field]!=='string')throw Error();
      }
      if(item.photos!=null && (!Array.isArray(item.photos)||item.photos.some(p=>typeof p!=='string')))throw Error();
      ids.add(item.id);
    }
    if(!confirm('Remplacer les '+Store.all().length+' articles du stock par les '+articles.length+' articles de cette sauvegarde ?'))return;
    if(Store.set(articles)){stock();dash();toast('Stock restauré');}
  }catch{toast('Sauvegarde incompatible. Le stock est intact.');}
}

/* ---- Tableau de bord ---- */
function hbars(id,rows){const z=$(id),m=Math.max(1,...rows.map(r=>Math.abs(r[1])));z.innerHTML=rows.length?rows.map((r,i)=>`<div class="hb"><span>${esc(r[0])}</span><div><i style="width:0;background:${r[1]<0?'var(--bad)':COL[i%5]}" data-w="${Math.abs(r[1])/m*100}"></i></div><b>${r[2]}</b></div>`).join(''):'<div class="vide">Pas encore de données</div>';requestAnimationFrame(()=>requestAnimationFrame(()=>z.querySelectorAll('i').forEach(i=>i.style.width=i.dataset.w+'%')))}
function dash(){stopCounters();const d=workspaceStock(),V=d.filter(a=>a.statut==='Vendu'),E=d.filter(a=>a.statut!=='Vendu'),sum=(x,f)=>x.reduce((s,a)=>s+f(a),0);
 const ca=sum(V,a=>a.vendu),ben=ca-sum(V,a=>cout(a)),vs=sum(E,a=>cout(a)),vp=sum(E,a=>a.prix),mm=V.length?Math.round(sum(V,a=>a.vendu/cout(a)-1)/V.length*100):0,dur=V.length?Math.round(sum(V,a=>(a.vente-a.ajout)/864e5)/V.length):0;
 const K2=[['Chiffre d\'affaires',eur(ca),''],['Bénéfice net',eur(ben),ben<0?'bad':'ok'],['Valeur du stock (achat)',eur(vs),''],['Valeur potentielle',eur(vp),''],['En stock / vendus',E.length+' / '+V.length,''],['Marge moyenne',mm+' %',''],['Rentabilité',ca?Math.round(ben/sum(V,a=>cout(a))*100)+' %':'0 %',''],['Durée moyenne de stockage',dur+' j','']];
 $('kpis').innerHTML=K2.map((k,i)=>`<div class="card kpi ${''}" style="animation-delay:${i*60}ms"><small>${k[0]}</small><b class="${k[2]}">${k[1]}</b></div>`).join('');
 chips('per',['6 mois','12 mois'],()=>S.per,v=>{S.per=v;dash()});
 const n=S.per==='6 mois'?6:12,now=new Date(),M=[];for(let i=n-1;i>=0;i--){const m=new Date(now.getFullYear(),now.getMonth()-i,1);M.push({k:m.getFullYear()*12+m.getMonth(),l:m.toLocaleDateString('fr-FR',{month:'short'}),ca:0,b:0})}
 V.forEach(a=>{const dt=new Date(a.vente),k=dt.getFullYear()*12+dt.getMonth(),m=M.find(x=>x.k===k);if(m){m.ca+=a.vendu;m.b+=a.vendu-cout(a)}});
 const W=720,H=240,mx=Math.max(1,...M.map(m=>m.ca)),bw=W/M.length;let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Ventes et bénéfices par mois">`;M.forEach((m,i)=>{const x=i*bw+bw*.12,w=bw*.34,h1=m.ca/mx*(H-40),h2=Math.max(0,m.b)/mx*(H-40);s+=`<rect x="${x}" y="${H-24-h1}" width="${w}" height="${h1}" rx="4" fill="#417ed4"><title>${m.l} : ventes ${eur(m.ca)}</title></rect><rect x="${x+w+3}" y="${H-24-h2}" width="${w}" height="${h2}" rx="4" fill="#10b981"><title>${m.l} : bénéfice ${eur(m.b)}</title></rect><text x="${x+w}" y="${H-6}" text-anchor="middle">${m.l}</text>`});$('c-mois').innerHTML=s+'</svg><div class="pr"><span style="color:#417ed4">■</span> Ventes &nbsp; <span style="color:#10b981">■</span> Bénéfice</div>';
 hbars('c-rep',CATS.map(c=>[c,E.filter(a=>a.cat===c).length,E.filter(a=>a.cat===c).length]).filter(r=>r[1]));
 hbars('c-ren',CATS.map(c=>{const x=V.filter(a=>a.cat===c),b=sum(x,a=>a.vendu-cout(a));return[c,b,eur(b),x.length]}).filter(r=>r[3]));
 const top=V.slice().sort((a,b)=>(b.vendu-cout(b))-(a.vendu-cout(a))).slice(0,5);$('c-top').innerHTML='';if(!top.length)$('c-top').innerHTML='<div class="vide">Aucune vente enregistrée</div>';else top.forEach((a,i)=>{const r=document.createElement('div');r.className='hb';r.style.gridTemplateColumns='24px 1fr 80px';r.innerHTML='<span>'+(i+1)+'</span><span></span><b class="ok">'+eur(a.vendu-cout(a))+'</b>';r.children[1].textContent=titre(a);$('c-top').appendChild(r)})}

/* ---- Démarrage ---- */
chips('f-st',['Tous','En vente','Vendu'],()=>S.st,v=>{S.st=v;stock()});chips('f-c',['Tous',...CATS],()=>S.cat,v=>{S.cat=v;stock()});chips('f-tri',['Plus récents','Prix croissant','Prix décroissant','Rentabilité','Nom'],()=>S.tri,v=>{S.tri=v;stock()});chips('vue',['Cartes','Tableau'],()=>S.vue,v=>{S.vue=v;stock()});
formCats();calc('achat');dash();

/* ---- Nouveautés : réservé, source, modèles, objectif, alertes, marques, duplication, CSV ---- */
const DORM=30,TPL0=`{article} {marque} {couleur} {taille}.
État : {etat}.
{details}

Envoi rapide et soigné. N'hésitez pas à poser vos questions ou à regrouper plusieurs articles pour économiser les frais de port !`;
const _read=read;read=function(){return Object.assign(_read(),{source:$('source').value.trim()})};
const _reset=reset;reset=function(){_reset();$('source').value=''};
const _edit=edit;edit=function(id){_edit(id);const a=Store.all().find(x=>x.id===id);$('source').value=(a&&a.source)||''};
function dup(id){edit(id);S.edit=null;$('article-status').value='En vente';$('article-status').disabled=false;$('f-titre').textContent='Nouvel article (copie)';$('save').textContent='Enregistrer dans mon stock'}
function res(id){const d=Store.all(),a=d.find(x=>x.id===id);a.statut=a.statut==='Réservé'?'En vente':'Réservé';Store.set(d);toast(a.statut==='Réservé'?'Article réservé':'Remis en vente');stock()}
gen=function(){const v=read();if(!v.nom||!v.marque){valid();return}const m={article:up(v.nom),marque:v.marque,couleur:v.couleur?'de couleur '+v.couleur:'',taille:v.taille?'taille '+v.taille:'',etat:v.etat.toLowerCase(),details:v.details?up(v.details)+(/[.!?]$/.test(v.details)?'':'.'):''};const d=($('tpl').value||TPL0).replace(/\{(\w+)\}/g,(x,k)=>m[k]!==undefined?m[k]:x).replace(/ +/g,' ').replace(/ \./g,'.').replace(/\n +/g,'\n').replace(/\n{3,}/g,'\n\n').trim();$('o-t').textContent=titre(v);$('o-d').textContent=d;$('o-l').href='https://www.vinted.fr/catalog?search_text='+encodeURIComponent([v.marque,v.nom,v.taille].join(' '));$('out').style.display='block'};
$('tpl').value=localStorage.getItem('fusiona-tpl')||TPL0;$('tpl').oninput=()=>localStorage.setItem('fusiona-tpl',$('tpl').value);$('tpl-r').onclick=()=>{$('tpl').value=TPL0;localStorage.removeItem('fusiona-tpl')};
chips('f-st',['Tous','En stock','En vente','Réservé','Vendu'],()=>S.st,v=>{S.st=v;stock()});
const _stk=stock;stock=function(){_stk();const D=Store.all();document.querySelectorAll('#liste .it,#liste tbody tr').forEach(el=>{const e=el.querySelector('button[onclick^="edit("]');if(!e)return;const id=+e.getAttribute('onclick').match(/\d+/)[0],a=D.find(x=>x.id===id);if(!a)return;const add=(t,f)=>{const b=document.createElement('button');b.className='btn s p';b.textContent=t;b.onclick=f;e.parentNode.insertBefore(b,e)};if(a.statut!=='Vendu')add(a.statut==='Réservé'?'Dispo':'Réserver',()=>res(id));add('Dupliquer',()=>dup(id));const age=Math.floor((Date.now()-a.ajout)/864e5),bd=el.querySelector('.bg');if(a.statut==='En vente'&&age>=DORM&&bd){const z=document.createElement('span');z.className='bg';z.textContent='Dort '+age+' j';bd.after(z)}})};
const _d2=dash;dash=function(){_d2();const d=workspaceStock(),V=d.filter(a=>a.statut==='Vendu'),grp=f=>{const m={};V.forEach(a=>{const k=f(a)||'Non précisé';m[k]=(m[k]||0)+a.vendu-cout(a)});return Object.entries(m).sort((x,y)=>y[1]-x[1]).slice(0,6).map(([k,b])=>[k,b,eur(b)])};
 hbars('c-marque',grp(a=>a.marque));hbars('c-src',grp(a=>a.source));overview(d);
 const o=+localStorage.getItem(budgetKey('fusiona-obj'))||0,nw=new Date(),mp=V.filter(a=>{const x=new Date(a.vente);return x.getMonth()===nw.getMonth()&&x.getFullYear()===nw.getFullYear()}).reduce((s,a)=>s+a.vendu-cout(a),0);$('obj').value=o||'';$('obj-b').style.width=o?Math.max(0,Math.min(100,mp/o*100))+'%':'0%';$('obj-t').textContent=o?eur(mp)+' sur '+eur(o)+' ('+Math.round(mp/o*100)+' %)':'Définis un objectif pour suivre ta progression';
 const z=$('c-dorm'),L=d.filter(a=>a.statut==='En vente'&&(Date.now()-a.ajout)/864e5>=DORM).sort((a,b)=>a.ajout-b.ajout).slice(0,5);z.innerHTML=L.length?'':'<div class="vide">Aucun article ne dort depuis plus de '+DORM+' jours</div>';
 L.forEach(a=>{const np=Math.max(Math.round(a.prix*.9),Math.ceil(cout(a))),r=document.createElement('div');r.className='hb';r.style.gridTemplateColumns='1fr auto auto';r.innerHTML='<span></span><span class="pr"></span><button class="btn s p">Baisser</button>';r.children[0].textContent=titre(a);r.children[1].textContent=Math.floor((Date.now()-a.ajout)/864e5)+' j · '+eur(a.prix)+' → '+eur(np);r.children[2].onclick=()=>{const D=Store.all();D.find(x=>x.id===a.id).prix=np;Store.set(D);toast('Prix baissé à '+eur(np));dash()};z.appendChild(r)})};
$('obj').onchange=()=>{localStorage.setItem(budgetKey('fusiona-obj'),$('obj').value);dash()};
const fab=document.createElement('button');fab.className='ic';fab.textContent='+';fab.title='Ajout rapide (touche N)';fab.setAttribute('aria-label','Nouvel article');fab.style.cssText='position:fixed;right:22px;bottom:22px;width:54px;height:54px;border-radius:50%;font-size:26px;background:var(--b);color:var(--bt);z-index:40;box-shadow:var(--sh)';fab.onclick=()=>{reset();go('new');setTimeout(()=>$('nom').focus(),300)};document.body.appendChild(fab);
document.addEventListener('keydown',e=>{if(e.key==='n'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)&&!e.ctrlKey&&!e.metaKey)fab.click()});
const cb=document.createElement('button');cb.className='btn s';cb.textContent='Exporter les ventes (CSV)';cb.onclick=()=>{const q=s=>'"'+String(s===null||s===undefined?'':s).replace(/"/g,'""')+'"',R=[['Article','Catégorie','Source','Achat','Frais','Prix de vente','Bénéfice','Date de vente']].concat(workspaceStock().filter(a=>a.statut==='Vendu').map(a=>[titre(a),a.cat,a.source||'',a.achat,a.frais||0,a.vendu,(a.vendu-cout(a)).toFixed(2),new Date(a.vente).toLocaleDateString('fr-FR')])),l=document.createElement('a');l.href=URL.createObjectURL(new Blob(['\ufeff'+R.map(r=>r.map(q).join(';')).join('\n')],{type:'text/csv'}));l.download='ventes-fusiona.csv';l.click()};document.querySelector('#p-stock .btn.s').after(cb);

/* ---- Refonte : cartes, tableau, listes à mémoire, courbe ---- */
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const nm=a=>{const n=up(a.nom||'');return a.marque&&!n.toLowerCase().includes(a.marque.toLowerCase())?n+' '+a.marque:n},sbt=a=>[a.taille&&(/^taille\b/i.test(a.taille)?a.taille:'Taille '+a.taille),a.couleur,a.etat,a.location,!teamMember&&a.member].filter(Boolean).join(' · ');
S.mode='Courbe';COL.splice(0,5,'#adcef7','#72a7ee','#417ed4','#245db3','#1356a3');
stock=function(){let d=workspaceStock();const q=$('q').value.toLowerCase();d=d.filter(a=>(!q||(titre(a)+' '+a.cat+' '+(a.source||'')+' '+(a.location||'')).toLowerCase().includes(q))&&(S.st==='Tous'||a.statut===S.st)&&(S.cat==='Tous'||a.cat===S.cat));
 const P=a=>a.statut==='Vendu'?a.vendu:a.prix,B=a=>P(a)-cout(a),T={'Plus récents':(a,b)=>b.ajout-a.ajout,'Prix croissant':(a,b)=>P(a)-P(b),'Prix décroissant':(a,b)=>P(b)-P(a),'Rentabilité':(a,b)=>B(b)-B(a),'Nom':(a,b)=>nm(a).localeCompare(nm(b))};d.sort(T[S.tri]);
 $('cnt').textContent='· '+d.length+(d.length>1?' articles':' article');const z=$('liste');z.innerHTML='';if(!d.length){z.innerHTML="<div class='vide card'>Aucun article ne correspond.</div>";return}
 const age=a=>Math.floor((Date.now()-a.ajout)/864e5),pill=a=>`<span class='pl ${a.statut==='Vendu'?'v':a.statut==='Réservé'?'r':''}'>${a.statut}</span>`,ach=a=>cout(a)>0?eur(cout(a)):'Gratuit',mg=a=>cout(a)>0?Math.round(B(a)/cout(a)*100)+' %':'coût nul',cl=a=>B(a)>=0?'ok':'bad',sg=a=>(B(a)>=0?'+':'')+eur(B(a)),ph=a=>a.photos&&a.photos[0]?`<img loading='lazy' src='${esc(a.photos[0])}' alt=''>`:'',
  act=a=>`<div class='ac'>${a.statut!=='Vendu'?`<button class='btn p' data-a='sell' data-i='${a.id}'>Vendu</button>`:''}<button class='btn s p' data-a='menu' data-i='${a.id}' aria-label='Plus d actions'>⋯</button></div>`;
 if(S.vue==='Tableau'){z.innerHTML=`<div class='card tb'><table class='t2'><thead><tr><th></th><th>Article</th><th>Catégorie</th><th class='r'>Achat</th><th class='r'>Prix</th><th class='r'>Bénéfice</th><th>Statut</th><th></th></tr></thead><tbody>${d.map(a=>`<tr><td><span class='th2'>${ph(a)}</span></td><td><div class='nm2'>${esc(nm(a))}</div><div class='sb'>${esc(sbt(a))}</div></td><td>${a.cat}</td><td class='r'>${ach(a)}</td><td class='r'>${eur(P(a))}</td><td class='r ${cl(a)}'>${sg(a)}</td><td>${pill(a)}</td><td class='r'>${act(a)}</td></tr>`).join('')}</tbody></table></div>`;return}
 z.innerHTML=`<div class='gr'>${d.map((a,i)=>`<div class='it' style='animation-delay:${Math.min(i*40,400)}ms'><div class='ph'>${ph(a)||'Pas de photo'}${pill(a)}${a.statut==='En vente'&&age(a)>=DORM?`<span class='pl z'>Dort ${age(a)} j</span>`:''}</div><div class='bd'><div class='br'>${esc(a.marque||a.cat)}</div><div class='nm'>${esc(nm(a))}</div><div class='sb'>${esc(sbt(a))}</div><div class='pc'><b>${eur(P(a))}</b><span class='mg ${cl(a)}'>${sg(a)} · ${mg(a)}</span></div><div class='ft'><span>Achat ${ach(a)}</span><span>${a.cat}</span></div>${act(a)}</div></div>`).join('')}</div>`};
document.addEventListener('click',e=>{let p=$('pop');if(!p){p=document.createElement('div');p.id='pop';document.body.appendChild(p)}const b=e.target.closest&&e.target.closest('[data-a]');if(!b){p.classList.remove('on');return}const id=+b.dataset.i;if(b.dataset.a==='sell'){p.classList.remove('on');return sell(id)}const a=Store.all().find(x=>x.id===id);p.innerHTML='';[['Modifier',()=>edit(id)],['Dupliquer',()=>dup(id)],['Créer une tâche',()=>{openTeam(teamMember);$('task-article').value=String(id);$('task-label').focus()}],[a.statut==='Réservé'?'Remettre en vente':'Réserver',()=>res(id)],['Supprimer',()=>del(id),1]].filter(x=>a.statut!=='Vendu'||['Modifier','Dupliquer','Créer une tâche','Supprimer'].includes(x[0])).forEach(([t,f,dg])=>{const r=document.createElement('div');r.textContent=t;if(dg)r.className='dg';r.onclick=ev=>{ev.stopPropagation();p.classList.remove('on');f()};p.appendChild(r)});const r=b.getBoundingClientRect();p.style.top=(r.bottom+scrollY+6)+'px';p.style.left=Math.max(8,Math.min(r.right+scrollX-170,innerWidth-180))+'px';p.classList.add('on');e.stopPropagation()},true);

/* ---- Listes qui retiennent tes valeurs ---- */
const OPT='fusiona-opts',FIELDS=['nom','marque','taille','couleur','details','source'];
const mem=()=>{try{return JSON.parse(localStorage.getItem(OPT))||{}}catch(e){return{}}};
const vals=f=>[...new Set([...(mem()[f]||[]),...Store.all().map(a=>a[f]).filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
function remember(){const m=mem();FIELDS.forEach(f=>{const v=$(f).value.trim();if(v)m[f]=[...new Set([...(m[f]||[]),v])]});localStorage.setItem(OPT,JSON.stringify(m))}
function combo(f){const i=$(f),w=document.createElement('div'),l=document.createElement('div');w.className='cb';l.className='cl';i.parentNode.insertBefore(w,i);w.append(i,l);i.removeAttribute('list');i.autocomplete='off';
 const show=()=>{const q=i.value.trim().toLowerCase(),all=vals(f),a=all.filter(v=>v.toLowerCase().includes(q)&&v.toLowerCase()!==q);l.innerHTML='';a.slice(0,30).forEach(v=>{const d=document.createElement('div');d.textContent=v;d.onmousedown=e=>{e.preventDefault();i.value=v;w.classList.remove('open');i.dispatchEvent(new Event('input'))};l.appendChild(d)});if(q&&!all.some(v=>v.toLowerCase()===q)){const d=document.createElement('div');d.className='new';d.textContent='+ Ajouter « '+i.value.trim()+' »';d.onmousedown=e=>{e.preventDefault();w.classList.remove('open')};l.appendChild(d)}w.classList.toggle('open',l.children.length>0)};
 i.addEventListener('focus',show);i.addEventListener('input',show);i.addEventListener('blur',()=>setTimeout(()=>w.classList.remove('open'),120))}
FIELDS.forEach(combo);
const _sv=save;save=function(){if($('nom').value.trim()&&$('marque').value.trim()&&num('achat')!==null)remember();_sv()};

/* ---- Courbe, couleurs sobres, indicateurs sans valeur infinie ---- */
function courbe(){const V=workspaceStock().filter(a=>a.statut==='Vendu'),n=S.per==='6 mois'?6:12,now=new Date(),M=[];for(let i=n-1;i>=0;i--){const m=new Date(now.getFullYear(),now.getMonth()-i,1);M.push({k:m.getFullYear()*12+m.getMonth(),l:m.toLocaleDateString('fr-FR',{month:'short'}),ca:0,b:0})}V.forEach(a=>{const d=new Date(a.vente),m=M.find(x=>x.k===d.getFullYear()*12+d.getMonth());if(m){m.ca+=a.vendu;m.b+=a.vendu-cout(a)}});
 const W=720,H=240,Pd=30,mx=Math.max(1,...M.map(m=>Math.max(m.ca,m.b))),lo=Math.min(0,...M.map(m=>m.b)),X=i=>Pd+i*(W-2*Pd)/Math.max(1,M.length-1),Y=v=>H-26-(v-lo)/(mx-lo)*(H-50),
  ln=(k,c)=>`<polyline points='${M.map((m,i)=>X(i)+','+Y(m[k])).join(' ')}' fill='none' stroke='${c}' stroke-width='2.5' stroke-linejoin='round'/>`+M.map((m,i)=>`<circle cx='${X(i)}' cy='${Y(m[k])}' r='4.5' fill='${c}'><title>${m.l} : ${eur(m[k])}</title></circle>`).join('');
 $('c-mois').innerHTML=`<svg viewBox='0 0 ${W} ${H}' width='100%' role='img' aria-label='Ventes et bénéfices par mois'>`+`<path d='M${Pd} ${Y(0)}H${W-Pd}' class='chart-grid'/>`+ln('ca','#417ed4')+ln('b','#10b981')+M.map((m,i)=>`<text x='${X(i)}' y='${H-6}' text-anchor='middle'>${m.l}</text>`).join('')+`</svg><div class='pr'><span style='color:#417ed4'>■</span> Ventes &nbsp; <span style='color:#10b981'>■</span> Bénéfice</div>`}
const _d3=dash;dash=function(){_d3();const V=workspaceStock().filter(a=>a.statut==='Vendu'),k=document.querySelectorAll('.kpi b'),c0=V.reduce((s,a)=>s+cout(a),0),pos=V.filter(a=>cout(a)>0);if(k[5])k[5].textContent=pos.length?Math.round(pos.reduce((s,a)=>s+a.vendu/cout(a)-1,0)/pos.length*100)+' %':'—';if(k[6]&&c0===0)k[6].textContent=V.length?'Pur bénéfice':'0 %';if(S.mode==='Courbe')courbe();const mz=document.createElement('div');mz.id='mode';mz.className='row';mz.style.marginLeft='8px';$('per').appendChild(mz);chips('mode',['Barres','Courbe'],()=>S.mode,v=>{S.mode=v;dash()})};

/* ---- Comptes et sauvegarde en ligne (Supabase) ---- */
const SBURL='https://wcctvhxevsdrvntevmwb.supabase.co',SBKEY='sb_publishable_38T_QxjN3-bslcZEU8x94A_05Z9tln3',LEG=Store.all(),REC=location.hash.includes('type=recovery');
let MEM=[],SNAP={},uid=null,usr=null,sb=null,qd=null,recDone=false;
const stor={getItem:k=>localStorage.getItem(k)||sessionStorage.getItem(k),setItem:(k,v)=>(localStorage.getItem('fusiona-remember')==='0'?sessionStorage:localStorage).setItem(k,v),removeItem:k=>{localStorage.removeItem(k);sessionStorage.removeItem(k)}};
const ov=document.createElement('div');ov.id='auth';ov.innerHTML="<div class='vide'>Chargement…</div>";document.body.appendChild(ov);
const sy=document.createElement('span');sy.className='sy';const hr=document.querySelector('header .row');hr.prepend(sy);const setSync=t=>sy.textContent=t;
const ab=document.createElement('button');ab.className='ic';ab.textContent='👤';ab.title='Mon compte';ab.setAttribute('aria-label','Mon compte');ab.onclick=()=>usr?authView('account'):0;hr.append(ab);
const merge=()=>{const ids=new Set(MEM.map(a=>a.id));MEM=MEM.concat(LEG.filter(a=>!ids.has(a.id)))};
Store.all=()=>MEM;Store.set=d=>{MEM=d;clearTimeout(qd);setSync('Enregistrement…');qd=setTimeout(flush,500);return true};
async function flush(){if(!sb||!uid)return;try{const cur={};MEM.forEach(a=>cur[a.id]=JSON.stringify(a));const up=MEM.filter(a=>SNAP[a.id]!==cur[a.id]).map(a=>({id:a.id,data:a})),del=Object.keys(SNAP).filter(i=>!(i in cur)).map(Number);for(let i=0;i<up.length;i+=20){const r=await sb.from('articles').upsert(up.slice(i,i+20));if(r.error)throw r.error}if(del.length){const r=await sb.from('articles').delete().in('id',del);if(r.error)throw r.error}SNAP=cur;setSync('Enregistré ✓')}catch(e){setSync('Non enregistré !');toast('Sauvegarde en ligne impossible, réessaie')}}
addEventListener('pagehide',()=>{if(uid)flush()});
async function pull(){const r=await sb.from('articles').select('data').order('id');if(r.error){window.lastErr=r.error.message;toast('Chargement impossible');return false}MEM=r.data.map(x=>x.data);SNAP={};MEM.forEach(a=>SNAP[a.id]=JSON.stringify(a));return true}
async function enter(u){if(uid===u.id)return;uid=u.id;usr=u;setSync('Chargement…');if(!(await pull())){uid=null;usr=null;authView('login','Chargement impossible : '+(window.lastErr||'réessaie.'));return}if(!MEM.length&&LEG.length&&confirm(`Importer les ${LEG.length} articles de cet appareil dans ton compte ?`)){merge();SNAP={};await flush()}ov.classList.add('off');dash();stock();setSync('Enregistré ✓')}
function leave(){uid=null;usr=null;MEM=[];SNAP={};setSync('');dash();stock();authView('login')}
function say(t,ok){const m=$('am');if(m){m.textContent=t;m.className='em '+(ok?'ok':'')}}
function authView(v,msg,good){ov.classList.remove('off');const T={login:'Connexion',signup:'Créer un compte',forgot:'Mot de passe oublié',reset:'Nouveau mot de passe',account:'Mon compte'},pw=(id,l,ac)=>`<label>${l}</label><input id='${id}' type='password' autocomplete='${ac}'>`,bt=(id,t,c)=>`<button class='btn ${c||'s'}' id='${id}'>${t}</button>`;
 ov.innerHTML=`<div class='card box'><div class='logo' style='font-size:24px;margin-bottom:8px'><img class="jugo-logo" src="jugo-logo.png" alt="Jugo"></div><h2>${T[v]}</h2><div id='am' class='em' style='min-height:18px'></div>`+(v==='account'?`<p class='pr'>${esc(usr?usr.email:'')}</p><label>Identifiant</label><input id='au' value='${esc(usr&&usr.user_metadata&&usr.user_metadata.username||'')}'>${bt('b-u','Enregistrer l’identifiant','s p')}<label>Nouvelle adresse e-mail</label><input id='ae' type='email'>${bt('b-e','Changer l’e-mail','s p')}${pw('ap','Nouveau mot de passe','new-password')}${bt('b-p','Changer le mot de passe','s p')}<div>${LEG.length?bt('b-i','Importer les '+LEG.length+' articles de cet appareil'):''}${bt('b-o','Se déconnecter')}${bt('b-g','Déconnecter tous mes appareils')}${bt('b-c','Fermer','')}</div>`:`${v==='signup'?`<label>Identifiant (facultatif)</label><input id='au' autocomplete='username'>`:''}${v!=='reset'?`<label>Adresse e-mail</label><input id='ae' type='email' autocomplete='email'>`:''}${v!=='forgot'?pw('ap',v==='login'?'Mot de passe':'Mot de passe (8 caractères minimum)',v==='login'?'current-password':'new-password'):''}${v==='signup'?pw('ap2','Confirmer le mot de passe','new-password'):''}${v!=='forgot'?`<label style='text-transform:none;letter-spacing:0'><input id='sh' type='checkbox' style='width:auto;margin-right:6px'>Afficher le mot de passe</label>`:''}${v==='login'?`<label style='text-transform:none;letter-spacing:0'><input id='rm' type='checkbox' style='width:auto;margin-right:6px' checked>Rester connecté</label>`:''}${bt('b-ok',{login:'Se connecter',signup:'Créer mon compte',forgot:'Envoyer le lien',reset:'Enregistrer'}[v],'')}`)+(v==='login'?`<div><button class='lk' data-v='forgot'>Mot de passe oublié ?</button> · <button class='lk' data-v='signup'>Créer un compte</button></div>`:v==='signup'||v==='forgot'?`<div><button class='lk' data-v='login'>J’ai déjà un compte</button></div>`:'')+`</div>`;
 if(msg)say(msg,good);ov.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>authView(b.dataset.v));
 const sh=$('sh');if(sh)sh.onchange=()=>['ap','ap2'].forEach(i=>$(i)&&($(i).type=sh.checked?'text':'password'));
 ov.onkeydown=e=>{if(e.key==='Enter'&&$('b-ok'))$('b-ok').click()};if($('b-ok'))$('b-ok').onclick=()=>authDo(v);
 if(v==='account'){const g=i=>$(i).value.trim(),U=(p,m)=>sb.auth.updateUser(p).then(r=>r.error?say(r.error.message):say(m,1));$('b-u').onclick=()=>U({data:{username:g('au')}},'Identifiant enregistré.');$('b-e').onclick=()=>g('ae')?U({email:g('ae')},'Un e-mail de confirmation a été envoyé à la nouvelle adresse.'):say('Saisis une adresse.');$('b-p').onclick=()=>$('ap').value.length>=8?U({password:$('ap').value},'Mot de passe changé.'):say('8 caractères minimum.');if($('b-i'))$('b-i').onclick=()=>{merge();flush().then(()=>{dash();stock();ov.classList.add('off')})};$('b-o').onclick=()=>sb.auth.signOut();$('b-g').onclick=()=>sb.auth.signOut({scope:'global'});$('b-c').onclick=()=>ov.classList.add('off')}}
async function authDo(v){const em=$('ae')?$('ae').value.trim():'',pw=$('ap')?$('ap').value:'',b=$('b-ok');b.disabled=true;try{
 if(v==='login'){localStorage.setItem('fusiona-remember',$('rm').checked?'1':'0');const r=await sb.auth.signInWithPassword({email:em,password:pw});if(r.error)say(/confirm/i.test(r.error.message)?`Confirme d'abord ton adresse e-mail.`:'E-mail ou mot de passe incorrect.')}
 else if(v==='signup'){if(!em||pw.length<8)say('Adresse e-mail et mot de passe de 8 caractères minimum requis.');else if(pw!==$('ap2').value)say('Les mots de passe ne correspondent pas.');else{const r=await sb.auth.signUp({email:em,password:pw,options:{data:{username:$('au').value.trim()},emailRedirectTo:location.origin+location.pathname}});if(r.error)say(r.error.message);else if(!r.data.session)authView('login','Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.',1)}}
 else if(v==='forgot'){await sb.auth.resetPasswordForEmail(em,{redirectTo:location.origin+location.pathname});authView('login',`Si cette adresse existe, un e-mail avec un lien vient d'être envoyé.`,1)}
 else if(v==='reset'){if(pw.length<8)say('8 caractères minimum.');else{const r=await sb.auth.updateUser({password:pw});if(r.error)say(r.error.message);else{recDone=true;history.replaceState(null,'',location.pathname);const u=(await sb.auth.getUser()).data.user;enter(u)}}}
 }catch(e){say('Connexion impossible. Vérifie ta connexion internet.')}if(b.isConnected)b.disabled=false}
function boot(){sb=supabase.createClient(SBURL,SBKEY,{auth:{storage:stor,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});sb.auth.onAuthStateChange((ev,s)=>{setTimeout(()=>{if(REC&&!recDone){authView('reset');return}if(s&&s.user)enter(s.user);else if(ev==='SIGNED_OUT')leave()},0)});sb.auth.getSession().then(r=>{if(REC&&!recDone)authView('reset');else if(r.data.session)enter(r.data.session.user);else authView('login')})}
const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';sc.onload=boot;sc.onerror=()=>{ov.innerHTML="<div class='card box'><h2>Connexion impossible</h2><p class='pr'>Le service en ligne ne se charge pas. Vérifie ta connexion internet puis recharge la page.</p></div>"};document.head.appendChild(sc);

/* ---- Verdict d’achat et page Aujourd’hui ---- */
const mainEl=document.querySelector('main'),navEl=document.querySelector('nav');navEl.style.overflowX='auto';
const mk=(id,html)=>{const s=document.createElement('section');s.className='pg';s.id='p-'+id;s.innerHTML=html;mainEl.appendChild(s)};
mk('today',`<div id='t-out'></div>`);
mk('verdict',`<div class='card'><h2>Verdict d'achat</h2><p class='pr'>Tape ce qu'on te demande : le site te dit si c'est une bonne affaire, d'après tes propres ventes.</p><div class='g2'><div><label>Marque</label><input id='v-marque' placeholder='Nike' oninput='verdict()'></div><div><label>Prix demandé (€)</label><input id='v-prix' type='number' step='0.5' min='0' oninput='verdict()'></div><div><label>Marge cible (% sur le coût)</label><input id='v-marge' type='number' value='100' oninput='verdict()'></div><div><label>Prix de revente repéré (facultatif)</label><input id='v-ref' type='number' step='0.5' min='0' oninput='verdict()'></div></div><span class='lb'>Catégorie</span><div class='row' id='v-cat'></div></div><div id='v-out'></div>`);
[['today','Aujourd’hui'],['verdict','Verdict']].forEach(([id,t])=>{const b=document.createElement('button');b.id='n-'+id;b.textContent=t;b.onclick=()=>go(id);navEl.insertBefore(b,$('n-new'))});
const _go=go;go=function(p){['today','verdict'].forEach(x=>{$('p-'+x).classList.toggle('on',x===p);$('n-'+x).classList.toggle('on',x===p)});if(p==='today'||p==='verdict'){['dash','new','stock'].forEach(x=>{$('p-'+x).classList.remove('on');$('n-'+x).classList.remove('on')});if(p==='today')today();scrollTo({top:0,behavior:'instant'})}else _go(p)};
S.vc='Toutes';chips('v-cat',['Toutes',...CATS],()=>S.vc,v=>{S.vc=v;verdict()});
res=function(id){const d=Store.all(),a=d.find(x=>x.id===id);a.statut=a.statut==='Réservé'?'En vente':'Réservé';a.reserve=a.statut==='Réservé'?Date.now():null;Store.set(d);toast(a.statut==='Réservé'?'Article réservé':'Remis en vente');stock()};
function verdict(){const m=$('v-marque').value.trim().toLowerCase(),p=parseFloat($('v-prix').value),g=parseFloat($('v-marge').value),ref=parseFloat($('v-ref').value),o=$('v-out');
 if(isNaN(p)||isNaN(g)){o.innerHTML=`<div class='vide'>Saisis le prix demandé et ta marge cible.</div>`;return}
 const V=workspaceStock().filter(a=>a.statut==='Vendu'),bb=m?V.filter(a=>(a.marque||'').toLowerCase()===m):[],bc=S.vc==='Toutes'?[]:V.filter(a=>a.cat===S.vc),pool=bb.length>=2?bb:bc.length>=2?bc:bb,src=!pool.length?'':pool===bb?'tes ventes de cette marque':'tes ventes de cette catégorie',avg=pool.length?pool.reduce((s,a)=>s+a.vendu,0)/pool.length:null,jr=pool.length?Math.round(pool.reduce((s,a)=>s+(a.vente-a.ajout)/864e5,0)/pool.length):0,own=!isNaN(ref)&&ref>0,resale=own?ref:avg;
 if(resale===null){o.innerHTML=`<div class='card'><b>Pas de vente comparable.</b><p class='pr'>Tu n’as encore rien vendu dans cette marque ou cette catégorie. Repère le prix de vente d’articles identiques sur Vinted et saisis-le dans « Prix de revente repéré ».</p></div>`;return}
 const max=resale/(1+g/100),gain=resale-p,pc=p>0?Math.round(gain/p*100):0,r=p<=max*.8?['#34d399','Excellente affaire']:p<=max?['#34d399','Bonne affaire']:p<=max*1.2?['#f59e0b','À négocier']:['#f87171','Trop cher'],conf=own?'prix saisi par toi':pool.length>=8?'bonne ('+pool.length+' ventes)':pool.length>=3?'moyenne ('+pool.length+' ventes)':'faible ('+pool.length+' vente'+(pool.length>1?'s':'')+')',offre=Math.floor(max*2)/2;
 o.innerHTML=`<div class='card'><div style='font-size:26px;font-weight:700;color:${r[0]}'>${r[1]}</div><div class='sum' style='margin-top:14px'><div>Revente estimée<b>${eur(resale)}</b></div><div>Prix d’achat maximum<b>${eur(max)}</b></div><div>Gain si tu achètes à ${eur(p)}<b class='${gain>=0?'ok':'bad'}'>${gain>=0?'+':''}${eur(gain)} · ${pc} %</b></div>${pool.length&&!own?`<div>Délai moyen<b>${jr} j</b></div>`:''}<div>Fiabilité<b>${conf}</b></div></div>${src&&!own?`<p class='note'>Estimation basée sur ${src}. Elle ne tient compte ni de l’état exact ni de la saison.</p>`:''}${p>max?`<div class='res' id='v-msg'></div><button class='btn s p' style='margin-top:8px' id='v-cp'>Copier le message</button>`:''}</div>`;
 if(p>max){$('v-msg').textContent=`Bonjour, votre article m’intéresse. Seriez-vous d’accord pour ${eur(offre)} ? Merci !`;$('v-cp').onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText($('v-msg').textContent);$('v-cp').textContent='Copié !'}}}
function today(){const d=workspaceStock(),now=Date.now(),day=864e5,o=$('t-out');o.innerHTML='';
 const V=d.filter(a=>a.statut==='Vendu'),nw=new Date(),mp=V.filter(a=>{const x=new Date(a.vente);return x.getMonth()===nw.getMonth()&&x.getFullYear()===nw.getFullYear()}).reduce((s,a)=>s+a.vendu-cout(a),0),ob=+localStorage.getItem(budgetKey('fusiona-obj'))||0;
 const h=document.createElement('div');h.className='card';h.innerHTML=`<h2>Aujourd’hui</h2><div class='pr'>Bénéfice du mois : <b style='color:var(--t)'>${eur(mp)}</b>${ob?' sur '+eur(ob)+' d’objectif':''}</div>`;o.appendChild(h);
 const sec=(t,items)=>{if(!items.length)return 0;const c=document.createElement('div');c.className='card';c.innerHTML=`<h2>${t} <span class='pr'>· ${items.length}</span></h2>`;items.forEach(([a,txt,btn,fn])=>{const r=document.createElement('div');r.className='hb';r.style.gridTemplateColumns='1fr auto auto';r.innerHTML=`<span></span><span class='pr'></span><button class='btn s p'></button>`;r.children[0].textContent=titre(a);r.children[1].textContent=txt;r.children[2].textContent=btn;r.children[2].onclick=fn;c.appendChild(r)});o.appendChild(c);return 1};
 const age=a=>Math.floor((now-a.ajout)/day),dorm=d.filter(a=>a.statut==='En vente'&&age(a)>=DORM).sort((a,b)=>a.ajout-b.ajout).map(a=>{const np=Math.max(Math.round(a.prix*.9),Math.ceil(cout(a)));return[a,age(a)+' j · '+eur(a.prix)+' → '+eur(np),'Baisser',()=>{const D=Store.all();D.find(x=>x.id===a.id).prix=np;Store.set(D);toast('Prix baissé à '+eur(np));today()}]}),
  rel=d.filter(a=>a.statut==='Réservé'&&a.reserve&&now-a.reserve>3*day).map(a=>[a,'réservé depuis '+Math.floor((now-a.reserve)/day)+' j','Remettre en vente',()=>{res(a.id);today()}]),
  nop=d.filter(a=>a.statut!=='Vendu'&&!(a.photos&&a.photos.length)).map(a=>[a,'sans photo','Ajouter',()=>edit(a.id)]);
 const n=sec('Articles qui dorment',dorm)+sec('Réservations à relancer',rel)+sec('Articles sans photo',nop);
 if(!n)o.insertAdjacentHTML('beforeend',`<div class='card vide'>Rien à faire : tout est à jour ✓</div>`)}

/* ---- Scan d’étiquette, annonces par plateforme, mode hors ligne ---- */
const BR=['Nike','Adidas','Puma','Lacoste','Levi’s','Zara','H&M','Uniqlo','Ralph Lauren','Tommy Hilfiger','Carhartt','The North Face','Champion','Under Armour','Reebok','Asics','New Balance','Converse','Vans','Kappa','Fila','Jordan','Calvin Klein','Diesel','Guess','Hugo Boss','Stone Island','Armani','Kiabi','Decathlon','Celio','Bershka','Pull&Bear','Mango','Gap','Eden Park','Petit Bateau','Le Coq Sportif','Umbro','Superdry','Napapijri','Patagonia','Columbia','Salomon','Casa Blanca','Arc’teryx'];
const dz2=$('drop'),sf=document.createElement('input');sf.type='file';sf.accept='image/*';sf.setAttribute('capture','environment');sf.hidden=true;const sbn=document.createElement('button');sbn.type='button';sbn.className='btn s p';sbn.style.marginTop='10px';sbn.textContent='Scanner l’étiquette';sbn.onclick=()=>sf.click();const ss=document.createElement('div');ss.id='scan-s';ss.className='note';dz2.after(sbn,sf,ss);sf.onchange=e=>{if(e.target.files[0])scan(e.target.files[0]);e.target.value=''};
async function scan(f){const s=$('scan-s');s.textContent='Lecture en cours… (la première fois, le moteur de lecture se télécharge, cela peut prendre un moment)';try{if(!window.Tesseract)await new Promise((ok,ko)=>{const t=document.createElement('script');t.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';t.onload=ok;t.onerror=ko;document.head.appendChild(t)});
 const r=await Tesseract.recognize(f,'eng+fra'),txt=r.data.text||'',nz=x=>' '+x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()+' ',T=nz(txt),mq=[...new Set([...vals('marque'),...BR])].sort((a,b)=>b.length-a.length).find(b=>T.includes(nz(b))),tk=txt.split(/[^A-Za-z0-9.,%]+/).filter(Boolean);let sz='';
 for(let i=0;i<tk.length;i++){if(['size','taille','eu','fr','eur','t'].includes(tk[i].toLowerCase())&&tk[i+1]&&(/^(xxs|xs|s|m|l|xl|xxl|xxxl)$/i.test(tk[i+1])||/^[0-9]{2}([.,]5)?$/.test(tk[i+1]))){sz=tk[i+1].toUpperCase();break}}
 if(!sz){const x=tk.find(t=>['XXS','XS','XL','XXL','XXXL'].includes(t));if(x)sz=x}
 const mat=[];for(let i=0;i<tk.length;i++){const t=tk[i];if(/^[0-9]{1,3}%?$/.test(t)&&(t.endsWith('%')||tk[i+1]==='%')){const w=tk[i+(t.endsWith('%')?1:2)];if(w&&/^[A-Za-zé]{3,}$/.test(w))mat.push(t.replace('%','')+'% '+w.toLowerCase())}}
 if(mq&&!$('marque').value)$('marque').value=mq;if(sz&&!$('taille').value)$('taille').value=sz;if(mat.length&&!$('details').value)$('details').value=mat.join(', ');
 s.textContent='Lu : marque '+(mq||'—')+', taille '+(sz||'—')+', matière '+(mat.join(', ')||'—')+'. Vérifie avant d’enregistrer, la lecture peut se tromper.'}catch(e){s.textContent='Lecture impossible (connexion ou photo trop floue). Saisis les infos à la main.'}}
const PL=['Vinted','Leboncoin','Marketplace'],TD={Vinted:TPL0+'\n\n{hashtags}',Leboncoin:`{article} {marque} {couleur} {taille}.\nÉtat : {etat}.\n{details}\n\nRemise en main propre possible, ou envoi (frais à la charge de l'acheteur). N'hésitez pas à me contacter pour toute question.`,Marketplace:`{article} {marque} {couleur} {taille}.\nÉtat : {etat}. Prix : {prix}.\n{details}\n\nRemise en main propre ou envoi possible. Message privé pour toute question.`};S.plat='Vinted';
const TP=()=>{try{return JSON.parse(localStorage.getItem('fusiona-tpls'))||{}}catch(e){return{}}},saveTP=t=>localStorage.setItem('fusiona-tpls',JSON.stringify(t));
{const o=localStorage.getItem('fusiona-tpl');if(o&&!TP().Vinted){const t=TP();t.Vinted=o;saveTP(t)}}
const loadTpl=()=>{$('tpl').value=TP()[S.plat]||TD[S.plat]};loadTpl();$('tpl').oninput=()=>{const t=TP();t[S.plat]=$('tpl').value;saveTP(t)};$('tpl-r').onclick=()=>{const t=TP();delete t[S.plat];saveTP(t);loadTpl()};
gen=function(){const v=read();if(!v.nom||!v.marque){valid();return}const pr=num('prix'),tag=s=>'#'+s.toLowerCase().replace(/[^a-z0-9]/g,''),m={article:up(v.nom),marque:v.marque,couleur:v.couleur?'de couleur '+v.couleur:'',taille:v.taille?'taille '+v.taille:'',etat:v.etat.toLowerCase(),details:v.details?up(v.details)+(/[.!?]$/.test(v.details)?'':'.'):'',prix:pr?eur(pr):'',hashtags:[tag(v.marque),tag(v.nom)].join(' ')};
 const d=($('tpl').value||TD[S.plat]).replace(/\{(\w+)\}/g,(x,k)=>m[k]!==undefined?m[k]:x).replace(/ +/g,' ').replace(/ \./g,'.').replace(/\n +/g,'\n').replace(/\n{3,}/g,'\n\n').trim(),ttl=S.plat==='Vinted'?titre(v):[up(v.nom),v.marque,v.couleur,v.taille?'taille '+v.taille:''].filter(Boolean).join(' ')+(S.plat==='Marketplace'&&pr?' - '+eur(pr):''),U={Vinted:'https://www.vinted.fr/catalog?search_text=',Leboncoin:'https://www.leboncoin.fr/recherche?text=',Marketplace:'https://www.facebook.com/marketplace/search/?query='};
 $('o-t').textContent=ttl;$('o-d').textContent=d;$('o-l').href=U[S.plat]+encodeURIComponent([v.marque,v.nom,v.taille].join(' '));$('o-l').querySelector('button').textContent='Annonces similaires sur '+S.plat;$('out').style.display='block'};
const opl=document.createElement('div');opl.className='row';opl.id='o-plat';$('out').prepend(opl);chips('o-plat',PL,()=>S.plat,v=>{S.plat=v;loadTpl();gen()});
/* hors ligne : copie locale + synchronisation au retour du réseau */
const idb=(m,k,v)=>new Promise((ok,ko)=>{const r=indexedDB.open('fusiona',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const t=r.result.transaction('kv',m==='get'?'readonly':'readwrite'),s=t.objectStore('kv'),q=m==='get'?s.get(k):s.put(v,k);t.oncomplete=()=>ok(q.result);t.onerror=ko};r.onerror=ko});
const persist=()=>{if(uid)idb('put','c',{uid:uid,mem:MEM,snap:SNAP}).catch(()=>{})};
const _ss=Store.set;Store.set=d=>{const r=_ss(d);persist();return r};
const _fl=flush;flush=async function(){await _fl();persist()};
const _pull=pull;pull=async function(){if(await _pull()){persist();return true}const c=await idb('get','c').catch(()=>null);if(c&&c.uid===uid&&c.mem){MEM=c.mem;SNAP=c.snap;setSync('Hors ligne');return true}return false};
const _boot=boot;boot=function(){_boot();if(!navigator.onLine)idb('get','c').then(c=>{if(c&&c.mem&&!uid){uid=c.uid;usr={id:c.uid,email:'hors ligne'};MEM=c.mem;SNAP=c.snap;ov.classList.add('off');dash();stock();setSync('Hors ligne')}}).catch(()=>{})};sc.onload=boot;
addEventListener('offline',()=>setSync('Hors ligne'));addEventListener('online',()=>{setSync('Synchronisation…');sb&&sb.auth.getSession().then(r=>{if(r.data.session){uid=r.data.session.user.id;usr=r.data.session.user;flush()}else authView('login','Reconnecte-toi pour synchroniser.')})});
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
(function(){const c=document.createElement('canvas');c.width=c.height=180;const x=c.getContext('2d');x.fillStyle='#0a0a0a';x.fillRect(0,0,180,180);x.fillStyle='#fafafa';x.beginPath();x.moveTo(90,32);x.lineTo(148,90);x.lineTo(90,148);x.lineTo(32,90);x.closePath();x.fill();const l=document.createElement('link');l.rel='apple-touch-icon';l.href=c.toDataURL('image/png');document.head.appendChild(l)})();

/* ---- Mode invité : utiliser sans se connecter, rien n’est enregistré ---- */
let GUEST=false;
const GMSG='Mode invité : rien n’est enregistré';
function guest(){GUEST=true;uid=null;usr=null;MEM=[];SNAP={};ov.classList.add('off');setSync(GMSG);dash();stock()}
const _av=authView;authView=function(v,m,g){if(GUEST&&m==='Reconnecte-toi pour synchroniser.')return;_av(v,m,g);if(v==='login'){const box=ov.querySelector('.box'),b=document.createElement('button'),n=document.createElement('p');b.className='btn s';b.id='b-guest';b.style.width='100%';b.textContent='Utiliser sans se connecter';b.onclick=guest;n.className='note';n.textContent='Mode invité : rien n’est enregistré, tout disparaît quand tu fermes ou recharges la page.';box.append(b,n)}};
const _enter=enter;enter=async function(u){const g=GUEST?MEM.slice():[];GUEST=false;await _enter(u);if(g.length&&confirm(`Ajouter les ${g.length} articles saisis en mode invité à ton compte ?`)){const ids=new Set(MEM.map(a=>a.id));MEM=MEM.concat(g.filter(a=>!ids.has(a.id)));flush();dash();stock()}};
const _s2=Store.set;Store.set=d=>{const r=_s2(d);if(GUEST)setSync(GMSG);return r};
ab.onclick=()=>usr?authView('account'):authView('login');
addEventListener('beforeunload',e=>{if(GUEST&&MEM.length){e.preventDefault();e.returnValue=''}});

/* ---- Budget / porte-monnaie, et une mise en page par onglet ---- */
const newBud=()=>({viseur:[],apports:[],depenses:[],plafond:0,ventes:true});let BUD=newBud(),bq=null,BLOADED=false,bTry=false;S.bs='Envie';
mk('budget',`<div id='b-out'></div>`);
const nbb=document.createElement('button');nbb.id='n-budget';nbb.textContent='Budget';nbb.onclick=()=>go('budget');navEl.appendChild(nbb);
const _go2=go;
go=function(p){
  const entering=document.body.dataset.pg!==p;
  stopCounters();
  document.body.dataset.pg=p;
  _go2(p);
  const b=p==='budget';
  $('p-budget').classList.toggle('on',b);
  $('n-budget').classList.toggle('on',b);
  if(b) budget();
  if($('n-watch')){ $('p-watch').classList.toggle('on',p==='watch'); $('n-watch').classList.toggle('on',p==='watch'); if(p==='watch') drawWatch(); }
  if(typeof teamPage !== 'undefined') teamPage(p);
  if(p==='verdict')verdict();
  if(entering)animateData(p);
};
const HERO={watch:['Tableau','Compare tes prochains achats avant de les ajouter au stock.'],dash:['Tableau de bord','Ta performance en un coup d’œil'],today:['Aujourd’hui','Ce qui demande ton attention'],verdict:['Verdict d’achat','Faut-il acheter à ce prix ?'],new:['Nouvel article','Ajoute ton article et prépare l’annonce'],stock:['Mon stock','Tout ce que tu as en vente'],budget:['Budget','Ton porte-monnaie et tes dépenses']};
document.querySelectorAll('.pg').forEach(s=>{const h=HERO[s.id.slice(2)];if(h){const d=document.createElement('div');d.className='hero';d.innerHTML=`<h1>${h[0]}</h1><p>${h[1]}</p>`;s.prepend(d)}});
document.body.dataset.pg='dash';
async function loadBud(){
  const owner=uid;
  if(!owner)return;
  const cacheKey='budget:'+owner;
  try{
    const r=await sb.from('reglages').select('data').eq('user_id',owner).maybeSingle();
    if(r.error)throw r.error;
    if(uid!==owner || budgetPending)return;
    BUD=Object.assign(newBud(),r.data?.data?.budget);
    budgetBaseline=structuredClone(BUD);BLOADED=true;
    idb('put',cacheKey,BUD).catch(()=>{});
  }catch{
    const cached=await idb('get',cacheKey).catch(()=>null);
    if(uid===owner && cached && !budgetPending){ BUD=Object.assign(newBud(),cached);budgetBaseline=structuredClone(BUD);BLOADED=true; }
  }
}
const _p2=pull;pull=async function(){const ok=await _p2();if(ok&&sb&&uid)await loadBud();if(document.body.dataset.pg==='watch')drawWatch();return ok};
const _lv=leave;leave=function(){clearTimeout(bq);budgetPending=0;BUD=newBud();BLOADED=false;_lv()};
const _g=guest;guest=function(){BUD=newBud();_g()};
let budgetPending=0, budgetVersion=0, budgetBaseline=newBud(), budgetQueue=Promise.resolve();
function mergeBudget(base,local,remote){
  const merged=Object.assign(newBud(),remote);
  for(const key of ['plafond','ventes','plafond_Gatien','plafond_Jules','ventes_Gatien','ventes_Jules']) if(local[key]!==base[key]) merged[key]=local[key];
  for(const key of ['apports','depenses','viseur']){
    const before=new Map(base[key].map(x=>[x.id,x]));
    const after=new Map(local[key].map(x=>[x.id,x]));
    const items=new Map(merged[key].map(x=>[x.id,x]));
    for(const id of before.keys()) if(!after.has(id)) items.delete(id);
    for(const [id,item] of after){
      if(!before.has(id)) items.set(id,item);
      else if(items.has(id)){
        const updated={...items.get(id)};
        for(const prop of Object.keys(item)) if(item[prop]!==before.get(id)[prop]) updated[prop]=item[prop];
        items.set(id,updated);
      }
    }
    merged[key]=[...items.values()];
  }
  return merged;
}
function bsave(){
  if(!uid){if(GUEST)setSync(GMSG);return;}
  if(!BLOADED)return;
  const owner=uid, version=++budgetVersion;
  budgetPending=version;setSync('Enregistrement…');clearTimeout(bq);
  bq=setTimeout(()=>{
    budgetQueue=budgetQueue.then(async()=>{
      if(uid!==owner || budgetPending!==version)return;
      const local=structuredClone(BUD),base=structuredClone(budgetBaseline);
      for(let attempt=0;attempt<5;attempt++){
        const table=()=>sb.from('reglages');
        const read=await table().select('data').eq('user_id',owner).maybeSingle();
        if(read.error)throw read.error;
        if(uid!==owner)return;
        const data=read.data?.data || {};
        const merged=mergeBudget(base,local,data.budget);
        const next={...data,budget:merged,fusiona_revision:crypto.randomUUID()};
        let write;
        if(read.data){
          const update=table().update({data:next}).eq('user_id',owner);
          write=await (data.fusiona_revision ? update.eq('data->>fusiona_revision',data.fusiona_revision) : update.is('data->>fusiona_revision',null)).select('user_id');
        }else write=await table().insert({user_id:owner,data:next}).select('user_id');
        if(write.error?.code==='23505')continue;
        if(write.error)throw write.error;
        if(!write.data.length)continue;
        if(uid!==owner)return;
        BUD=mergeBudget(local,BUD,merged);budgetBaseline=structuredClone(merged);
        idb('put','budget:'+owner,BUD).catch(()=>{});
        if(budgetPending===version){budgetPending=0;setSync('Enregistré ✓');if(document.body.dataset.pg==='watch')drawWatch();}
        return;
      }
      throw Error('Conflit de sauvegarde');
    }).catch(()=>{if(uid===owner)setSync('Budget non enregistré');});
  },300);
}
function bstat(){const V=workspaceStock().filter(a=>a.statut==='Vendu'),ap=teamContributions(teamMember)+BUD.apports.filter(inWorkspace).reduce((s,x)=>s+x.montant,0),ve=budgetOption('ventes')?V.reduce((s,a)=>s+a.vendu,0):0,sm=st=>BUD.depenses.filter(x=>inWorkspace(x) && x.statut===st).reduce((s,x)=>s+x.montant,0),rec=sm('Reçu'),route=sm('En route'),env=sm('Envie'),solde=ap+ve-rec-route;return{ap,ve,rec,route,env,solde,apres:solde-env}}
const isMois=t=>{const d=new Date(t),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()};
function budget(){const o=$('b-out');if(uid&&!BLOADED){if(bTry){bTry=false;o.innerHTML=`<div class='card vide'>Budget indisponible pour le moment (hors ligne ?).</div>`;return}bTry=true;loadBud().then(budget);return}
 const s=bstat(),D=BUD.depenses.filter(inWorkspace),cap=budgetOption('plafond'),mp=D.filter(x=>x.statut!=='Envie'&&isMois(x.date)).reduce((t,x)=>t+x.montant,0),
  item=x=>{const j=x.livraison?Math.ceil((new Date(x.livraison)-Date.now())/864e5):null,l=j===null||x.statut==='Reçu'?'':j<0?`<span class='bad'>en retard de ${-j} j</span>`:j===0?`<span class='ok'>aujourd’hui</span>`:`livraison dans ${j} j`,act={Envie:`<button class='btn p' onclick='bMove(${x.id},1)'>Acheté</button>`,'En route':`<button class='btn p' onclick='bMove(${x.id},2)'>Reçu</button>`,'Reçu':`<button class='btn p' onclick='bStock(${x.id})'>Créer l’article</button>`}[x.statut];return `<div class='bi'><b>${esc(x.label)}</b><div class='pr'>${eur(x.montant)}${x.plat?' · '+esc(x.plat):''}${l?' · '+l:''}</div><div class='ac' style='margin-top:10px'>${act}<button class='btn s p' onclick='bDel(${x.id})'>Suppr.</button></div></div>`},
  col=(t,k)=>{const L=D.filter(x=>x.statut===k);return `<div class='col'><h3>${t} · ${eur(L.reduce((a,x)=>a+x.montant,0))}</h3>${L.length?L.slice().reverse().map(item).join(''):`<div class='pr'>Rien ici</div>`}</div>`},
  ap=BUD.apports.filter(inWorkspace).slice().reverse().slice(0,5).map(x=>`<div class='hb' style='grid-template-columns:1fr auto auto'><span>${esc(x.label)}</span><span class='pr'>${eur(x.montant)}</span><button class='btn s p' onclick='bApDel(${x.id})' aria-label='Supprimer'>×</button></div>`).join('');
 o.innerHTML=`<div class='card'><h3>Solde disponible</h3><div class='big ${s.solde>=0?'ok':'bad'}'>${eur(s.solde)}</div><div class='pr'>Apports ${eur(s.ap)} + ventes ${eur(s.ve)} − dépensé ${eur(s.rec)} − en route ${eur(s.route)}</div><div class='row' style='margin-top:12px' id='b-v'></div></div>
 <div class='g3'><div class='card'><h3>Dépensé (reçu)</h3><div class='big' style='font-size:28px'>${eur(s.rec)}</div></div><div class='card'><h3>En route (payé, pas reçu)</h3><div class='big' style='font-size:28px'>${eur(s.route)}</div></div><div class='card'><h3>Envies</h3><div class='big' style='font-size:28px'>${eur(s.env)}</div><div class='pr'>Reste après envies : <b class='${s.apres>=0?'ok':'bad'}'>${eur(s.apres)}</b></div></div></div>
 <div class='card'><h3>Plafond de dépenses du mois</h3><div class='row' style='align-items:center'><input id='b-cap' type='number' min='0' value='${cap||''}' placeholder='ex : 100 (€)' style='max-width:200px' onchange='bCap(this.value)'><span class='pr'>${cap?eur(mp)+' dépensés sur '+eur(cap):'Facultatif : le site te prévient quand tu approches de ta limite'}</span></div><div class='bar'><i style='width:${cap?Math.min(100,mp/cap*100):0}%'></i></div></div>
 <div class='g2'><div class='card'><h2>Ajouter de l’argent</h2><label>Libellé</label><input id='b-al' placeholder='Apport, cadeau...'><label for='b-owner'>Apport de</label><select id='b-owner'><option>En commun</option><option>Gatien</option><option>Jules</option></select><label>Montant (€)</label><input id='b-am' type='number' step='0.01' min='0'><button class='btn' onclick='bApp()'>Ajouter</button><button class='btn s' onclick='openTeam(teamMember)'>Tous les apports</button><div style='margin-top:12px'>${ap}</div></div>
 <div class='card'><h2>Nouvelle dépense ou envie</h2><label>Article</label><input id='b-l'><label for='expense-owner'>Dépense de</label><select id='expense-owner'><option value=''>En commun</option><option>Gatien</option><option>Jules</option></select><div class='g2'><div><label>Montant (€)</label><input id='b-m' type='number' step='0.01' min='0'></div><div><label>Plateforme ou vendeur</label><input id='b-p'></div></div><label>Livraison prévue (facultatif)</label><input id='b-d' type='date'><span class='lb'>Statut</span><div class='row' id='b-s'></div><button class='btn' onclick='bAdd()'>Ajouter</button></div></div>
 <div class='kan'>${col('Envies','Envie')}${col('En route','En route')}${col('Reçus','Reçu')}</div>`;
 $('expense-owner').value=teamMember; $('expense-owner').disabled=!!teamMember; $('b-owner').value=teamMember || 'En commun'; $('b-owner').disabled=!!teamMember;
 chips('b-s',['Envie','En route','Reçu'],()=>S.bs,v=>S.bs=v);chips('b-v',['Inclure mes ventes','Sans mes ventes'],()=>budgetOption('ventes')?'Inclure mes ventes':'Sans mes ventes',v=>{BUD[budgetKey('ventes')]=v==='Inclure mes ventes';bsave();budget()})}
function uniqueExpenseId(){let id=Date.now();while(BUD.depenses.some(x=>x.id===id))id++;return id;}
function bAdd(){const l=$('b-l').value.trim(),m=parseFloat($('b-m').value);if(!l||!(m>0)){toast('Indique l’article et un montant');return}BUD.depenses.push({member:teamMember || $('expense-owner').value,id:uniqueExpenseId(),label:l,montant:m,plat:$('b-p').value.trim(),statut:S.bs,date:Date.now(),livraison:$('b-d').value||''});bsave();toast('Ajouté');budget()}
function bApp(){const l=$('b-al').value.trim()||'Apport',m=parseFloat($('b-am').value);if(!(m>0)){toast('Indique un montant');return}BUD.apports.push({member:teamMember,id:Date.now(),label:l,montant:m,date:Date.now()});bsave();budget()}
function bMove(id,k){const x=BUD.depenses.find(y=>y.id===id);x.statut=['Envie','En route','Reçu'][k];if(k===1)x.date=Date.now();bsave();budget()}
function bDel(id){if(!confirm('Supprimer cette ligne ?'))return;BUD.depenses=BUD.depenses.filter(y=>y.id!==id);bsave();budget()}
function bApDel(id){BUD.apports=BUD.apports.filter(y=>y.id!==id);bsave();budget()}
function bCap(v){BUD[budgetKey('plafond')]=parseFloat(v)||0;bsave();budget()}
function bStock(id){const x=BUD.depenses.find(y=>y.id===id);reset();setArticleOwner(x.member);$('nom').value=x.label;$('achat').value=x.montant;if(x.plat)$('source').value=x.plat;calc('achat');go('new')}
function overview(articles) {
  const now = new Date();
  const days = Number($('volume-period').value);
  const dayAt = offset => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const labels = Array.from({length:days}, (_,i) => dayAt(i-days+1));
  const daily = Array(days).fill(0);
  const byDay = new Map(labels.map((d,i) => [d.getTime(),i]));
  const today = Array(24).fill(0), yesterday = Array(24).fill(0);
  const statuses = ['En stock','En vente','Réservé','Vendu'];
  const counts = statuses.map(status => articles.filter(a => a.statut === status).length);
  for (const article of articles) {
    if (article.statut !== 'Vendu' || !article.vente || !Number.isFinite(article.vendu)) continue;
    const sale = new Date(article.vente);
    if (sale > now) continue;
    const hour = sale.getHours();
    const index = byDay.get(sale.setHours(0,0,0,0));
    if (index === undefined) continue;
    daily[index] += article.vendu;
    if (index === days-1) today[hour] += article.vendu;
    if (index === days-2) yesterday[hour] += article.vendu;
  }
  for (let i=1;i<24;i++) { today[i]+=today[i-1]; yesterday[i]+=yesterday[i-1]; }
  const maxHour = Math.max(1,...today,...yesterday);
  const hourlyPoints = values => values.map((v,i) => (3+i*714/23)+','+(100-v/maxHour*89)).join(' ');
  $('hour-chart').innerHTML = `<svg viewBox="0 0 720 116" role="img" aria-label="Ventes cumulées aujourd’hui et hier"><path d="M3 100H717" class="chart-grid"/><polyline points="${hourlyPoints(yesterday)}" class="chart-previous"/><polyline points="${hourlyPoints(today.slice(0,now.getHours()+1))}" class="chart-line"/><circle cx="${3+now.getHours()*714/23}" cy="${100-today[now.getHours()]/maxHour*89}" r="2" class="chart-point"/><text x="3" y="115">00:00</text><text x="717" y="115" text-anchor="end">23:00</text></svg>`;
  const width=600, left=8, right=520, top=18, bottom=177;
  const rawStep=Math.max(1,...daily)/4, magnitude=10**Math.floor(Math.log10(rawStep));
  const step=([1,2,2.5,5,10].find(n=>n*magnitude>=rawStep) || 10)*magnitude;
  const x=i=>left+i*(right-left)/(days-1), y=v=>bottom-v/(4*step)*(bottom-top);
  const grid=Array.from({length:5},(_,i)=>`<path class="chart-grid" d="M${left} ${y(i*step)}H${right}"/><text x="${right+9}" y="${y(i*step)+4}">${(i*step).toLocaleString('fr-FR',{notation:'compact'})} €</text>`).join('');
  const formatDate=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  $('volume-total').textContent=eur(daily.reduce((a,b)=>a+b,0));
  const box=$('volume-chart');
  box.innerHTML=`<svg viewBox="0 0 ${width} 201" tabindex="0" role="group" aria-label="Ventes par jour. Flèches gauche et droite pour consulter un montant.">${grid}<polyline class="chart-line" points="${daily.map((v,i)=>x(i)+','+y(v)).join(' ')}"/><circle class="chart-point" r="4" visibility="hidden"/><text x="${left}" y="198">${formatDate(labels[0])}</text><text x="${right}" y="198" text-anchor="end">${formatDate(now)}</text></svg><output hidden></output>`;
  const svg=box.firstElementChild, tip=box.lastElementChild, point=svg.querySelector('circle');
  let selected=days-1;
  function select(i) {
    selected=Math.max(0,Math.min(days-1,i));
    point.setAttribute('cx',x(selected)); point.setAttribute('cy',y(daily[selected]));
    point.setAttribute('visibility','visible');
    tip.hidden=false; tip.textContent=formatDate(labels[selected])+' · '+eur(daily[selected]);
    tip.style.left=(x(selected)/width*100)+'%'; tip.style.top=(y(daily[selected])/201*100)+'%';
  }
  function hide(){ tip.hidden=true; point.setAttribute('visibility','hidden'); }
  function track(event){ const rect=svg.getBoundingClientRect(); select(Math.round((((event.clientX-rect.left)/rect.width)*width-left)/(right-left)*(days-1))); }
  svg.onpointermove=track; svg.onpointerdown=track; svg.onpointerleave=hide;
  svg.onfocus=()=>select(selected); svg.onblur=hide;
  svg.onkeydown=e=>{ if (['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); select(selected+(e.key==='ArrowRight'?1:-1)); } };
  $('volume-period').onchange=()=>{stopCounters();overview(workspaceStock());animateData('dash');};
  const colors=['#8494ad','#397ad1','#41a2cd','#48aba2'];
  $('overview-stock').innerHTML='<div class="status-track">'+counts.map((n,i)=>`<i style="width:${100*n/(articles.length||1)}%;background:${colors[i]}"></i>`).join('')+'</div>'+statuses.map((s,i)=>`<p><i style="background:${colors[i]}"></i>${s}<b>${counts[i]}</b></p>`).join('');
}
dash();
const compactNav=matchMedia('(max-width: 1024px)');
const navToggle=$('nav-toggle');
function setMenu(open){
  navToggle.setAttribute('aria-expanded',String(open));
  navToggle.textContent=open?'× Fermer':'☰ Menu';
}
navToggle.onclick=()=>setMenu(navToggle.getAttribute('aria-expanded')!=='true');
compactNav.addEventListener('change',()=>setMenu(false));
document.addEventListener('click',event=>{
  if(compactNav.matches && (event.target.closest('#main-nav button') || !event.target.closest('header')))setMenu(false);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && navToggle.getAttribute('aria-expanded')==='true'){
    setMenu(false);navToggle.focus();
  }
});
