self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function badge(count){try{if(Number.isSafeInteger(count)&&count>=0){if(count)await self.navigator.setAppBadge?.(count);else await self.navigator.clearAppBadge?.();}else await self.navigator.setAppBadge?.();}catch{}}
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let data;try{data=event.data?.json();}catch{}
 const appointment=data?.kind==='reminder24'||data?.kind==='reminder3';
 const body=typeof data?.body==='string'?data.body.slice(0,300):'لديكِ إشعار جديد في صالوناتي. افتحي التطبيق للاطلاع عليه.';
 await self.registration.showNotification('صالوناتي',{body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:typeof data?.tag==='string'?data.tag:'salonati-updates',data:{url:appointment?'/?bookings=1':'/?notifications=1'}});
 await badge(data?.unread);
})()));
self.addEventListener('message',event=>{if(event.data?.type==='salonati-badge')event.waitUntil(badge(event.data.count));if(event.data?.type==='salonati-clear-notifications')event.waitUntil((async()=>{await badge(0);for(const n of await self.registration.getNotifications())n.close();})());});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  const path=event.notification.data?.url==='/?bookings=1'?'/?bookings=1':'/?notifications=1',url=new URL(path,self.location.origin).href;
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const tab of tabs)if(new URL(tab.url).origin===self.location.origin){await tab.navigate(url);return tab.focus();}
  return self.clients.openWindow(url);
 })());
});
