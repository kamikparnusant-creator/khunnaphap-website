// Local, code-drawn fallback icons: no extra image request can fail again.
(() => {
  const icons = {
    'branch-phone-icon': '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z"/>',
    'branch-map-icon': '<path d="m5 8 2-4h10l2 4M4 8h16v10H4zM6 18v2m12-2v2M7 12h1m8 0h1"/>',
    'location-pin-icon': '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    'hours-icon': '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
  };
  Object.entries(icons).forEach(([className, drawing]) => {
    document.querySelectorAll(`img.${className}`).forEach(img => {
      const fallback = () => {
        if (!img.isConnected) return;
        const icon = document.createElement('span');
        icon.className = `${className} image-icon-fallback`;
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${drawing}</svg>`;
        img.replaceWith(icon);
      };
      img.addEventListener('error', fallback, { once: true });
      // Covers cached failures that occurred before this script was loaded.
      if (img.complete && img.naturalWidth === 0) fallback();
    });
  });
})();

// Wait briefly for Thai fonts, with a one-second limit before revealing text.
(() => {
  const allowed = matchMedia('(max-width: 760px) and (prefers-reduced-motion: no-preference)');
  if (!allowed.matches) return;
  const root = document.documentElement;
  root.classList.add('welcome-pending');
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    root.classList.remove('welcome-pending');
    if (allowed.matches) root.classList.add('welcome-ready');
  };
  const timeout = setTimeout(reveal, 1000);
  const fonts = document.fonts ? Promise.all([
    document.fonts.load('600 44px "Noto Sans Thai"', 'ตรอ.คุณภาพ'),
    document.fonts.load('400 20px "Noto Sans Thai"', 'ยินดีให้บริการ')
  ]) : Promise.resolve();
  fonts.catch(() => {}).then(() => {
    clearTimeout(timeout);
    reveal();
  });
  allowed.addEventListener('change', () => {
    if (!allowed.matches) {
      clearTimeout(timeout);
      reveal();
      root.classList.remove('welcome-ready');
    }
  });
})();

// View changes manage their own scroll position.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
menu?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  document.body.classList.toggle('menu-open', open);
  document.querySelector('main').inert = open;
  document.querySelector('footer').inert = open;
  menu.setAttribute('aria-expanded', open);
  menu.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
  menu.textContent = open ? '×' : '☰';
});
document.querySelectorAll('.main-nav a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.textContent = '☰';
  document.body.classList.remove('menu-open');
  document.querySelector('main').inert = false;
  document.querySelector('footer').inert = false;
  menu.setAttribute('aria-label', 'เปิดเมนู');
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    menu.click();
    menu.focus();
  }
});
document.addEventListener('click', event => {
  if (nav.classList.contains('open') && !nav.contains(event.target) && !menu.contains(event.target)) menu.click();
});
const shortcuts = document.querySelectorAll('.mobile-dock a');
matchMedia('(max-width:760px)').addEventListener('change', event => {
  if (!event.matches && nav.classList.contains('open')) menu.click();
});
function updateShortcut() {
  const current = location.hash || '#top';
  shortcuts.forEach(link => {
    if (link.getAttribute('href') === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', updateShortcut);
updateShortcut();

// Opening hours follow Thailand time, regardless of the visitor's timezone.
function openingStatus(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', weekday: 'short', hour: '2-digit',
    minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(part => [part.type, part.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const open = parts.weekday !== 'Sun' && minutes >= 477 && minutes < 1023;
  return open ? '🟢 ขณะนี้เปิดบริการ' : '🔴 ขณะนี้ปิดบริการ';
}
function updateOpeningStatus() {
  const status = document.querySelector('#opening-status');
  const message = openingStatus();
  if (status.textContent !== message) status.textContent = message;
}
updateOpeningStatus();
setInterval(updateOpeningStatus, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateOpeningStatus();
});

// Coordinates from the seven branch map links supplied by the business.
const branchCoordinates = [
  [13.8032461, 100.2964146], [13.8202602, 100.4793101],
  [13.8092739, 100.3799182], [13.8451259, 100.4055497],
  [13.8340129, 100.4694663], [13.8174674, 100.403208],
  [13.9092882, 100.3515941]
];
const branchGrid = document.querySelector('.branch-grid');
const branchCards = [...document.querySelectorAll('.branch-card')];
const branchChoice = document.querySelector('#branch-choice');
const nearestButton = document.querySelector('#find-nearest');
const locationStatus = document.querySelector('#location-status');
let locationRequest = 0;
branchCards.forEach((card, index) => {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = card.querySelector('h3').textContent;
  branchChoice.append(option);
  const heading = card.querySelector('h3');
  const title = heading.textContent;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'branch-toggle';
  toggle.textContent = title;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'branch-detail-' + index);
  heading.replaceChildren(toggle);
  const header = document.createElement('div');
  header.className = 'branch-row';
  const panel = document.createElement('div');
  panel.className = 'branch-detail';
  panel.id = 'branch-detail-' + index;
  panel.hidden = true;
  [...card.children].filter(child => child !== heading).forEach(child => panel.append(child));
  header.append(heading);
  card.replaceChildren(header, panel);
  card.classList.add('branch-accordion');
  toggle.addEventListener('click', () => {
    selectContactBranch(toggle.getAttribute('aria-expanded') === 'true' ? -1 : index, true);
  });
});
const panelMotion = matchMedia('(prefers-reduced-motion: reduce)');
function slidePanel(panel, open) {
  panel.slideAnimation?.cancel();
  if (panel.hidden === !open) return;
  if (panelMotion.matches || !panel.animate) { panel.hidden = !open; return; }
  panel.hidden = false;
  const style = getComputedStyle(panel);
  const full = { height: panel.offsetHeight + 'px', paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, opacity: 1 };
  const closed = { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 };
  panel.style.overflow = 'hidden';
  const animation = panel.animate(open ? [closed, full] : [full, closed], {
    duration: open ? 420 : 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
  });
  panel.slideAnimation = animation;
  animation.onfinish = () => {
    panel.style.overflow = '';
    panel.hidden = !open;
    panel.slideAnimation = null;
  };
  animation.oncancel = () => { panel.style.overflow = ''; };
}
function selectContactBranch(index, animate = false) {
  branchCards.forEach((item, i) => {
    item.classList.toggle('selected-branch', i === index);
    item.querySelector('.branch-toggle').setAttribute('aria-expanded', String(i === index));
    const panel = item.querySelector('.branch-detail');
    if (animate) slidePanel(panel, i === index);
    else {
      panel.slideAnimation?.cancel();
      panel.hidden = i !== index;
    }
  });
}
function resetBranches() {
  selectContactBranch(-1);
  branchCards.forEach(card => {
    card.hidden = false;
    card.classList.remove('nearest-branch');
    card.querySelector('.branch-distance')?.remove();
    branchGrid.append(card);
  });
}
branchChoice.addEventListener('change', () => {
  locationRequest++;
  nearestButton.disabled = false;
  resetBranches();
  selectContactBranch(branchChoice.value === '' ? -1 : Number(branchChoice.value));
  if (branchChoice.value !== '') {
    branchCards.forEach((card, index) => { card.hidden = index !== Number(branchChoice.value); });
  }
  locationStatus.textContent = branchChoice.value === '' ? 'แสดงทุกสาขา' : 'แสดงสาขาที่คุณเลือก กดโทรหรือเปิดแผนที่ได้ด้านล่าง';
});
function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = degrees => degrees * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
nearestButton.addEventListener('click', () => {
  if (!window.isSecureContext || !navigator.geolocation) {
    locationStatus.textContent = 'อุปกรณ์นี้ยังใช้ตำแหน่งไม่ได้ กรุณาเปิดเว็บผ่าน HTTPS หรือเลือกสาขาด้วยตัวเอง';
    return;
  }
  const request = ++locationRequest;
  nearestButton.disabled = true;
  locationStatus.textContent = 'กำลังขอตำแหน่ง… โปรดอนุญาตในหน้าต่างของเบราว์เซอร์ หรือเลือกสาขาเองได้เลย';
  navigator.geolocation.getCurrentPosition(position => {
    if (request !== locationRequest) return;
    nearestButton.disabled = false;
    branchChoice.value = '';
    resetBranches();
    const sorted = branchCards.map((card, index) => ({
      card, distance: distanceKm(position.coords.latitude, position.coords.longitude, ...branchCoordinates[index])
    })).sort((a, b) => a.distance - b.distance);
    sorted.forEach(({ card, distance }, index) => {
      const label = document.createElement('p');
      label.className = 'branch-distance';
      label.textContent = (index === 0 ? 'ใกล้ที่สุดโดยประมาณ · ' : '') +
        distance.toLocaleString('th-TH', { maximumFractionDigits: 1 }) + ' กม. (เส้นตรง)';
      card.querySelector('h3').after(label);
      card.classList.toggle('nearest-branch', index === 0);
      branchGrid.append(card);
    });
    selectContactBranch(branchCards.indexOf(sorted[0].card));
    locationStatus.textContent = 'เรียงจากใกล้ไปไกลแล้ว ระยะทางเป็นเส้นตรง ไม่ใช่ระยะขับรถ โปรดกดเปิดแผนที่เพื่อดูเส้นทางจริง' +
      (position.coords.accuracy > 1000 ? ' · ตำแหน่งที่ได้รับมีความแม่นยำต่ำ ผลอาจคลาดเคลื่อน' : '');
  }, error => {
    if (request !== locationRequest) return;
    nearestButton.disabled = false;
    locationStatus.textContent = error.code === 1
      ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง คุณยังเลือกสาขาจากรายการได้'
      : 'ยังค้นหาตำแหน่งไม่ได้ ลองอีกครั้ง หรือเลือกสาขาจากรายการได้เลย';
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
});

// Native dialog traps focus, supports Escape, and keeps images on this page.
const posterDialog = document.querySelector('#poster-dialog');
const posterFull = document.querySelector('#poster-full');
let posterOpener;
let previousOverflow = '';
document.querySelectorAll('.vehicle-age-poster').forEach(link => {
  if (!posterDialog.showModal) return; // Original full-image link remains usable.
  link.setAttribute('aria-label', 'แตะเพื่อขยายรูปในหน้านี้');
  link.setAttribute('aria-haspopup', 'dialog');
  const hint = document.createElement('span');
  hint.className = 'poster-hint';
  hint.textContent = 'ขยายรูป ⤢';
  link.append(hint);
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    posterOpener = link;
    posterFull.src = link.href;
    posterFull.alt = link.querySelector('img').alt;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    posterDialog.showModal();
    document.querySelector('#poster-close').focus();
    document.querySelector('.poster-scroll').scrollTo(0, 0);
  });
});
document.querySelector('#poster-close').addEventListener('click', () => posterDialog.close());
posterDialog.addEventListener('click', event => {
  if (event.target === posterDialog) posterDialog.close();
});
posterDialog.addEventListener('close', () => {
  document.body.style.overflow = previousOverflow;
  posterOpener?.focus({ preventScroll: true });
});

// Progressive enhancement: content stays visible even without animation support.
// Animate once on arrival; never animate phone/map links or fixed navigation.
function setupScrollReveal() {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
  const targets = document.querySelectorAll(
    // Only things people can tap/click; static text, cards and pictures stay still.
    '.faq-jump, .faq details, .branch-card'
  );
  const running = new Set();
  const observer = new IntersectionObserver(entries => {
    let batch = 0;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      entry.target.dataset.scrollRevealed = 'true';
      if (motion.matches) return;
      // Items arriving together appear one after another.
      const animation = entry.target.animate([
        { opacity: 0, transform: 'translateY(22px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 750, delay: Math.min(batch++, 5) * 70, fill: 'backwards', easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      running.add(animation);
      animation.onfinish = animation.oncancel = () => running.delete(animation);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -24px 0px' });
  targets.forEach(target => {
    const rect = target.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      target.dataset.scrollRevealed = 'true';
    } else {
      observer.observe(target);
    }
  });
  motion.addEventListener('change', event => {
    if (!event.matches) return;
    observer.disconnect();
    running.forEach(animation => animation.cancel());
  });
  window.addEventListener('beforeprint', () => {
    running.forEach(animation => animation.cancel());
  });
}
setupScrollReveal();

// Two separate views with a fade between them; section links still work inside services.
(() => {
  const body = document.body;
  const start = document.querySelector('.hero-start');
  const heading = document.querySelector('#services h2');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  document.documentElement.classList.add('view-navigation');
  heading.tabIndex = -1;
  // Every fresh visit or reload starts at the welcome screen, including old section URLs.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  let activeIntro = true;
  let desiredIntro = activeIntro;
  let changing = false;
  body.classList.toggle('at-intro', activeIntro);
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateShortcut();

  const fade = async (from, to, duration) => {
    if (motion.matches || !body.animate) return;
    const animation = body.animate([{ opacity: from }, { opacity: to }], {
      duration, easing: 'ease-in-out', fill: 'forwards'
    });
    await animation.finished.catch(() => {});
    animation.cancel();
  };
  const changeView = async () => {
    if (changing) return;
    changing = true;
    if (nav.classList.contains('open')) menu.click();
    body.inert = true;
    body.classList.add('view-changing');
    try {
      while (activeIntro !== desiredIntro) {
        const swap = () => {
          activeIntro = desiredIntro;
          body.classList.toggle('at-intro', activeIntro);
          window.scrollTo({ top: 0, behavior: 'instant' });
          const video = document.querySelector('#hero-video');
          if (!activeIntro) video?.pause();
          else if (!motion.matches && matchMedia('(min-width:761px)').matches && !navigator.connection?.saveData) video?.play().catch(() => {});
        };
        if (document.startViewTransition && !motion.matches) {
          const transition = document.startViewTransition(swap);
          transition.ready.catch(() => {}); // Skipped transitions (e.g. hidden tab) still swap views.
          await transition.finished.catch(() => {});
        } else {
          await fade(1, 0, 220);
          swap();
          await fade(0, 1, 380);
        }
      }
    } finally {
      body.inert = false;
      body.classList.remove('view-changing');
      changing = false;
      (activeIntro ? start : heading).focus({ preventScroll: true });
    }
  };
  start.addEventListener('click', event => {
    event.preventDefault();
    if (changing) return;
    history.pushState(null, '', '#services');
    updateShortcut();
    desiredIntro = false;
    changeView();
  });
  document.querySelectorAll('a[href="#top"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    if (changing || activeIntro) return;
    history.pushState(null, '', '#top');
    updateShortcut();
    desiredIntro = true;
    changeView();
  }));
  window.addEventListener('hashchange', () => {
    desiredIntro = !location.hash || location.hash === '#top';
    if (activeIntro !== desiredIntro) changeView();
  });
})();

// Autoplay stays silent; reduced-motion and data-saving users get the poster.

(() => {
  const video = document.getElementById('hero-video');
  if (!video) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobileHero = matchMedia('(max-width: 760px)');
  let wantsPlayback = !motion.matches && !navigator.connection?.saveData && !mobileHero.matches;
  mobileHero.addEventListener('change', () => {
    wantsPlayback = !mobileHero.matches && !motion.matches && !navigator.connection?.saveData;
    if (wantsPlayback && !document.hidden && document.body.classList.contains('at-intro')) play(); else video.pause();
  });
  const play = () => { video.muted = true; video.play().catch(() => {}); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause(); else if (wantsPlayback && document.body.classList.contains('at-intro')) play();
  });
  motion.addEventListener('change', () => {
    if (motion.matches) { wantsPlayback = false; video.pause(); }
  });
  if (wantsPlayback && document.body.classList.contains('at-intro')) play();
})();

// Header gains a soft shadow after scrolling; one passive listener, at most once per frame.
(() => {
  let queued = false;
  const update = () => {
    queued = false;
    document.body.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();
