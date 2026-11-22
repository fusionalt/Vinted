const C='fusiona-v1',SHELL=['./','index.html','style.css','app.js','manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.hostname.endsWith('supabase.co'))return;
  const keep=x=>{const y=x.clone();caches.open(C).then(c=>c.put(r,y));return x};
  e.respondWith(u.origin===location.origin
    ? fetch(r).then(keep).catch(()=>caches.match(r).then(m=>m||caches.match('index.html')))
    : caches.match(r).then(m=>m||fetch(r).then(keep)));
});
