let teamMember = '';
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
  $('team-state').textContent = teamStatus;
  $('team-heading').textContent = teamMember || 'En commun';
  $('team-total').textContent = eur(teamContributions(teamMember) + (teamMember ? 0 : BUD.apports.reduce((s,a)=>s+a.montant,0)));
  const rows = teamRows.filter(row => !teamMember || row.member === teamMember);
  const tasks = $('team-tasks'), ledger = $('team-ledger');
  tasks.replaceChildren(); ledger.replaceChildren();
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
    line.append(actions); tasks.append(line);
  }
  if(!teamMember) for(const entry of BUD.apports.slice().reverse()){
    const line=teamNode('div',''); line.className='team-line';
    line.append(teamNode('strong',entry.label || 'Apport'),teamNode('span','Non attribué · '+eur(entry.montant)));
    ledger.append(line);
  }
  if(!tasks.children.length) tasks.append(teamNode('p',teamReady?'Aucune tâche pour le moment.':''));
  for(const form of [$('task-form'),$('team-money')]) form.querySelector('button').disabled=!teamReady || teamBusy.has(form.id);
}
function teamPage(page) {
  $('p-team').classList.toggle('on',page==='team');
  for(const button of $('team-switch').children) button.setAttribute('aria-pressed',String(page==='team' && button.dataset.member===teamMember));
  if(page!=='team') return;
  const picker=$('task-article'), prior=picker.value;
  picker.replaceChildren(new Option('Aucun article associé',''),...Store.all().map(a=>new Option(nm(a),a.id)));
  picker.value=prior;
  teamRender();
}
function openTeam(member) {
  teamMember=member;
  $('task-owner').value=member; $('money-owner').value=member;
  go('team');
  teamConnect();
}
for(const button of $('team-switch').children) button.onclick=()=>openTeam(button.dataset.member);

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
