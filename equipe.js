let teamRows = [], teamAccount, teamChannel, teamRevision = 0;
let teamReady = false, teamStatus = '';
const teamMembers = ['Gatien','Jules'];
const teamTable = 'fusiona_equipe';
const teamBusy = new Set();

function teamContributions(member = '') {
  return teamRows.reduce((sum,row) => sum + (row.kind === 'money' && (!member || row.member === member) ? Number(row.cents) : 0),0) / 100;
}
function teamNode(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function teamAction(parent, text, action) {
  const button = teamNode('button',text);
  button.className = 'btn s p';
  button.onclick = action;
  parent.append(button);
}
function teamRender() {
  if(document.body.dataset.pg==='watch') drawWatch();
  $('team-state').textContent = teamStatus;
  $('team-heading').textContent = teamMember || 'En commun';
  $('team-total').textContent = eur(teamContributions(teamMember) + BUD.apports.filter(inWorkspace).reduce((s,a)=>s+a.montant,0));
  const rows = teamRows.filter(row => !teamMember || row.member === teamMember);
  const tasks = $('team-tasks'), ledger = $('team-ledger');
  tasks.replaceChildren(); ledger.replaceChildren();
  const finished=teamNode('details','');
  const finishedCount=rows.filter(row=>row.kind==='task' && row.done).length;
  finished.append(teamNode('summary','Terminées ('+finishedCount+')'));
  for (const row of rows) {
    const line = teamNode('div',''); line.className = 'team-line';
    const name = teamNode('strong',row.label);
    line.append(name);
    if (row.kind === 'money') {
      line.append(teamNode('span',(row.member || 'En commun')+' · '+eur(row.cents/100)));
      teamAction(line,'Retirer',()=>{if(confirm('Retirer cet apport du budget commun ?')) teamWrite('delete',row);});
      ledger.append(line); continue;
    }
    const article = Store.all().find(item=>String(item.id)===row.article);
    const detail = [row.member || 'À attribuer',row.done ? 'Terminée' : 'À faire'];
    if (article) detail.push(nm(article));
    line.append(teamNode('span',detail.join(' · ')));
    const actions=teamNode('div',''); actions.className='row';
    if (!row.done) {
      if (!row.member) for (const member of teamMembers) teamAction(actions,member,()=>teamWrite('update',row,{member}));
      else teamAction(actions,'Libérer',()=>teamWrite('update',row,{member:''}));
    }
    teamAction(actions,row.done?'Rouvrir':'Terminer',()=>teamWrite('update',row,{done:!row.done}));
    line.append(actions); (row.done?finished:tasks).append(line);
  }
  for(const entry of BUD.apports.filter(inWorkspace).slice().reverse()){
    const line=teamNode('div',''); line.className='team-line';
    line.append(teamNode('strong',entry.label || 'Apport'),teamNode('span',(entry.member || 'Non attribué')+' · '+eur(entry.montant)));
    ledger.append(line);
  }
  if(!tasks.children.length) tasks.append(teamNode('p',teamReady?'Aucune tâche pour le moment.':''));
  if(finishedCount) tasks.append(finished);
  for(const form of [$('task-form'),$('team-money')]) form.querySelector('button').disabled=!teamReady || teamBusy.has(form.id);
}
function teamPage(page) {
  $('p-team').classList.toggle('on',page==='team');
  $('n-team').classList.toggle('on',page==='team');
  for(const button of $('team-switch').children) button.setAttribute('aria-pressed',String(button.dataset.member===teamMember));
  const title=document.querySelector('#p-'+page+' .hero h1');
  if(title && page!=='team'){
    const label=HERO[page][0];
    title.textContent=teamMember ? label+' · '+teamMember : label;
  }
  if(page!=='team') return;
  const picker=$('task-article'), prior=picker.value;
  picker.replaceChildren(new Option('Aucun article associé',''),...workspaceStock().map(a=>new Option(nm(a),a.id)));
  picker.value=prior;
  teamRender();
}
function openTeam(member) {
  if(member!==teamMember) selectWorkspace(member);
  go('team');
  teamConnect();
}
function selectWorkspace(member){
  if(member && !workspaceNames.includes(member))return;
  const switched=teamMember!==member;
  teamMember=member;
  localStorage.setItem('fusiona-espace',member);
  if(S.edit && !workspaceStock().some(a=>a.id===S.edit)) reset();
  const current=Store.all().find(a=>a.id===S.edit);
  setArticleOwner(current?.member);
  for(const id of ['money-owner','task-owner']){
    $(id).value=member; $(id).disabled=!!member;
  }
  go(document.body.dataset.pg||'dash');
  if(switched)animateData(document.body.dataset.pg||'dash');
  teamConnect();
}
const teamNav=teamNode('button','Tâches et apports');
teamNav.id='n-team';
teamNav.onclick=()=>openTeam(teamMember);
navEl.append(teamNav);
for(const button of $('team-switch').children) button.onclick=()=>selectWorkspace(button.dataset.member);
setArticleOwner('');
for(const id of ['money-owner','task-owner']){$(id).value=teamMember;$(id).disabled=!!teamMember;}
teamPage(document.body.dataset.pg||'dash');

function updateBudgetView() {
  if(document.body.dataset.pg!=='budget' || !BLOADED && uid) return;
  const inputs=[...$('b-out').querySelectorAll('input,select')].map(el=>[el.id,el.value]);
  const focus=document.activeElement.id;
  budget();
  for(const [id,value] of inputs) if($(id)) $(id).value=value;
  if(focus && $(focus)) $(focus).focus({preventScroll:true});
}
async function teamRefresh() {
  const account=uid;
  if(!account || !sb || teamAccount!==account) return;
  const revision=++teamRevision;
  try {
    const rows=[];
    for(let offset=0;;offset+=500){
      const result=await sb.from(teamTable).select('*').eq('user_id',account).order('id').range(offset,offset+499);
      if(revision!==teamRevision || uid!==account) return;
      if(result.error) throw result.error;
      rows.push(...result.data);
      if(result.data.length<500) break;
    }
    rows.sort((a,b)=>b.created_at.localeCompare(a.created_at));
    const changed=JSON.stringify(rows)!==JSON.stringify(teamRows);
    teamReady=true; teamStatus='Tâches et apports du compte partagé.';
    teamRows=rows;
    if(changed) updateBudgetView();
  } catch(error) {
    if(revision!==teamRevision || uid!==account) return;
    teamReady=false; teamStatus=['PGRST205','42P01'].includes(error.code)
      ? 'Active les espaces avec le fichier equipe.sql dans Supabase.'
      : 'Synchronisation indisponible. Dernières données reçues affichées.';
  }
  teamRender();
}
function refreshStockViews() {
  const page=document.body.dataset.pg;
  if(page==='watch') drawWatch();
  if(page==='dash') dash();
  if(page==='stock') stock();
  if(page==='today') today();
  if(page==='budget') updateBudgetView();
  if(page==='team') teamPage('team');
}
function receiveStock(change) {
  const id=change.new?.id ?? change.old?.id;
  if(id==null) return;
  const index=MEM.findIndex(a=>String(a.id)===String(id));
  const prior=index<0 ? undefined : JSON.stringify(MEM[index]);
  if(prior!==SNAP[id]) return;
  if(change.eventType==='DELETE'){
    if(index<0) return;
    MEM.splice(index,1); delete SNAP[id];
  } else {
    const item=change.new.data;
    if(!item || String(item.id)!==String(id)) return;
    const snapshot=JSON.stringify(item);
    if(snapshot===prior) return;
    if(index<0) MEM.push(item); else MEM[index]=item;
    SNAP[id]=snapshot;
  }
  persist(); refreshStockViews();
}
function teamConnect() {
  const account=uid || (GUEST?'guest':null);
  if(teamAccount===account) return;
  teamAccount=account; teamRevision++;
  if(teamChannel) {sb.removeChannel(teamChannel); teamChannel=null;}
  teamRows=[]; teamReady=account==='guest';
  teamStatus=teamReady?'Mode invité · données temporaires.':'Chargement des espaces…';
  teamRender();
  if(uid && sb) {
    teamChannel=sb.channel('equipe-'+uid).on('postgres_changes',{event:'*',schema:'public',table:teamTable},teamRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'articles'},change=>{
        if(uid===account) receiveStock(change);
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'reglages',filter:'user_id=eq.'+account},change=>{
        if(uid!==account || budgetPending || !change.new?.data?.budget) return;
        BUD=Object.assign(newBud(),change.new.data.budget); budgetBaseline=structuredClone(BUD); BLOADED=true;
        updateBudgetView(); teamRender();
      })
      .subscribe(status=>{if(status==='SUBSCRIBED') teamRefresh();});
    teamRefresh();
  }
}
async function teamWrite(action,row,changes={},lock=row.id) {
  teamConnect();
  if(!teamReady){toast(teamStatus); return false;}
  if(teamBusy.has(lock)) return false;
  const account=teamAccount; teamBusy.add(lock); teamRender();
  try {
    if(uid) {
      let query;
      if(action==='insert') query=sb.from(teamTable).insert(row);
      else {
        query=action==='delete'?sb.from(teamTable).delete():sb.from(teamTable).update(changes);
        query=query.eq('user_id',uid).eq('id',row.id).eq('member',row.member).eq('done',row.done);
      }
      const result=await query.select('id');
      if(result.error) throw result.error;
      if(!result.data.length) {toast('Cette ligne a déjà été modifiée.'); await teamRefresh(); return false;}
      await teamRefresh();
    } else {
      if(action==='insert') teamRows.unshift({...row,done:false});
      if(action==='update') Object.assign(row,changes);
      if(action==='delete') teamRows=teamRows.filter(r=>r.id!==row.id);
      updateBudgetView();
    }
    return account===teamAccount;
  } catch { toast('Enregistrement impossible. Vérifie la connexion.'); return false; }
  finally {teamBusy.delete(lock);teamRender();}
}
$('task-form').onsubmit=async event=>{
  event.preventDefault(); const label=$('task-label').value.trim();
  if(!label) return;
  if(await teamWrite('insert',{id:crypto.randomUUID(),kind:'task',label,member:$('task-owner').value,article:$('task-article').value},{},'task-form')) $('task-label').value='';
};
async function addTeamMoney(amount,member,label,lock) {
  const cents=Math.round(amount*100);
  if(!Number.isSafeInteger(cents) || cents<1 || cents>9999999900){toast('Indique un montant valide.');return false;}
  return teamWrite('insert',{id:crypto.randomUUID(),kind:'money',member,label:label.trim()||'Apport',cents},{},lock);
}
$('team-money').onsubmit=async event=>{
  event.preventDefault();
  if(await addTeamMoney($('money-value').valueAsNumber,$('money-owner').value,$('money-label').value,'team-money')){
    $('money-value').value=''; $('money-label').value='';
  }
};
const legacyAddMoney=bApp;
bApp=async function(){
  teamConnect();
  const member=$('b-owner').value;
  if(member==='En commun' && !teamReady) {legacyAddMoney();return;}
  if(await addTeamMoney($('b-am').valueAsNumber,member==='En commun'?'':member,$('b-al').value,'budget-money')){
    $('b-am').value=''; $('b-al').value='';
  }
};
const enterTeamAccount=enter;
enter=async function(user){await enterTeamAccount(user);teamConnect();};
const leaveTeamAccount=leave;
leave=function(){leaveTeamAccount();teamConnect();};
const enterGuestTeam=guest;
guest=function(){enterGuestTeam();teamConnect();};
document.addEventListener('visibilitychange',()=>{if(!document.hidden){teamConnect();teamRefresh();}});
setInterval(()=>{if(!document.hidden){teamConnect();teamRefresh();}},15000);
const watchNav = teamNode('button','Tableau');
watchNav.id = 'n-watch';
watchNav.onclick = () => go('watch');
navEl.append(watchNav);

const watchSeasons = {
  'Mi-saison': ['Hiver et été','Printemps et automne'],
  'Manteau ou maille chaude': ['Printemps et été','Hiver'],
  'Tenue d’été': ['Automne et hiver','Été'],
  'Toutes saisons': ['Toute l’année','Aucune en particulier']
};

function planWatch(rows, balance) {
  const ranked = rows.map(row => {
    const gain = row.sell - row.buy;
    const roi = row.buy ? gain / row.buy : Infinity;
    return {...row, gain, roi, eligible: gain > 0 && row.buy <= balance};
  }).sort((a,b) => Number(b.eligible)-Number(a.eligible) || b.roi-a.roi || b.gain-a.gain || a.label.localeCompare(b.label,'fr'));
  let remaining = balance;
  let priority = 0;
  for (const item of ranked) {
    if (item.gain <= 0) item.reason = 'Sans bénéfice';
    else if (item.buy > balance) item.reason = 'Hors budget';
    else if (item.buy > remaining) item.reason = 'À reporter';
    else {
      remaining -= item.buy;
      item.priority = ++priority;
      item.reason = 'Priorité ' + priority;
    }
  }
  return ranked;
}

function drawWatch() {
  const form = $('watch-form');
  const ready = !uid || BLOADED;
  form.elements.member.value = teamMember || (form.dataset.scope === teamMember ? form.elements.member.value : '');
  form.dataset.scope = teamMember;
  form.elements.member.disabled = !!teamMember;
  form.querySelector('button').disabled = !ready;
  const balance = Math.round(bstat().solde * 100);
  const budgetKnown = ready && (!uid || teamReady);
  $('watch-balance').textContent = budgetKnown ? eur(balance / 100) : 'Indisponible';
  const rows = planWatch(BUD.viseur.filter(inWorkspace), balance);
  const first = rows.find(x => x.priority === 1);
  $('watch-first').textContent = budgetKnown ? (first?.label || 'Aucun achat prioritaire') : 'Budget à synchroniser';
  const list = $('watch-list');
  const signature = JSON.stringify([teamMember,ready,budgetKnown,rows]);
  if(list.dataset.signature === signature) return;
  list.dataset.signature = signature;
  list.replaceChildren();
  const table = document.createElement('table');
  const headers = ['Article','Achat','Revente','Gain estimé','Rendement','Saison d’achat','Décision',''];
  const header = table.createTHead().insertRow();
  for (const title of headers) {
    const th = teamNode('th',title || 'Action');
    th.scope = 'col'; header.append(th);
  }
  const body = table.createTBody();
  if(!rows.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = headers.length;
    cell.className = 'watch-empty';
    cell.textContent = ready ? 'Ajoute ton premier article pour comparer son prix et sa rentabilité.' : 'Chargement des articles…';
  }
  for (const item of rows) {
    const tr = body.insertRow();
    const seasons = watchSeasons[item.kind] || watchSeasons['Toutes saisons'];
    const values = [item.label,eur(item.buy/100),eur(item.sell/100),eur(item.gain/100),
      item.buy ? Math.round(item.roi*100)+' %' : 'Coût nul', seasons[0], budgetKnown ? item.reason : 'En attente'];
    values.forEach((value,i) => {
      const cell = tr.insertCell();
      cell.dataset.label = headers[i];
      cell.append(teamNode('span',value));
      if(i===0 || i===5) cell.append(teamNode('small',i===0 ? item.member || 'En commun' : 'À éviter : '+seasons[1]));
      if(i===6 && item.priority && budgetKnown) cell.className='watch-priority';
    });
    teamAction(tr.insertCell(),'Retirer',()=>{
      if(!confirm('Retirer cet article du viseur ?')) return;
      BUD.viseur=BUD.viseur.filter(x=>x.id!==item.id);
      bsave(); drawWatch();
    });
  }
  list.append(table);
}

$('watch-form').onsubmit = event => {
  event.preventDefault();
  const form = event.currentTarget;
  const label = form.elements.article.value.trim();
  if (!label || (uid && !BLOADED)) return;
  BUD.viseur.push({id:crypto.randomUUID(),member:teamMember || form.elements.member.value,label,kind:form.elements.kind.value,
    buy:Math.round(form.elements.buy.valueAsNumber*100),sell:Math.round(form.elements.sell.valueAsNumber*100)});
  bsave(); form.reset(); drawWatch(); animateData("watch");
};
