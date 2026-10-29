(() => {
  'use strict';
  if (window.__foodnatiLoginV5) return;
  window.__foodnatiLoginV5 = true;
  const KEY = 'foodnati_partner_demo_session';
  const FIREBASE_CONFIG_URL = 'https://cezooooo-backend.onrender.com/firebase-config';
  let auth = null;
  let firebaseReady = null;
  let confirmation = null;
  let captcha = null;
  let sending = false;
  let verifying = false;
  let otpRequest = 0;
  function loadFirebaseScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        if (window.firebase && window.firebase.auth) return resolve();
      }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Firebase SDK could not load'));
      document.head.appendChild(s);
    });
  }
  async function ensureFirebase() {
    if (auth) return auth;
    if (!firebaseReady) firebaseReady = (async () => {
      if (!window.firebase || !window.firebase.initializeApp) await loadFirebaseScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
      if (!window.firebase.auth) await loadFirebaseScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js');
      const r = await fetch(FIREBASE_CONFIG_URL, {cache:'no-store'});
      if (!r.ok) throw new Error('Firebase config unavailable (' + r.status + ') at ' + FIREBASE_CONFIG_URL + '. Check OTP backend deployment.');
      const cfg = await r.json();
      if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId) throw new Error('Invalid Firebase configuration');
      const existing = firebase.apps.find(a => a.options.projectId === cfg.projectId);
      const app = existing || firebase.initializeApp(cfg, 'foodnati-partner-otp');
      auth = app.auth();
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      auth.onAuthStateChanged(user => {
        if (!user) { clearSession(); if (document.body) updateNavbarSafe(); return; }
        const phone = user.phoneNumber || '';
        if (/^\+91[6-9]\d{9}$/.test(phone)) saveSession(phone.slice(3));
        updateNavbarSafe();
      });
      return auth;
    })().catch(e => { firebaseReady = null; throw e; });
    return firebaseReady;
  }
  function updateNavbarSafe() { if (typeof window.__foodnatiRefreshNavbar === 'function') window.__foodnatiRefreshNavbar(); }
  async function getPartnerToken() {
    const a = await ensureFirebase();
    if (typeof a.authStateReady === 'function') { await a.authStateReady(); } else if (!a.currentUser) { await new Promise(resolve => { const unsubscribe = a.onAuthStateChanged(() => { unsubscribe(); resolve(); }, () => { unsubscribe(); resolve(); }); }); }
    const user = a.currentUser;
    if (!user || !/^\+91[6-9]\d{9}$/.test(user.phoneNumber || '')) throw new Error('Please log in using real SMS OTP.');
    return user.getIdToken();
  }
  window.foodnatiGetPartnerToken = getPartnerToken;
  function resetCaptcha() {
    otpRequest++;
    confirmation = null;
    if (captcha) { try { captcha.clear(); } catch(e) {} captcha = null; }
    const old = document.getElementById('fnv2-recaptcha');
    if (old) { const replacement = document.createElement('div'); replacement.id = 'fnv2-recaptcha'; old.replaceWith(replacement); }
  }
  function otpError(err) {
    const code = String(err?.code || '');
    if (code.includes('too-many-requests') || code.includes('quota-exceeded')) return 'Too many OTP requests. Please try later.';
    if (code.includes('unauthorized-domain')) return 'Add this website to Firebase authorized domains.';
    if (code.includes('invalid-phone-number')) return 'Invalid mobile number.';
    if (code.includes('invalid-verification-code')) return 'Invalid OTP. Please try again.';
    if (code.includes('session-expired') || code.includes('code-expired')) return 'OTP expired. Please request a new OTP.';
    return err?.message || 'OTP service error. Please retry.';
  }
  let mobile = '';
  let open = false;
  let previousFocus = null;

  function session() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && /^[6-9]\d{9}$/.test(String(s.mobile)) && s.verified === true ? s : null; } catch { return null; }
  }
  function saveSession(number) { try { localStorage.setItem(KEY, JSON.stringify({mobile:number, verified:true})); return !!session(); } catch (err) { console.error('Foodnati: session could not be saved', err); return false; } }
  function clearSession() { try { localStorage.removeItem(KEY); } catch {} }
  function init() {
    const style = document.createElement('style');
    style.textContent = `
      .fnv2-modal{display:none;position:fixed;inset:0;z-index:2147483645;background:rgba(18,28,45,.62);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:18px;font-family:Arial,sans-serif}
      .fnv2-modal.is-open{display:flex}.fnv2-card{position:relative;background:white;border-radius:20px;padding:34px 26px 28px;width:min(100%,405px);box-shadow:0 22px 70px #0003;box-sizing:border-box}
      .fnv2-card *{box-sizing:border-box}.fnv2-brand{font-size:30px;font-weight:800;color:#17243B;margin:0 0 27px;font-family:Fredoka,Arial,sans-serif}
      .fnv2-close{position:absolute;right:17px;top:15px;border:0;background:#f1f2f5;width:32px;height:32px;border-radius:50%;font-size:23px;cursor:pointer}
      .fnv2-label{font-size:14px;font-weight:700;color:#17243B;display:block;margin-bottom:10px}
      .fnv2-field{height:52px;border:1.5px solid #dfe2e8;border-radius:11px;display:flex;align-items:center;overflow:hidden}
      .fnv2-field:focus-within{border-color:#17243B}.fnv2-prefix{padding:0 13px;border-right:1px solid #ddd;font-size:14px;font-weight:700}
      .fnv2-input{min-width:0;flex:1;width:100%;height:100%;border:0;outline:0;padding:0 14px;font-size:16px;background:transparent;color:#17243B}
      .fnv2-otp{text-align:center;letter-spacing:8px;font-size:24px}.fnv2-btn{width:100%;height:49px;border:0;border-radius:10px;background:#17243B;color:white;font-size:15px;font-weight:700;cursor:pointer;margin-top:17px}
      .fnv2-error{min-height:18px;color:#d72d54;font-size:12px;margin-top:8px}.fnv2-title{color:#17243B;font-size:22px;margin:0 0 10px}.fnv2-desc{color:#707988;font-size:13px;line-height:1.5;margin:0 0 20px}
      .fnv2-back{background:none;border:0;color:#17243B;font-weight:700;cursor:pointer;margin-top:17px}.fnv2-result{text-align:center;padding:10px 0}.fnv2-check{display:grid;place-items:center;margin:0 auto 18px;width:62px;height:62px;border-radius:50%;background:#e8f8ed;color:#17a34a;font-size:33px}
      .fnv2-profile-wrap{display:inline-flex;align-items:center;position:relative;vertical-align:middle}
      .fnv2-profile-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;height:auto!important;min-width:0!important;min-height:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:#17243B!important;cursor:pointer!important;text-decoration:none!important;line-height:1!important;box-shadow:none!important}
      .fnv2-dropdown{position:absolute;right:0;top:calc(100% + 12px);z-index:2147483644;background:white;width:240px;border:1px solid #edf0f3;border-radius:14px;box-shadow:0 14px 38px #17243b25;padding:9px;font-family:Arial,sans-serif;text-align:left}
      .fnv2-dropdown[hidden]{display:none!important}.fnv2-menu-heading{padding:10px 11px 12px;border-bottom:1px solid #eee;margin-bottom:5px;color:#17243B;font-weight:700;font-size:14px}
      .fnv2-menu-mobile{font-size:12px;color:#79818e;margin-top:5px;font-weight:400}.fnv2-menu-item{display:flex;width:100%;align-items:center;padding:12px 11px;gap:9px;text-align:left;border:0;background:white;border-radius:8px;color:#17243B;font-size:14px;cursor:pointer;text-decoration:none}
      .fnv2-menu-item:hover{background:#f4f6f9}.fnv2-menu-logout{color:#17243B}.fnv2-hidden{display:none!important}
      .fn-profile-img{display:block;width:42px;height:42px;object-fit:contain;border-radius:0}
      #partnerProfileBtn{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;height:auto!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;cursor:pointer!important}
      #partnerProfileBtn .fn-profile-img{width:42px;height:42px;border-radius:0!important}
      #partnerDropdown i,#partnerDropdown svg,.fnv2-dropdown i,.fnv2-dropdown svg{display:none!important}
      #partnerDropdown a,#partnerDropdown button{color:#17243B!important;gap:0!important}
      body.fnv2-lock{overflow:hidden}
    `;
    document.head.appendChild(style);
    const modal = document.createElement('div');
    modal.className = 'fnv2-modal';
    modal.innerHTML = '<div class="fnv2-card" role="dialog" aria-modal="true" aria-label="Foodnati partner login"><button type="button" class="fnv2-close" aria-label="Close">&times;</button><div class="fnv2-brand">Foodnati</div><div class="fnv2-content"></div></div>';
    document.body.appendChild(modal);
    const captchaHost = document.createElement('div'); captchaHost.id = 'fnv2-recaptcha'; document.body.appendChild(captchaHost);
    const content = modal.querySelector('.fnv2-content');
    function loginElements() { return [...document.querySelectorAll('#partnerLoginBtn, .partner-login')].filter(el => !el.closest('.fnv2-modal,.fnv2-profile-wrap')); }
    window.__foodnatiRefreshNavbar = updateNavbar;
    function updateNavbar() {
      const activeSession = session();
      const logged = !!activeSession;
      // Preserve original hero CTA behavior with verified Firebase OTP login.
      document.querySelectorAll('#partnerRegisterBtn, .partner-register').forEach(btn => {
        if (!btn.dataset.fnOriginalLabel) btn.dataset.fnOriginalLabel = btn.textContent.trim() || 'Register your restaurant';
        btn.textContent = logged ? 'Continue Application' : btn.dataset.fnOriginalLabel;
        btn.setAttribute('aria-label', btn.textContent);
      });
      const staticProfile = document.getElementById('partnerProfile');
      const staticDropdown = document.getElementById('partnerDropdown');
      const staticProfileBtn = document.getElementById('partnerProfileBtn');
      const staticLogout = document.getElementById('partnerLogoutBtn');
      // The page may already contain profile/dropdown HTML. Use it rather than creating duplicates.
      document.querySelectorAll('.fnv2-profile-wrap').forEach(el => el.remove());
      loginElements().forEach(btn => {
        btn.classList.toggle('fnv2-hidden', logged);
        btn.hidden = logged;
        btn.style.setProperty('display', logged ? 'none' : '', logged ? 'important' : '');
        if (logged && !staticProfile) {
          const wrapper = document.createElement('span');
          wrapper.className = 'fnv2-profile-wrap';
          wrapper.innerHTML = `<button type="button" class="fnv2-profile-button" aria-label="Profile" aria-expanded="false"><img src="profile.png" alt="Profile" class="fn-profile-img"></button><div class="fnv2-dropdown" hidden><div class="fnv2-menu-heading">Restaurant Partner<div class="fnv2-menu-mobile">+91 ${activeSession.mobile}</div></div><button type="button" class="fnv2-menu-item fnv2-dashboard">Restaurant Partner</button><button type="button" class="fnv2-menu-item fnv2-menu-logout">Logout</button></div>`;
          btn.insertAdjacentElement('afterend', wrapper);
          const profile = wrapper.querySelector('.fnv2-profile-button');
          const dropdown = wrapper.querySelector('.fnv2-dropdown');
          profile.addEventListener('click', e => { e.stopPropagation(); dropdown.hidden = !dropdown.hidden; });
          wrapper.querySelector('.fnv2-menu-logout').addEventListener('click', logout);
          wrapper.querySelector('.fnv2-dashboard').addEventListener('click', () => { dropdown.hidden = true; window.dispatchEvent(new CustomEvent('foodnati:partner-profile', {detail:{mobile:session()?.mobile || ''}})); });
        }
      });
      if (staticProfile) {
        // Use the requested image even when the HTML already includes an icon.
        if (staticProfileBtn && !staticProfileBtn.querySelector('.fn-profile-img')) {
          staticProfileBtn.innerHTML = '<img src="profile.png" alt="Profile" class="fn-profile-img">';
        }
        if (staticDropdown) staticDropdown.querySelectorAll('i,svg').forEach(el => el.remove());
        staticProfile.hidden = !logged;
        staticProfile.style.setProperty('display', logged ? 'inline-flex' : 'none', 'important');
        if (staticDropdown) staticDropdown.hidden = true;
        if (staticProfileBtn && !staticProfileBtn.dataset.fnv2Bound) {
          staticProfileBtn.dataset.fnv2Bound = '1';
          staticProfileBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (staticDropdown) staticDropdown.hidden = !staticDropdown.hidden; });
        }
        if (staticLogout && !staticLogout.dataset.fnv2Bound) {
          staticLogout.dataset.fnv2Bound = '1';
          staticLogout.addEventListener('click', logout);
        }
        const dashboard = document.getElementById('restaurantDashboard');
        if (dashboard && !dashboard.dataset.fnv2Bound) {
          dashboard.dataset.fnv2Bound = '1';
          dashboard.addEventListener('click', e => { e.preventDefault(); if (staticDropdown) staticDropdown.hidden = true; window.dispatchEvent(new CustomEvent('foodnati:partner-profile', {detail:{mobile:session()?.mobile || ''}})); });
        }
      }
    }
    async function logout() {
      resetCaptcha();
      try { if (auth) await auth.signOut(); } catch(e) { console.warn(e); }
      clearSession(); updateNavbar();
      window.dispatchEvent(new CustomEvent('foodnati:logout'));
    }
    function closePopup() { resetCaptcha(); open = false; modal.classList.remove('is-open'); document.body.classList.remove('fnv2-lock'); if (previousFocus && previousFocus.isConnected) previousFocus.focus(); }
    function openPopup() { previousFocus = document.activeElement; mobile=''; resetCaptcha(); showMobile(); open=true; modal.classList.add('is-open'); document.body.classList.add('fnv2-lock'); }
    function showMobile() {
      content.innerHTML = '<label class="fnv2-label" for="fnv2Mobile">Mobile Number</label><div class="fnv2-field"><span class="fnv2-prefix">+91</span><input class="fnv2-input" id="fnv2Mobile" type="tel" inputmode="numeric" maxlength="10" placeholder="Enter mobile number" autocomplete="tel-national"></div><div class="fnv2-error" aria-live="polite"></div><button type="button" class="fnv2-btn fnv2-get">Get OTP</button>';
      const input = content.querySelector('input'); input.value=mobile;
      input.addEventListener('input', () => input.value = input.value.replace(/\D/g,'').slice(0,10));
      const go = async () => {
        if (sending) return;
        if (!/^[6-9]\d{9}$/.test(input.value)) { content.querySelector('.fnv2-error').textContent='Enter a valid 10-digit mobile number.'; return; }
        mobile = input.value;
        const btn = content.querySelector('.fnv2-get');
        const error = content.querySelector('.fnv2-error');
        sending = true; btn.disabled = true; btn.textContent = 'Sending OTP...'; error.textContent = '';
        try {
          const a = await ensureFirebase();
          resetCaptcha();
          const request = otpRequest;
          captcha = new firebase.auth.RecaptchaVerifier('fnv2-recaptcha', {size:'invisible'}, a.app);
          const result = await a.signInWithPhoneNumber('+91' + mobile, captcha);
          if (request !== otpRequest) return;
          confirmation = result;
          if (open) showOTP();
        } catch(e) { console.error('Foodnati OTP send error:', e); error.textContent = otpError(e); resetCaptcha(); }
        finally { sending = false; if (btn.isConnected) {btn.disabled = false; btn.textContent = 'Get OTP';} }
      };
      content.querySelector('.fnv2-get').addEventListener('click',go);
      input.addEventListener('keydown',e => { if(e.key==='Enter') go(); });
      if(open) input.focus();
    }
    function showOTP() {
      content.innerHTML = `<h2 class="fnv2-title">Verify OTP</h2><p class="fnv2-desc">Enter the 6-digit OTP for +91 ${mobile}.</p><label class="fnv2-label" for="fnv2OTP">Enter OTP</label><div class="fnv2-field"><input class="fnv2-input fnv2-otp" id="fnv2OTP" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••"></div><div class="fnv2-error" aria-live="polite"></div><button type="button" class="fnv2-btn fnv2-verify">Verify & Continue</button><button type="button" class="fnv2-back">Change mobile number</button>`;
      const input=content.querySelector('input'); input.focus(); input.addEventListener('input',()=>input.value=input.value.replace(/\D/g,'').slice(0,6));
      const verify = async () => {
        if (verifying) return;
        if (!/^\d{6}$/.test(input.value)) { content.querySelector('.fnv2-error').textContent = 'Enter 6-digit OTP.'; return; }
        if (!confirmation) { content.querySelector('.fnv2-error').textContent = 'Request a new OTP.'; return; }
        const btn = content.querySelector('.fnv2-verify');
        const error = content.querySelector('.fnv2-error');
        verifying = true; btn.disabled = true; btn.textContent = 'Verifying...'; error.textContent = '';
        try {
          const result = await confirmation.confirm(input.value);
          const verifiedPhone = result.user?.phoneNumber || '';
          if (verifiedPhone !== '+91' + mobile) throw new Error('Verified number mismatch. Please retry.');
          if (!saveSession(mobile)) throw new Error('Unable to save login session.');
          updateNavbar(); closePopup();
          window.dispatchEvent(new CustomEvent('foodnati:login-demo', {detail:{mobile, verified:true}}));
        } catch(e) { console.error('Foodnati OTP verification error:',e); error.textContent=otpError(e); }
        finally { verifying=false; if(btn.isConnected){btn.disabled=false;btn.textContent='Verify & Continue';} }
      };
      content.querySelector('.fnv2-verify').addEventListener('click',verify);
      content.querySelector('.fnv2-back').addEventListener('click',()=>{resetCaptcha();showMobile();});
      input.addEventListener('keydown',e=>{if(e.key==='Enter')verify();});
    }
    document.addEventListener('click', e => {
      const login = e.target.closest('#partnerLoginBtn, .partner-login');
      if(login && !login.closest('.fnv2-profile-wrap')) {e.preventDefault();openPopup();return;}
      const register=e.target.closest('#partnerRegisterBtn, .partner-register');
      if(register) {
        e.preventDefault();
        if(session()) {
          // Hook for the application/dashboard page; no destination URL was supplied.
          window.dispatchEvent(new CustomEvent('foodnati:continue-application', {detail:{mobile:session().mobile}}));
        } else {
          openPopup();
        }
        return;
      }
      if(!e.target.closest('.fnv2-profile-wrap, #partnerProfile')) { document.querySelectorAll('.fnv2-dropdown').forEach(d=>d.hidden=true); const d=document.getElementById('partnerDropdown'); if(d) d.hidden=true; }
    });
    modal.querySelector('.fnv2-close').addEventListener('click',closePopup);
    modal.addEventListener('click',e=>{if(e.target===modal)closePopup();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(open)closePopup();document.querySelectorAll('.fnv2-dropdown').forEach(d=>d.hidden=true);}});
    window.openFoodnatiLogin=openPopup;
    window.foodnatiLogout=logout;
    window.addEventListener('storage', updateNavbar);
    window.addEventListener('foodnati:login-demo', updateNavbar);
    updateNavbar();
    ensureFirebase().catch(e => console.warn('Firebase OTP initialization:',e));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
