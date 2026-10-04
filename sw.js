const CACHE='ap-cache-v2';
const SHELL=['./','./index.html','./manifest.json','./icons/icon.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

// مكتبات ثابتة بإصدار محدد (آمن تخزينها): Firebase SDK والخطوط
const STATIC_HOSTS=['www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net'];

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  // ✅ أي طلب لخدمات Firebase/Google الحية (Firestore, Auth...) يذهب للشبكة مباشرة بلا تخزين
  // السبب: تخزينها كان قد يُرجع بيانات قديمة (تصاميم محذوفة تظهر على الهاتف)
  const sameOrigin=url.origin===self.location.origin;
  const isStatic=STATIC_HOSTS.includes(url.hostname)&&!/firestore|identitytoolkit|securetoken/.test(url.hostname);
  if(!sameOrigin&&!isStatic)return;

  // صفحات الموقع وملفاته: الشبكة أولاً (تحديث فوري) ثم النسخة المحفوظة عند انقطاع الإنترنت
  if(sameOrigin){
    e.respondWith(
      fetch(req,{cache:'no-cache'}).then(r=>{
        if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req.mode==='navigate'?'./index.html':req,copy));}
        return r;
      }).catch(()=>caches.match(req.mode==='navigate'?'./index.html':req).then(h=>h||caches.match('./index.html')))
    );
    return;
  }

  // المكتبات والخطوط: من التخزين فوراً مع تحديثها في الخلفية
  e.respondWith(caches.match(req).then(hit=>{
    const fres=fetch(req).then(r=>{if(r.ok||r.type==='opaque'){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return r;}).catch(()=>hit);
    return hit||fres;
  }));
});
