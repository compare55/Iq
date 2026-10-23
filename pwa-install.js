(() => {
  if (window.__jiowinPwaControlsAdded) return;
  window.__jiowinPwaControlsAdded = true;
  let installPrompt = null;
  const style = document.createElement('style');
  style.textContent = `#jiowin-app-actions{position:fixed;z-index:9998;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:calc(100vw - 24px)}.jiowin-app-btn{border:1px solid #d6aa39;border-radius:999px;background:#071b12;color:#fff;padding:10px 14px;font:700 13px system-ui,sans-serif;box-shadow:0 3px 14px #0005;text-decoration:none;cursor:pointer}.jiowin-app-btn.primary{background:#d6aa39;color:#071b12}.jiowin-app-btn[hidden]{display:none!important}@media(min-width:700px){#jiowin-app-actions{right:18px;bottom:18px}}`;
  document.head.appendChild(style);
  const wrap = document.createElement('div'); wrap.id = 'jiowin-app-actions';
  const install = document.createElement('button'); install.type = 'button'; install.className = 'jiowin-app-btn primary'; install.textContent = '⬇ Install App'; install.hidden = true;
  const apk = document.createElement('a'); apk.className = 'jiowin-app-btn'; apk.href = '/apk-download.html'; apk.textContent = '🤖 Android APK';
  wrap.append(install, apk); document.body.appendChild(wrap);
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const refresh = () => { install.hidden = standalone() || (!installPrompt && !isIOS()); if (standalone()) install.textContent = '✓ App Installed'; else install.textContent = isIOS() ? '＋ Add to Home Screen' : '⬇ Install App'; };
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; refresh(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; refresh(); });
  install.addEventListener('click', async () => {
    if (standalone()) return;
    if (installPrompt) { installPrompt.prompt(); try { await installPrompt.userChoice; } finally { installPrompt = null; refresh(); } return; }
    if (isIOS()) alert('iPhone par Share button dabayein, phir “Add to Home Screen” choose karein.');
    else alert('Install option abhi browser mein available nahi hai. Chrome menu mein “Install app” ya “Add to Home screen” dekhein.');
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Jiowin offline support could not register:', err));
  refresh();
})();
