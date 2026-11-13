(() => {
  'use strict';
  let deferredInstall = null;
  let registration = null;
  const byId = id => document.getElementById(id);
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const labels = {
    en: {
      title: 'Install MyTrip on your phone',
      description: 'Add MyTrip to your Home Screen for quick access and a full-screen app experience.',
      install: 'Add to Home Screen', installed: 'MyTrip is running as an installed app.',
      ios: 'On iPhone/iPad: open this page in Safari, tap Share, then choose Add to Home Screen and Open as Web App.',
      android: 'On Android: open this page in Chrome, tap ⋮, then Install app or Add to Home screen.',
      desktop: 'Open this link on your phone to install MyTrip. On supported desktop browsers, use the install icon in the address bar.',
      offline: 'You are offline. Sign-in and loading a trip require an internet connection. If your trip is already open, new expenses can be queued until you reconnect.',
      insecure: 'Installation requires HTTPS. Upload the complete app folder to a secure web host.',
      update: 'A new version is ready. Finish saving before updating.', reload: 'Update app',
      queue: 'You have offline expenses waiting to sync. Connect to the internet and sync them before updating.',
      confirm: 'Update MyTrip now? Finish saving your current changes first.'
    },
    th: {
      title: 'ติดตั้ง MyTrip บนโทรศัพท์',
      description: 'เพิ่ม MyTrip ไว้บนหน้าจอหลัก เพื่อเปิดใช้งานสะดวกแบบเต็มจอ',
      install: 'เพิ่มไปยังหน้าจอโฮม', installed: 'กำลังใช้งาน MyTrip แบบแอปที่ติดตั้งแล้ว',
      ios: 'iPhone/iPad: เปิดหน้านี้ด้วย Safari กดแชร์ แล้วเลือกเพิ่มไปยังหน้าจอโฮม และเปิดเป็นเว็บแอป',
      android: 'Android: เปิดหน้านี้ด้วย Chrome กด ⋮ แล้วเลือกติดตั้งแอป หรือเพิ่มลงในหน้าจอหลัก',
      desktop: 'เปิดลิงก์นี้บนโทรศัพท์เพื่อติดตั้ง MyTrip เบราว์เซอร์คอมพิวเตอร์ที่รองรับจะมีไอคอนติดตั้งในแถบที่อยู่',
      offline: 'คุณกำลังออฟไลน์ การเข้าสู่ระบบและโหลดทริปต้องใช้อินเทอร์เน็ต หากเปิดทริปไว้แล้ว สามารถบันทึกรายจ่ายลงคิวเพื่อซิงก์เมื่อออนไลน์ได้',
      insecure: 'การติดตั้งต้องใช้ HTTPS กรุณานำโฟลเดอร์แอปทั้งชุดขึ้นโฮสต์ที่รองรับ',
      update: 'มีเวอร์ชันใหม่พร้อมแล้ว กรุณาบันทึกข้อมูลให้เสร็จก่อนอัปเดต', reload: 'อัปเดตแอป',
      queue: 'ยังมีรายจ่ายออฟไลน์รอซิงก์ กรุณาต่ออินเทอร์เน็ตและซิงก์ให้เสร็จก่อนอัปเดต',
      confirm: 'อัปเดต MyTrip ตอนนี้หรือไม่? กรุณาบันทึกข้อมูลที่กำลังกรอกให้เสร็จก่อน'
    }
  };
  function language() { return document.documentElement.lang === 'th' ? 'th' : 'en'; }
  function refresh() {
    const text = labels[language()];
    document.querySelectorAll('[data-pwa-text]').forEach(element => {
      element.textContent = text[element.dataset.pwaText] || '';
    });
    const isInstalled = installed();
    if (byId('pwa-installed')) byId('pwa-installed').hidden = !isInstalled;
    if (byId('pwa-install-button')) byId('pwa-install-button').hidden = isInstalled;
    if (byId('pwa-install-help')) byId('pwa-install-help').textContent = isInstalled ? '' :
      !window.isSecureContext ? text.insecure : ios() ? text.ios : /Android/.test(navigator.userAgent) ? text.android : text.desktop;
    if (byId('pwa-connection')) {
      byId('pwa-connection').hidden = navigator.onLine;
      byId('pwa-connection').textContent = text.offline;
    }
  }
  window.refreshPwaLanguage = refresh;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredInstall = event; refresh();
  });
  window.addEventListener('appinstalled', () => { deferredInstall = null; refresh(); });
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  byId('pwa-install-button')?.addEventListener('click', async () => {
    if (!deferredInstall) {
      byId('pwa-install-help')?.scrollIntoView({behavior:'smooth',block:'center'});
      byId('pwa-install-help')?.setAttribute('role','status');
      return;
    }
    const prompt = deferredInstall; deferredInstall = null;
    await prompt.prompt(); await prompt.userChoice; refresh();
  });
  byId('pwa-update-button')?.addEventListener('click', () => {
    const text = labels[language()];
    if (window.getFirestoreQueue?.().length) return alert(text.queue);
    if (!confirm(text.confirm)) return;
    registration?.waiting?.postMessage({type:'ACTIVATE_UPDATE'});
  });
  let reloading = false;
  if ('serviceWorker' in navigator && window.isSecureContext) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloading) { reloading = true; location.reload(); }
    });
    window.addEventListener('load', async () => {
      try {
        registration = await navigator.serviceWorker.register('./sw.js', {scope:'./',updateViaCache:'none'});
        const showUpdate = () => { if (registration.waiting && navigator.serviceWorker.controller) byId('pwa-update').hidden = false; };
        showUpdate();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => { if (worker.state === 'installed') showUpdate(); });
        });
      } catch (error) { console.warn('MyTrip installation is unavailable:', error); }
    });
  }
  refresh();
})();
