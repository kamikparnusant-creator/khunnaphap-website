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
// A click anywhere outside the header closes the open menu (the desktop dropdown and the mobile panel).
document.addEventListener('click', event => {
  if (nav.classList.contains('open') && !event.target.closest('.site-header')) menu.click();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    menu.click();
    menu.focus();
  }
});
document.addEventListener('click', event => {
  if (nav.classList.contains('open') && !nav.contains(event.target) && !menu.contains(event.target)) menu.click();
});
matchMedia('(max-width:760px)').addEventListener('change', event => {
  if (!event.matches && nav.classList.contains('open')) menu.click();
});

// Opening hours follow Thailand time, regardless of the visitor's timezone.
function openingStatus(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', weekday: 'short', hour: '2-digit',
    minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(part => [part.type, part.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const open = parts.weekday !== 'Sun' && minutes >= 480 && minutes < 1020;
  return open ? '🟢 ขณะนี้เปิดบริการ' : '🔴 ขณะนี้ปิดบริการ';
}
function updateOpeningStatus() {
  const status = document.querySelector('#opening-status');
  const message = openingStatus();
  if (status.textContent !== message) status.textContent = message;
}
updateOpeningStatus();
setInterval(updateOpeningStatus, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateOpeningStatus();
});

// Coordinates from the branch map links supplied by the business, in card order.
const branchCoordinates = [
  [13.8032461, 100.2964146], [13.8202602, 100.4793101],
  [13.8092739, 100.3799182], [13.8451259, 100.4055497],
  [13.8340129, 100.4694663], [13.8174674, 100.403208],
  [13.9092882, 100.3515941], [13.8326472, 100.4063891],
  [13.8078333, 100.4635278]
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
  const soon = card.classList.contains('branch-soon');
  option.textContent = card.querySelector('h3').textContent + (soon ? ' · เปิดเร็วๆนี้' : '');
  branchChoice.append(option);
  const heading = card.querySelector('h3');
  const title = heading.textContent;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'branch-toggle';
  toggle.textContent = title;
  if (soon) {
    const badge = document.createElement('span');
    badge.className = 'soon-badge';
    badge.textContent = 'เปิดเร็วๆนี้';
    toggle.append(badge);
  }
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
    // Branches marked "coming soon" stay out of the ranking and are listed after the open ones.
    const sorted = branchCards.map((card, index) => ({
      card, distance: distanceKm(position.coords.latitude, position.coords.longitude, ...branchCoordinates[index])
    })).filter(({ card }) => !card.classList.contains('branch-soon')).sort((a, b) => a.distance - b.distance);
    sorted.forEach(({ card, distance }, index) => {
      const label = document.createElement('p');
      label.className = 'branch-distance';
      label.textContent = (index === 0 ? 'ใกล้ที่สุดโดยประมาณ · ' : '') +
        distance.toLocaleString('th-TH', { maximumFractionDigits: 1 }) + ' กม. (เส้นตรง)';
      card.querySelector('h3').after(label);
      card.classList.toggle('nearest-branch', index === 0);
      branchGrid.append(card);
    });
    branchCards.filter(card => card.classList.contains('branch-soon')).forEach(card => branchGrid.append(card));
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
  // Leave the welcome screen; optionally land on a later section such as the branches.
  const enter = async (hash = '#services') => {
    if (changing || !activeIntro) return;
    history.pushState(null, '', hash);
    desiredIntro = false;
    await changeView();
    if (hash !== '#services') document.querySelector(hash)?.scrollIntoView({ behavior: motion.matches ? 'auto' : 'smooth' });
  };
  document.querySelectorAll('.hero-start, .hero-branches').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    enter(link.getAttribute('href'));
  }));
  // On the welcome screen, scrolling down (wheel or keys) opens the services view.
  window.addEventListener('wheel', event => {
    if (activeIntro && event.deltaY > 20) enter();
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (activeIntro && ['ArrowDown', 'PageDown'].includes(event.key)) enter();
  });
  document.querySelectorAll('a[href="#top"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    if (changing || activeIntro) return;
    history.pushState(null, '', '#top');
    desiredIntro = true;
    changeView();
  }));
  window.addEventListener('hashchange', () => {
    desiredIntro = !location.hash || location.hash === '#top';
    if (activeIntro !== desiredIntro) changeView();
  });
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

// Theme toggle: one tap switches light <-> dark; the sun/moon icon morphs in CSS.
(() => {
  const toggle = document.querySelector('#theme-toggle');
  if (!toggle) return;
  if (!window.setThemeChoice) { toggle.closest('.theme-switch').hidden = true; return; }
  const root = document.documentElement;
  const sync = () => toggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  sync();
  toggle.addEventListener('click', () => {
    const apply = () => { window.setThemeChoice(root.dataset.theme === 'dark' ? 'light' : 'dark'); sync(); };
    // Cross-fade the page colours where supported; the icon animates either way.
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-switching');
      const transition = document.startViewTransition(apply);
      transition.ready.catch(() => {});
      transition.finished.finally(() => root.classList.remove('theme-switching'));
    } else apply();
  });
})();

// Glow buttons: the light follows the mouse on hover, and appears where a finger touches on phones.
document.querySelectorAll('.glow-button').forEach(button => {
  let fadeTimer;
  const moveGlow = event => {
    const rect = button.getBoundingClientRect();
    button.style.setProperty('--glow-x', `${event.clientX - rect.left}px`);
    button.style.setProperty('--glow-y', `${event.clientY - rect.top}px`);
  };
  button.addEventListener('pointermove', moveGlow);
  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    clearTimeout(fadeTimer);
    moveGlow(event);
    button.classList.add('is-glowing');
  });
  // Keep the glow briefly after the finger lifts so the press is visible.
  const release = () => {
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => button.classList.remove('is-glowing'), 350);
  };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => button.addEventListener(type, release));
});

// Welcome line alternates Thai / English; letters slide up one after another (like a text-rotate component).
(() => {
  const line = document.querySelector('.mobile-welcome p');
  if (!line) return;
  const texts = [
    { text: 'ยินดีให้บริการ', lang: 'th' },
    { text: 'Welcome', lang: 'en' },
    { text: 'At your service', lang: 'en' }
  ];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // Glyph outlines for each phrase (Mali 500, 100-unit em), pre-built so no font or library loads at runtime.
  const HAND = {"ยินดีให้บริการ":{"vb":"-3.3 -10.1 671.9 120.9","full":"M50.6 39.7Q52.7 39.7 54.2 40.8Q55.7 41.8 55.7 43.3L55.7 43.3L55.7 82.3Q55.7 91.6 49.5 96.0Q43.3 100.3 32.4 100.3L32.4 100.3Q21.6 100.3 15.0 96.3Q8.3 92.2 8.3 84.3L8.3 84.3Q8.3 79.5 10.1 76.3Q11.8 73.2 14.7 72.1L14.7 72.1Q11.6 71.4 9.7 67.1Q7.7 62.8 7.7 56.8L7.7 56.8Q7.7 48.5 11.6 44.1Q15.4 39.7 22.2 39.7L22.2 39.7Q28.2 39.7 31.7 43.1Q35.1 46.5 35.1 52.1L35.1 52.1Q35.1 57.5 31.8 60.6Q28.4 63.8 22.6 63.8L22.6 63.8Q18.9 63.8 16.1 62.3L16.1 62.3Q16.7 66 18.4 67.4Q20.1 68.9 23.2 68.9L23.2 68.9L28.8 68.9Q31.2 68.9 31.2 72.2L31.2 72.2Q31.2 75.2 28.8 75.2L28.8 75.2Q25.4 75.2 23.5 75.3L23.5 75.3Q20.5 75.4 19.3 78.2Q18 81 18 84.1L18 84.1Q18 92.6 32.6 92.6L32.6 92.6Q39.3 92.6 42.6 90.3Q45.8 87.9 45.8 82.4L45.8 82.4L45.7 43.4Q45.7 41.8 47.1 40.8Q48.5 39.7 50.6 39.7L50.6 39.7ZM22.3 46.1Q19.5 46.1 17.7 47.8Q15.8 49.4 15.8 52.1L15.8 52.1Q15.8 55 17.8 56.5Q19.7 58.1 22.4 58.1L22.4 58.1Q25.1 58.1 26.7 56.4Q28.3 54.8 28.3 52.1L28.3 52.1Q28.3 49.4 26.8 47.8Q25.2 46.1 22.3 46.1L22.3 46.1ZM23.7 31.5Q15.4 31.5 11.1 29.8Q6.7 28.1 6.7 24.2L6.7 24.2Q6.7 19.7 9.9 15.4Q13.1 11.1 18.1 8.3Q23.1 5.6 28.3 5.6L28.3 5.6Q34.7 5.6 41.1 9.8Q47.4 14 53.0 20.6L53.0 20.6Q55.4 23.4 55.4 25.8L55.4 25.8Q55.4 27.8 54.0 29Q52.5 30.2 50.3 30.2L50.3 30.2Q47.3 30.2 38.7 30.8L38.7 30.8Q27.3 31.5 23.7 31.5L23.7 31.5ZM26.0 24.1Q31.1 24.1 35.5 23.8L35.5 23.8Q40.7 23.6 43.4 23.6L43.4 23.6Q45.9 23.6 45.9 22.9L45.9 22.9Q45.9 21.9 43.3 19.4Q40.6 17 36.6 15.1Q32.6 13.2 28.5 13.2L28.5 13.2Q25.3 13.2 22 14.6Q18.7 16 16.6 18.1Q14.4 20.3 14.4 22.4L14.4 22.4Q14.4 23.5 16.0 23.8Q17.5 24.1 21.3 24.1L21.3 24.1L26.0 24.1ZM129.2 75.4Q134.9 75.4 138.3 79.2Q141.7 83 141.7 88.3L141.7 88.3Q141.7 93.4 138.4 97.1Q135.2 100.8 128.9 100.8L128.9 100.8Q117.9 100.8 115.7 87.8L115.7 87.8Q112 89.7 106.2 93.3L106.2 93.3Q98.2 97.9 97.1 98.5L97.1 98.5Q96.4 98.9 94.9 99.3Q93.4 99.7 91.7 99.7L91.7 99.7Q89.3 99.7 88.3 98.6Q87.3 97.5 87.1 95L87.1 95Q86.8 91.7 86.8 85.6L86.8 85.6Q86.8 80.4 86.9 78.2L86.9 78.2Q87.1 69.1 87.1 65.7L87.1 65.7Q84.7 67.4 81.1 67.4L81.1 67.4Q75.7 67.4 72.2 63.8Q68.6 60.1 68.6 54.6L68.6 54.6Q68.6 49.2 72.3 45.4Q75.9 41.6 82.8 41.6L82.8 41.6Q89.5 41.6 93.2 45.3Q96.8 49.1 96.8 56L96.8 56Q96.8 59.6 96.7 62.2L96.7 62.2Q96.5 70.6 96.5 77.1L96.5 77.1L96.5 82.4Q96.5 88 96.8 89.5L96.8 89.5Q108 82.8 115.2 79.3L115.2 79.3Q115.2 68.5 115.4 50.1L115.4 50.1Q115.5 48.2 115.5 45L115.5 45Q115.6 43.4 117.1 42.3Q118.5 41.3 120.7 41.3L120.7 41.3Q123 41.3 124.3 42.3Q125.5 43.3 125.5 45.1L125.5 45.1Q125.5 50.1 125.1 61.9L125.1 61.9Q125 64.5 124.9 68.0Q124.8 71.6 124.8 75.9L124.8 75.9Q127.3 75.4 129.2 75.4L129.2 75.4ZM81.5 61.1Q84.6 61.1 86.7 59.3Q88.7 57.6 88.7 54.5L88.7 54.5Q88.7 51.6 86.9 49.7Q85.1 47.8 82.1 47.8L82.1 47.8Q79 47.8 77.1 49.8Q75.2 51.7 75.2 54.7L75.2 54.7Q75.2 57.5 76.9 59.3Q78.6 61.1 81.5 61.1L81.5 61.1ZM129.6 94Q131.9 94 133.2 92.5Q134.5 90.9 134.5 88.6L134.5 88.6Q134.5 86.1 133.4 84.5Q132.2 82.9 129.9 82.9L129.9 82.9Q128.1 82.9 124.6 84L124.6 84Q124.6 89 125.7 91.5Q126.7 94 129.6 94L129.6 94ZM179.6 39.9Q193.2 39.9 200.2 48.8Q207.2 57.7 207.2 73.4L207.2 73.4L207.2 96.8Q207.2 98.4 205.9 99.3Q204.6 100.2 202.4 100.2L202.4 100.2Q200.1 100.2 198.7 99.3Q197.3 98.4 197.3 96.8L197.3 96.8L197.3 73.8Q197.3 61.1 192.6 54.4Q187.8 47.7 179.3 47.7L179.3 47.7Q171.1 47.7 166.3 54.8Q161.4 61.8 161.4 77.1L161.4 77.1Q161.4 83 162 87.7Q162.6 92.4 163.6 92.4L163.6 92.4Q164.4 92.4 167.3 90.7Q170.2 88.9 173 86.5L173 86.5Q176.6 83.5 178.7 80.7L178.7 80.7Q178.2 80.8 177.1 80.8L177.1 80.8Q173.1 80.7 170.6 78Q168 75.3 168 71.3L168 71.3Q168 66.7 171.1 63.6Q174.1 60.6 179.1 60.6L179.1 60.6Q184 60.6 187.0 63.6Q189.9 66.6 189.9 71.3L189.9 71.3Q190 76.6 186.9 81.4Q183.8 86.2 178.9 90.8L178.9 90.8Q174.3 95.1 169.3 97.8Q164.2 100.5 160.6 100.5L160.6 100.5Q154.6 100.5 153.2 92.6L153.2 92.6Q152.6 89.7 152.3 84.2Q151.9 78.6 151.9 74.2L151.9 74.2Q151.9 57.5 159.1 48.7Q166.2 39.9 179.6 39.9L179.6 39.9ZM173.8 71.1Q173.8 73.2 175.3 74.5Q176.7 75.9 178.8 75.9L178.8 75.9Q181.1 75.9 182.6 74.5Q184 73.2 184 70.9L184 70.9Q184 68.9 182.6 67.5Q181.1 66.1 179 66.1L179 66.1Q176.7 66.1 175.3 67.6Q173.8 69.1 173.8 71.1L173.8 71.1ZM176.5 31.6Q166.1 31.6 161.7 29.8Q157.3 28.1 157.3 23.7L157.3 23.7Q157.3 19.4 160.6 15.1Q163.8 10.9 168.9 8.2Q173.9 5.5 178.9 5.5L178.9 5.5Q185.1 5.5 190.5 8.7Q195.9 11.9 198.4 15.8L198.4 15.8Q197.8 8.6 197.8 2.9L197.8 2.9Q197.8 1.4 199 0.6Q200.2-0.1 201.9-0.1L201.9-0.1Q203.5-0.1 204.9 0.7Q206.2 1.5 206.3 2.7L206.3 2.7Q206.4 11.8 207.3 24.9L207.3 24.9Q207.5 27.1 205.8 28.5Q204.1 29.9 201 30.1L201 30.1L198.9 30.3Q184 31.6 176.5 31.6L176.5 31.6ZM177 25.2Q183.8 25.2 193.6 24.4L193.6 24.4Q194.9 24.3 198.7 23.5L198.7 23.5Q193.8 18.7 189.7 16.3Q185.5 13.8 179.9 13.8L179.9 13.8Q176.7 13.8 173.2 15.1Q169.7 16.5 167.3 18.6Q164.9 20.8 164.9 23.2L164.9 23.2Q164.9 25.2 177 25.2L177 25.2ZM264.8 89.6Q264.9 94.4 261.8 97.3Q258.6 100.1 253.5 100.1L253.5 100.1Q248.2 100.1 245.1 97.2Q241.9 94.2 241.9 89.1L241.9 89.1Q241.9 80.8 242.1 70L242.1 70Q242.3 60.2 242.3 55.1L242.3 55.1Q242.3 47.4 242.4 43.9L242.4 43.9L242.5 30.2Q242.5 20.9 240.3 16.7Q238 12.5 232.8 12.5L232.8 12.5Q229.8 12.5 227.5 13.9Q225.1 15.3 224.2 17.8L224.2 17.8Q225.6 17.1 227.9 17.1L227.9 17.1Q232.5 17.1 235.5 19.9Q238.4 22.7 238.4 27.2L238.4 27.2Q238.4 31.9 235.3 34.8Q232.1 37.6 227 37.6L227 37.6Q222 37.6 218.6 34.1Q215.1 30.7 215.1 24.3L215.1 24.3Q215.1 15 220.0 10.1Q224.8 5.2 233.9 5.2L233.9 5.2Q243.3 5.2 248.0 11.5Q252.6 17.8 252.6 30.6L252.6 30.6Q252.6 34.8 252.4 42.8L252.4 42.8Q252.2 50.8 252.2 55.6L252.2 55.6Q252.2 63.4 252 74L252 74L251.9 79.9Q253.2 79.4 254.8 79.4L254.8 79.4Q259.2 79.4 262 82.3Q264.8 85.2 264.8 89.6L264.8 89.6ZM227.1 21.9Q224.9 21.9 223.4 23.4Q221.8 24.9 221.7 27L221.7 27Q221.7 29.4 223.2 31Q224.6 32.6 227.1 32.6L227.1 32.6Q229.6 32.6 231.2 31.3Q232.8 29.9 232.8 27.5L232.8 27.5Q232.8 24.8 231.2 23.3Q229.5 21.9 227.1 21.9L227.1 21.9ZM253.5 94.8Q255.8 94.8 257.1 93.5Q258.3 92.2 258.3 90L258.3 90Q258.3 87.8 257.1 86.5Q255.8 85.2 253.7 85.2L253.7 85.2Q251.3 85.2 249.9 86.5Q248.4 87.7 248.4 89.8L248.4 89.8Q248.4 91.9 249.8 93.3Q251.1 94.8 253.5 94.8L253.5 94.8ZM335.5 53.4Q335.5 58 333.2 60.8Q330.9 63.7 327.4 65.6L327.4 65.6Q330.0 68.4 331.0 73Q332.0 77.6 332.0 86L332.0 86Q332.0 87.9 331.9 89.6L331.9 89.6Q331.7 94.6 331.7 97.3L331.7 97.3Q331.6 98.8 330.3 99.7Q328.9 100.6 326.7 100.6L326.7 100.6Q324.5 100.6 323.1 99.7Q321.7 98.8 321.7 97L321.7 97L321.9 91.7Q322.1 86.9 322.1 84.9L322.1 84.9Q322.1 79.4 321.8 76Q321.5 72.6 320.7 70.6L320.7 70.6Q316.8 74.9 312.4 81.1L312.4 81.1Q309.5 85.2 305.6 90.5Q301.6 95.7 299.7 97.5L299.7 97.5Q296.8 100.3 292.8 100.3L292.8 100.3Q289.7 100.3 288.0 99.0Q286.3 97.6 286.3 95.3L286.3 95.3L286.4 94.4Q287.5 86.8 289.8 71.8L289.8 71.8L290.4 68Q288.6 68.6 286.1 68.6L286.1 68.6Q279.7 68.6 276.0 64.6Q272.3 60.6 272.3 55.1L272.3 55.1Q272.3 48.9 276.5 44.9Q280.6 41 287.1 41L287.1 41Q293.6 41 297.6 44.9Q301.5 48.9 301.5 56.4L301.5 56.4Q301.5 60.1 300.9 64.7Q300.2 69.2 299.1 75.3L299.1 75.3L297.7 82.4Q297.5 83.3 296.8 86.8Q296.0 90.4 296.3 90.4L296.3 90.4Q296.5 90.4 298.7 87.3Q300.9 84.2 304.1 79.5L304.1 79.5Q304.8 78.6 307.2 75.1L307.2 75.1Q310.7 70.2 314.9 65.5L314.9 65.5Q307.4 61 307.4 53.3L307.4 53.3Q307.4 47.5 311.3 43.8Q315.1 40.2 321.3 40.2L321.3 40.2Q327.5 40.2 331.5 43.9Q335.5 47.6 335.5 53.4L335.5 53.4ZM321.2 47.2Q318.4 47.2 316.8 48.9Q315.2 50.6 315.2 53.4L315.2 53.4Q315.2 56.1 316.7 57.8Q318.2 59.4 321.0 61L321.0 61Q324.0 59.5 325.7 57.7Q327.4 55.9 327.4 53.2L327.4 53.2Q327.4 50.5 325.7 48.8Q324.0 47.2 321.2 47.2L321.2 47.2ZM279.8 55Q279.8 57.8 281.7 59.8Q283.5 61.8 286.6 61.8L286.6 61.8Q289.7 61.8 291.7 60.1Q293.7 58.4 293.7 55.1L293.7 55.1Q293.7 51.9 291.9 49.9Q290.0 47.9 287.0 47.9L287.0 47.9Q283.9 47.9 281.9 49.9Q279.8 52 279.8 55L279.8 55ZM334.7 2.6Q336.3 2.6 337.6 3.5Q338.8 4.4 338.8 5.8L338.8 5.8Q338.8 12.3 336.2 17.0Q333.6 21.8 329.6 24.8L329.6 24.8Q326.6 27.1 320.6 28.8Q314.5 30.4 309.9 30.4L309.9 30.4Q307.9 30.4 306.7 29.5Q305.5 28.7 305.5 27.3L305.5 27.3Q305.5 26.6 306.2 25.2L306.2 25.2Q306.7 24.3 308.3 22.1L308.3 22.1L310.2 19.3L310.8 18.3L310.2 18.3Q306.8 18.3 304.3 16.0Q301.8 13.8 301.8 10.3L301.8 10.3Q301.8 6.8 304.2 4.4Q306.6 2.1 310.4 2.1L310.4 2.1Q314.9 2.1 317.5 4.4Q320.1 6.8 320.1 10.5L320.1 10.5Q320.1 15.7 317.2 20.8L317.2 20.8Q317.0 21.1 316.8 21.5Q316.5 22 316.1 22.5L316.1 22.5Q319.3 21.9 322.0 20.8Q324.7 19.7 326.0 18.4L326.0 18.4Q328.3 16.2 329.6 13.4Q330.8 10.6 330.8 6L330.8 6Q330.8 4.6 332.0 3.6Q333.1 2.6 334.7 2.6L334.7 2.6ZM307.2 10.3Q307.2 11.8 308.2 12.6Q309.1 13.5 310.6 13.5L310.6 13.5Q312.0 13.5 313.0 12.7Q313.9 11.9 313.9 10.3L313.9 10.3Q313.9 9 313.1 8.0Q312.3 7.1 310.6 7.1L310.6 7.1Q309.0 7.1 308.1 8.0Q307.2 9 307.2 10.3L307.2 10.3ZM409.0 73L409.1 82.3Q409.3 89.7 409.3 93.9L409.3 93.9Q409.3 99.9 402.8 100L402.8 100L385.7 100.1Q380.5 100.1 371.9 99.9L371.9 99.9Q368.6 99.8 367.1 98.0Q365.6 96.3 365.6 93.5L365.6 93.5Q365.6 87.5 365.8 77.9L365.8 77.9L365.9 65.5Q364.0 66.3 361.3 66.3L361.3 66.3Q355.4 66.3 351.7 62.6Q348.0 59 348.0 53.5L348.0 53.5Q348.0 47.9 351.8 44.2Q355.6 40.5 361.8 40.5L361.8 40.5Q368.5 40.5 372.2 44.4Q375.9 48.3 375.9 55.9L375.9 55.9L375.9 60Q375.9 65.7 375.7 75.3L375.7 75.3L375.6 88.5Q375.6 90.5 376.4 91.3Q377.1 92.1 378.7 92.1L378.7 92.1L396.7 92.1Q398.1 92.1 398.7 91.2Q399.2 90.2 399.2 88.2L399.2 88.2L399.1 73.1L399.0 61.8Q398.8 50.2 398.8 45.8L398.8 45.8Q398.8 41 403.7 41L403.7 41Q405.9 41 407.3 42Q408.7 43 408.7 45L408.7 45Q409.0 62.7 409.0 73L409.0 73ZM354.8 53.6Q354.8 56.3 356.6 58.2Q358.3 60.1 361.3 60.1L361.3 60.1Q364.2 60.1 366.2 58.3Q368.2 56.6 368.2 53.7L368.2 53.7Q368.2 50.9 366.4 49Q364.5 47.1 361.5 47.1L361.5 47.1Q358.5 47.1 356.7 48.9Q354.8 50.7 354.8 53.6L354.8 53.6ZM471.7 44.3Q473.4 44.3 474.6 45Q475.7 45.7 475.7 47.3L475.7 47.3Q475.7 52.6 473.5 55.5Q471.2 58.4 467.3 58.4L467.3 58.4Q464.8 58.4 462.9 57.3Q460.9 56.1 458.3 53.8L458.3 53.8Q455 51 452.3 49.5Q449.6 48.1 445.7 48.1L445.7 48.1Q441.8 48.1 438.7 49.8Q435.5 51.6 433.7 54Q431.9 56.4 431.9 58.1L431.9 58.1Q431.9 59.1 432.7 59.3Q433.5 59.6 436.2 59.6L436.2 59.6L450.3 59.6Q456.5 59.6 460.4 63.1Q464.2 66.7 464.1 73.1L464.1 73.1L464 87.8Q463.9 93.5 460.1 96.9Q456.2 100.3 450.3 100.3L450.3 100.3Q444.3 100.3 441 97Q437.7 93.7 437.7 88.9L437.7 88.9Q437.7 84.1 440.9 80.8Q444.1 77.5 449.5 77.5L449.5 77.5Q452.2 77.5 454.2 78.5L454.2 78.5L454.2 73.6Q454.2 69.4 453 68.1Q451.8 66.8 448.8 66.8L448.8 66.8L433.5 66.8Q427.3 66.8 424.8 65.4Q422.3 64.1 422.3 60.6L422.3 60.6Q422.3 56.2 425.4 51.6Q428.4 47.1 433.8 44.1Q439.2 41.1 445.7 41.1L445.7 41.1Q451.6 41.1 455.4 43.0Q459.2 45 463 48.2L463 48.2Q465.6 50.6 466.7 50.6L466.7 50.6Q468.5 50.6 468.5 46.8L468.5 46.8Q468.5 45.7 469.4 45Q470.3 44.3 471.7 44.3L471.7 44.3ZM450.4 94.8Q453 94.8 454.7 93.2Q456.4 91.6 456.4 89L456.4 89Q456.4 86.4 454.7 84.9Q452.9 83.4 450.3 83.4L450.3 83.4Q447.7 83.4 446.1 85.0Q444.5 86.5 444.5 89L444.5 89Q444.5 91.5 446.2 93.2Q447.8 94.8 450.4 94.8L450.4 94.8ZM439.2 31.5Q430.9 31.5 426.6 29.8Q422.2 28.1 422.2 24.2L422.2 24.2Q422.2 19.7 425.4 15.4Q428.6 11.1 433.6 8.3Q438.6 5.6 443.8 5.6L443.8 5.6Q450.2 5.6 456.6 9.8Q462.9 14 468.5 20.6L468.5 20.6Q470.9 23.4 470.9 25.8L470.9 25.8Q470.9 27.8 469.5 29Q468.0 30.2 465.8 30.2L465.8 30.2Q462.8 30.2 454.2 30.8L454.2 30.8Q442.8 31.5 439.2 31.5L439.2 31.5ZM441.5 24.1Q446.6 24.1 451.0 23.8L451.0 23.8Q456.2 23.6 458.9 23.6L458.9 23.6Q461.4 23.6 461.4 22.9L461.4 22.9Q461.4 21.9 458.8 19.4Q456.1 17 452.1 15.1Q448.1 13.2 444.0 13.2L444.0 13.2Q440.8 13.2 437.5 14.6Q434.2 16 432.1 18.1Q429.9 20.3 429.9 22.4L429.9 22.4Q429.9 23.5 431.5 23.8Q433 24.1 436.8 24.1L436.8 24.1L441.5 24.1ZM537.3 100Q532.3 100 532.3 95.5L532.3 95.5Q532.3 88.9 531.8 79.4L531.8 79.4Q531.1 65.9 529.7 59.3Q528.2 52.6 525.2 50Q522.2 47.4 516.5 47.4L516.5 47.4Q510.6 47.4 505.8 49.3Q501.0 51.2 498.0 53.8Q495.0 56.3 494.3 58.3L494.3 58.3Q496.6 59 500.5 60.5Q504.3 62.1 505.7 63L505.7 63Q507.4 64.1 508.3 66.7Q509.2 69.3 509.2 72.7L509.2 72.7Q509.2 75.6 508.0 86.9L508.0 86.9L507.1 96.3Q506.9 98 505.5 99Q504.0 100 501.9 100L501.9 100Q499.7 100 498.4 98.9Q497.0 97.8 497.2 95.7L497.2 95.7L498.0 87.9Q499.3 75.3 499.3 72L499.3 72Q499.3 69.1 498.3 68.6L498.3 68.6L489.5 64.9Q487.2 63.8 486.2 62.7Q485.2 61.6 485.2 59.6L485.2 59.6Q485.2 55.4 489.4 50.9Q493.6 46.4 500.8 43.3Q508.0 40.3 516.7 40.3L516.7 40.3Q527.3 40.3 532.5 45.1Q537.6 49.9 539.2 57.3Q540.7 64.7 541.7 78.8L541.7 78.8Q542.3 87.9 542.3 95.6L542.3 95.6Q542.3 97.6 541 98.8Q539.7 100 537.3 100L537.3 100ZM586.8 100Q584.7 100 583.3 99.0Q581.9 97.9 581.9 96.2L581.9 96.2L582 65.8Q582 56.7 579.8 52.8Q577.6 49 572.4 49L572.4 49Q564 49 564 58.6L564 58.6Q564 60.2 562.6 61.1Q561.1 62.1 559 62.1L559 62.1Q557 62.1 555.6 61.1Q554.1 60.1 554.1 58.4L554.1 58.4Q554.1 50.2 558.8 45.8Q563.5 41.3 572.3 41.3L572.3 41.3Q582.9 41.3 587.4 47.3Q591.9 53.4 591.9 65.9L591.9 65.9L591.8 96.2Q591.8 97.9 590.4 99.0Q588.9 100 586.8 100L586.8 100ZM654.6 44.3Q656.3 44.3 657.5 45Q658.6 45.7 658.6 47.3L658.6 47.3Q658.6 52.6 656.4 55.5Q654.1 58.4 650.2 58.4L650.2 58.4Q647.7 58.4 645.8 57.3Q643.8 56.1 641.2 53.8L641.2 53.8Q637.9 51 635.2 49.5Q632.5 48.1 628.6 48.1L628.6 48.1Q624.7 48.1 621.5 49.8Q618.4 51.6 616.6 54Q614.8 56.4 614.8 58.1L614.8 58.1Q614.8 59.1 615.6 59.3Q616.4 59.6 619.1 59.6L619.1 59.6L633.2 59.6Q639.4 59.6 643.3 63.1Q647.1 66.7 647 73.1L647 73.1L646.9 87.8Q646.8 93.5 643.0 96.9Q639.1 100.3 633.2 100.3L633.2 100.3Q627.2 100.3 623.9 97Q620.6 93.7 620.6 88.9L620.6 88.9Q620.6 84.1 623.8 80.8Q627 77.5 632.4 77.5L632.4 77.5Q635.1 77.5 637.1 78.5L637.1 78.5L637.1 73.6Q637.1 69.4 635.9 68.1Q634.7 66.8 631.7 66.8L631.7 66.8L616.4 66.8Q610.2 66.8 607.7 65.4Q605.2 64.1 605.2 60.6L605.2 60.6Q605.2 56.2 608.3 51.6Q611.3 47.1 616.7 44.1Q622.1 41.1 628.6 41.1L628.6 41.1Q634.5 41.1 638.3 43.0Q642.1 45 645.9 48.2L645.9 48.2Q648.5 50.6 649.6 50.6L649.6 50.6Q651.4 50.6 651.4 46.8L651.4 46.8Q651.4 45.7 652.3 45Q653.2 44.3 654.6 44.3L654.6 44.3ZM633.3 94.8Q635.9 94.8 637.6 93.2Q639.3 91.6 639.3 89L639.3 89Q639.3 86.4 637.5 84.9Q635.8 83.4 633.2 83.4L633.2 83.4Q630.6 83.4 629 85.0Q627.4 86.5 627.4 89L627.4 89Q627.4 91.5 629.0 93.2Q630.7 94.8 633.3 94.8L633.3 94.8Z","parts":["M50.6 39.7Q52.7 39.7 54.2 40.8Q55.7 41.8 55.7 43.3L55.7 43.3L55.7 82.3Q55.7 91.6 49.5 96.0Q43.3 100.3 32.4 100.3L32.4 100.3Q21.6 100.3 15.0 96.3Q8.3 92.2 8.3 84.3L8.3 84.3Q8.3 79.5 10.1 76.3Q11.8 73.2 14.7 72.1L14.7 72.1Q11.6 71.4 9.7 67.1Q7.7 62.8 7.7 56.8L7.7 56.8Q7.7 48.5 11.6 44.1Q15.4 39.7 22.2 39.7L22.2 39.7Q28.2 39.7 31.7 43.1Q35.1 46.5 35.1 52.1L35.1 52.1Q35.1 57.5 31.8 60.6Q28.4 63.8 22.6 63.8L22.6 63.8Q18.9 63.8 16.1 62.3L16.1 62.3Q16.7 66 18.4 67.4Q20.1 68.9 23.2 68.9L23.2 68.9L28.8 68.9Q31.2 68.9 31.2 72.2L31.2 72.2Q31.2 75.2 28.8 75.2L28.8 75.2Q25.4 75.2 23.5 75.3L23.5 75.3Q20.5 75.4 19.3 78.2Q18 81 18 84.1L18 84.1Q18 92.6 32.6 92.6L32.6 92.6Q39.3 92.6 42.6 90.3Q45.8 87.9 45.8 82.4L45.8 82.4L45.7 43.4Q45.7 41.8 47.1 40.8Q48.5 39.7 50.6 39.7L50.6 39.7Z","M22.3 46.1Q19.5 46.1 17.7 47.8Q15.8 49.4 15.8 52.1L15.8 52.1Q15.8 55 17.8 56.5Q19.7 58.1 22.4 58.1L22.4 58.1Q25.1 58.1 26.7 56.4Q28.3 54.8 28.3 52.1L28.3 52.1Q28.3 49.4 26.8 47.8Q25.2 46.1 22.3 46.1L22.3 46.1Z","M23.7 31.5Q15.4 31.5 11.1 29.8Q6.7 28.1 6.7 24.2L6.7 24.2Q6.7 19.7 9.9 15.4Q13.1 11.1 18.1 8.3Q23.1 5.6 28.3 5.6L28.3 5.6Q34.7 5.6 41.1 9.8Q47.4 14 53.0 20.6L53.0 20.6Q55.4 23.4 55.4 25.8L55.4 25.8Q55.4 27.8 54.0 29Q52.5 30.2 50.3 30.2L50.3 30.2Q47.3 30.2 38.7 30.8L38.7 30.8Q27.3 31.5 23.7 31.5L23.7 31.5Z","M26.0 24.1Q31.1 24.1 35.5 23.8L35.5 23.8Q40.7 23.6 43.4 23.6L43.4 23.6Q45.9 23.6 45.9 22.9L45.9 22.9Q45.9 21.9 43.3 19.4Q40.6 17 36.6 15.1Q32.6 13.2 28.5 13.2L28.5 13.2Q25.3 13.2 22 14.6Q18.7 16 16.6 18.1Q14.4 20.3 14.4 22.4L14.4 22.4Q14.4 23.5 16.0 23.8Q17.5 24.1 21.3 24.1L21.3 24.1L26.0 24.1Z","M129.2 75.4Q134.9 75.4 138.3 79.2Q141.7 83 141.7 88.3L141.7 88.3Q141.7 93.4 138.4 97.1Q135.2 100.8 128.9 100.8L128.9 100.8Q117.9 100.8 115.7 87.8L115.7 87.8Q112 89.7 106.2 93.3L106.2 93.3Q98.2 97.9 97.1 98.5L97.1 98.5Q96.4 98.9 94.9 99.3Q93.4 99.7 91.7 99.7L91.7 99.7Q89.3 99.7 88.3 98.6Q87.3 97.5 87.1 95L87.1 95Q86.8 91.7 86.8 85.6L86.8 85.6Q86.8 80.4 86.9 78.2L86.9 78.2Q87.1 69.1 87.1 65.7L87.1 65.7Q84.7 67.4 81.1 67.4L81.1 67.4Q75.7 67.4 72.2 63.8Q68.6 60.1 68.6 54.6L68.6 54.6Q68.6 49.2 72.3 45.4Q75.9 41.6 82.8 41.6L82.8 41.6Q89.5 41.6 93.2 45.3Q96.8 49.1 96.8 56L96.8 56Q96.8 59.6 96.7 62.2L96.7 62.2Q96.5 70.6 96.5 77.1L96.5 77.1L96.5 82.4Q96.5 88 96.8 89.5L96.8 89.5Q108 82.8 115.2 79.3L115.2 79.3Q115.2 68.5 115.4 50.1L115.4 50.1Q115.5 48.2 115.5 45L115.5 45Q115.6 43.4 117.1 42.3Q118.5 41.3 120.7 41.3L120.7 41.3Q123 41.3 124.3 42.3Q125.5 43.3 125.5 45.1L125.5 45.1Q125.5 50.1 125.1 61.9L125.1 61.9Q125 64.5 124.9 68.0Q124.8 71.6 124.8 75.9L124.8 75.9Q127.3 75.4 129.2 75.4L129.2 75.4Z","M81.5 61.1Q84.6 61.1 86.7 59.3Q88.7 57.6 88.7 54.5L88.7 54.5Q88.7 51.6 86.9 49.7Q85.1 47.8 82.1 47.8L82.1 47.8Q79 47.8 77.1 49.8Q75.2 51.7 75.2 54.7L75.2 54.7Q75.2 57.5 76.9 59.3Q78.6 61.1 81.5 61.1L81.5 61.1Z","M129.6 94Q131.9 94 133.2 92.5Q134.5 90.9 134.5 88.6L134.5 88.6Q134.5 86.1 133.4 84.5Q132.2 82.9 129.9 82.9L129.9 82.9Q128.1 82.9 124.6 84L124.6 84Q124.6 89 125.7 91.5Q126.7 94 129.6 94L129.6 94Z","M179.6 39.9Q193.2 39.9 200.2 48.8Q207.2 57.7 207.2 73.4L207.2 73.4L207.2 96.8Q207.2 98.4 205.9 99.3Q204.6 100.2 202.4 100.2L202.4 100.2Q200.1 100.2 198.7 99.3Q197.3 98.4 197.3 96.8L197.3 96.8L197.3 73.8Q197.3 61.1 192.6 54.4Q187.8 47.7 179.3 47.7L179.3 47.7Q171.1 47.7 166.3 54.8Q161.4 61.8 161.4 77.1L161.4 77.1Q161.4 83 162 87.7Q162.6 92.4 163.6 92.4L163.6 92.4Q164.4 92.4 167.3 90.7Q170.2 88.9 173 86.5L173 86.5Q176.6 83.5 178.7 80.7L178.7 80.7Q178.2 80.8 177.1 80.8L177.1 80.8Q173.1 80.7 170.6 78Q168 75.3 168 71.3L168 71.3Q168 66.7 171.1 63.6Q174.1 60.6 179.1 60.6L179.1 60.6Q184 60.6 187.0 63.6Q189.9 66.6 189.9 71.3L189.9 71.3Q190 76.6 186.9 81.4Q183.8 86.2 178.9 90.8L178.9 90.8Q174.3 95.1 169.3 97.8Q164.2 100.5 160.6 100.5L160.6 100.5Q154.6 100.5 153.2 92.6L153.2 92.6Q152.6 89.7 152.3 84.2Q151.9 78.6 151.9 74.2L151.9 74.2Q151.9 57.5 159.1 48.7Q166.2 39.9 179.6 39.9L179.6 39.9Z","M173.8 71.1Q173.8 73.2 175.3 74.5Q176.7 75.9 178.8 75.9L178.8 75.9Q181.1 75.9 182.6 74.5Q184 73.2 184 70.9L184 70.9Q184 68.9 182.6 67.5Q181.1 66.1 179 66.1L179 66.1Q176.7 66.1 175.3 67.6Q173.8 69.1 173.8 71.1L173.8 71.1Z","M176.5 31.6Q166.1 31.6 161.7 29.8Q157.3 28.1 157.3 23.7L157.3 23.7Q157.3 19.4 160.6 15.1Q163.8 10.9 168.9 8.2Q173.9 5.5 178.9 5.5L178.9 5.5Q185.1 5.5 190.5 8.7Q195.9 11.9 198.4 15.8L198.4 15.8Q197.8 8.6 197.8 2.9L197.8 2.9Q197.8 1.4 199 0.6Q200.2-0.1 201.9-0.1L201.9-0.1Q203.5-0.1 204.9 0.7Q206.2 1.5 206.3 2.7L206.3 2.7Q206.4 11.8 207.3 24.9L207.3 24.9Q207.5 27.1 205.8 28.5Q204.1 29.9 201 30.1L201 30.1L198.9 30.3Q184 31.6 176.5 31.6L176.5 31.6Z","M177 25.2Q183.8 25.2 193.6 24.4L193.6 24.4Q194.9 24.3 198.7 23.5L198.7 23.5Q193.8 18.7 189.7 16.3Q185.5 13.8 179.9 13.8L179.9 13.8Q176.7 13.8 173.2 15.1Q169.7 16.5 167.3 18.6Q164.9 20.8 164.9 23.2L164.9 23.2Q164.9 25.2 177 25.2L177 25.2Z","M264.8 89.6Q264.9 94.4 261.8 97.3Q258.6 100.1 253.5 100.1L253.5 100.1Q248.2 100.1 245.1 97.2Q241.9 94.2 241.9 89.1L241.9 89.1Q241.9 80.8 242.1 70L242.1 70Q242.3 60.2 242.3 55.1L242.3 55.1Q242.3 47.4 242.4 43.9L242.4 43.9L242.5 30.2Q242.5 20.9 240.3 16.7Q238 12.5 232.8 12.5L232.8 12.5Q229.8 12.5 227.5 13.9Q225.1 15.3 224.2 17.8L224.2 17.8Q225.6 17.1 227.9 17.1L227.9 17.1Q232.5 17.1 235.5 19.9Q238.4 22.7 238.4 27.2L238.4 27.2Q238.4 31.9 235.3 34.8Q232.1 37.6 227 37.6L227 37.6Q222 37.6 218.6 34.1Q215.1 30.7 215.1 24.3L215.1 24.3Q215.1 15 220.0 10.1Q224.8 5.2 233.9 5.2L233.9 5.2Q243.3 5.2 248.0 11.5Q252.6 17.8 252.6 30.6L252.6 30.6Q252.6 34.8 252.4 42.8L252.4 42.8Q252.2 50.8 252.2 55.6L252.2 55.6Q252.2 63.4 252 74L252 74L251.9 79.9Q253.2 79.4 254.8 79.4L254.8 79.4Q259.2 79.4 262 82.3Q264.8 85.2 264.8 89.6L264.8 89.6Z","M227.1 21.9Q224.9 21.9 223.4 23.4Q221.8 24.9 221.7 27L221.7 27Q221.7 29.4 223.2 31Q224.6 32.6 227.1 32.6L227.1 32.6Q229.6 32.6 231.2 31.3Q232.8 29.9 232.8 27.5L232.8 27.5Q232.8 24.8 231.2 23.3Q229.5 21.9 227.1 21.9L227.1 21.9Z","M253.5 94.8Q255.8 94.8 257.1 93.5Q258.3 92.2 258.3 90L258.3 90Q258.3 87.8 257.1 86.5Q255.8 85.2 253.7 85.2L253.7 85.2Q251.3 85.2 249.9 86.5Q248.4 87.7 248.4 89.8L248.4 89.8Q248.4 91.9 249.8 93.3Q251.1 94.8 253.5 94.8L253.5 94.8Z","M335.5 53.4Q335.5 58 333.2 60.8Q330.9 63.7 327.4 65.6L327.4 65.6Q330.0 68.4 331.0 73Q332.0 77.6 332.0 86L332.0 86Q332.0 87.9 331.9 89.6L331.9 89.6Q331.7 94.6 331.7 97.3L331.7 97.3Q331.6 98.8 330.3 99.7Q328.9 100.6 326.7 100.6L326.7 100.6Q324.5 100.6 323.1 99.7Q321.7 98.8 321.7 97L321.7 97L321.9 91.7Q322.1 86.9 322.1 84.9L322.1 84.9Q322.1 79.4 321.8 76Q321.5 72.6 320.7 70.6L320.7 70.6Q316.8 74.9 312.4 81.1L312.4 81.1Q309.5 85.2 305.6 90.5Q301.6 95.7 299.7 97.5L299.7 97.5Q296.8 100.3 292.8 100.3L292.8 100.3Q289.7 100.3 288.0 99.0Q286.3 97.6 286.3 95.3L286.3 95.3L286.4 94.4Q287.5 86.8 289.8 71.8L289.8 71.8L290.4 68Q288.6 68.6 286.1 68.6L286.1 68.6Q279.7 68.6 276.0 64.6Q272.3 60.6 272.3 55.1L272.3 55.1Q272.3 48.9 276.5 44.9Q280.6 41 287.1 41L287.1 41Q293.6 41 297.6 44.9Q301.5 48.9 301.5 56.4L301.5 56.4Q301.5 60.1 300.9 64.7Q300.2 69.2 299.1 75.3L299.1 75.3L297.7 82.4Q297.5 83.3 296.8 86.8Q296.0 90.4 296.3 90.4L296.3 90.4Q296.5 90.4 298.7 87.3Q300.9 84.2 304.1 79.5L304.1 79.5Q304.8 78.6 307.2 75.1L307.2 75.1Q310.7 70.2 314.9 65.5L314.9 65.5Q307.4 61 307.4 53.3L307.4 53.3Q307.4 47.5 311.3 43.8Q315.1 40.2 321.3 40.2L321.3 40.2Q327.5 40.2 331.5 43.9Q335.5 47.6 335.5 53.4L335.5 53.4Z","M321.2 47.2Q318.4 47.2 316.8 48.9Q315.2 50.6 315.2 53.4L315.2 53.4Q315.2 56.1 316.7 57.8Q318.2 59.4 321.0 61L321.0 61Q324.0 59.5 325.7 57.7Q327.4 55.9 327.4 53.2L327.4 53.2Q327.4 50.5 325.7 48.8Q324.0 47.2 321.2 47.2L321.2 47.2Z","M279.8 55Q279.8 57.8 281.7 59.8Q283.5 61.8 286.6 61.8L286.6 61.8Q289.7 61.8 291.7 60.1Q293.7 58.4 293.7 55.1L293.7 55.1Q293.7 51.9 291.9 49.9Q290.0 47.9 287.0 47.9L287.0 47.9Q283.9 47.9 281.9 49.9Q279.8 52 279.8 55L279.8 55Z","M334.7 2.6Q336.3 2.6 337.6 3.5Q338.8 4.4 338.8 5.8L338.8 5.8Q338.8 12.3 336.2 17.0Q333.6 21.8 329.6 24.8L329.6 24.8Q326.6 27.1 320.6 28.8Q314.5 30.4 309.9 30.4L309.9 30.4Q307.9 30.4 306.7 29.5Q305.5 28.7 305.5 27.3L305.5 27.3Q305.5 26.6 306.2 25.2L306.2 25.2Q306.7 24.3 308.3 22.1L308.3 22.1L310.2 19.3L310.8 18.3L310.2 18.3Q306.8 18.3 304.3 16.0Q301.8 13.8 301.8 10.3L301.8 10.3Q301.8 6.8 304.2 4.4Q306.6 2.1 310.4 2.1L310.4 2.1Q314.9 2.1 317.5 4.4Q320.1 6.8 320.1 10.5L320.1 10.5Q320.1 15.7 317.2 20.8L317.2 20.8Q317.0 21.1 316.8 21.5Q316.5 22 316.1 22.5L316.1 22.5Q319.3 21.9 322.0 20.8Q324.7 19.7 326.0 18.4L326.0 18.4Q328.3 16.2 329.6 13.4Q330.8 10.6 330.8 6L330.8 6Q330.8 4.6 332.0 3.6Q333.1 2.6 334.7 2.6L334.7 2.6Z","M307.2 10.3Q307.2 11.8 308.2 12.6Q309.1 13.5 310.6 13.5L310.6 13.5Q312.0 13.5 313.0 12.7Q313.9 11.9 313.9 10.3L313.9 10.3Q313.9 9 313.1 8.0Q312.3 7.1 310.6 7.1L310.6 7.1Q309.0 7.1 308.1 8.0Q307.2 9 307.2 10.3L307.2 10.3Z","M409.0 73L409.1 82.3Q409.3 89.7 409.3 93.9L409.3 93.9Q409.3 99.9 402.8 100L402.8 100L385.7 100.1Q380.5 100.1 371.9 99.9L371.9 99.9Q368.6 99.8 367.1 98.0Q365.6 96.3 365.6 93.5L365.6 93.5Q365.6 87.5 365.8 77.9L365.8 77.9L365.9 65.5Q364.0 66.3 361.3 66.3L361.3 66.3Q355.4 66.3 351.7 62.6Q348.0 59 348.0 53.5L348.0 53.5Q348.0 47.9 351.8 44.2Q355.6 40.5 361.8 40.5L361.8 40.5Q368.5 40.5 372.2 44.4Q375.9 48.3 375.9 55.9L375.9 55.9L375.9 60Q375.9 65.7 375.7 75.3L375.7 75.3L375.6 88.5Q375.6 90.5 376.4 91.3Q377.1 92.1 378.7 92.1L378.7 92.1L396.7 92.1Q398.1 92.1 398.7 91.2Q399.2 90.2 399.2 88.2L399.2 88.2L399.1 73.1L399.0 61.8Q398.8 50.2 398.8 45.8L398.8 45.8Q398.8 41 403.7 41L403.7 41Q405.9 41 407.3 42Q408.7 43 408.7 45L408.7 45Q409.0 62.7 409.0 73L409.0 73Z","M354.8 53.6Q354.8 56.3 356.6 58.2Q358.3 60.1 361.3 60.1L361.3 60.1Q364.2 60.1 366.2 58.3Q368.2 56.6 368.2 53.7L368.2 53.7Q368.2 50.9 366.4 49Q364.5 47.1 361.5 47.1L361.5 47.1Q358.5 47.1 356.7 48.9Q354.8 50.7 354.8 53.6L354.8 53.6Z","M471.7 44.3Q473.4 44.3 474.6 45Q475.7 45.7 475.7 47.3L475.7 47.3Q475.7 52.6 473.5 55.5Q471.2 58.4 467.3 58.4L467.3 58.4Q464.8 58.4 462.9 57.3Q460.9 56.1 458.3 53.8L458.3 53.8Q455 51 452.3 49.5Q449.6 48.1 445.7 48.1L445.7 48.1Q441.8 48.1 438.7 49.8Q435.5 51.6 433.7 54Q431.9 56.4 431.9 58.1L431.9 58.1Q431.9 59.1 432.7 59.3Q433.5 59.6 436.2 59.6L436.2 59.6L450.3 59.6Q456.5 59.6 460.4 63.1Q464.2 66.7 464.1 73.1L464.1 73.1L464 87.8Q463.9 93.5 460.1 96.9Q456.2 100.3 450.3 100.3L450.3 100.3Q444.3 100.3 441 97Q437.7 93.7 437.7 88.9L437.7 88.9Q437.7 84.1 440.9 80.8Q444.1 77.5 449.5 77.5L449.5 77.5Q452.2 77.5 454.2 78.5L454.2 78.5L454.2 73.6Q454.2 69.4 453 68.1Q451.8 66.8 448.8 66.8L448.8 66.8L433.5 66.8Q427.3 66.8 424.8 65.4Q422.3 64.1 422.3 60.6L422.3 60.6Q422.3 56.2 425.4 51.6Q428.4 47.1 433.8 44.1Q439.2 41.1 445.7 41.1L445.7 41.1Q451.6 41.1 455.4 43.0Q459.2 45 463 48.2L463 48.2Q465.6 50.6 466.7 50.6L466.7 50.6Q468.5 50.6 468.5 46.8L468.5 46.8Q468.5 45.7 469.4 45Q470.3 44.3 471.7 44.3L471.7 44.3Z","M450.4 94.8Q453 94.8 454.7 93.2Q456.4 91.6 456.4 89L456.4 89Q456.4 86.4 454.7 84.9Q452.9 83.4 450.3 83.4L450.3 83.4Q447.7 83.4 446.1 85.0Q444.5 86.5 444.5 89L444.5 89Q444.5 91.5 446.2 93.2Q447.8 94.8 450.4 94.8L450.4 94.8Z","M439.2 31.5Q430.9 31.5 426.6 29.8Q422.2 28.1 422.2 24.2L422.2 24.2Q422.2 19.7 425.4 15.4Q428.6 11.1 433.6 8.3Q438.6 5.6 443.8 5.6L443.8 5.6Q450.2 5.6 456.6 9.8Q462.9 14 468.5 20.6L468.5 20.6Q470.9 23.4 470.9 25.8L470.9 25.8Q470.9 27.8 469.5 29Q468.0 30.2 465.8 30.2L465.8 30.2Q462.8 30.2 454.2 30.8L454.2 30.8Q442.8 31.5 439.2 31.5L439.2 31.5Z","M441.5 24.1Q446.6 24.1 451.0 23.8L451.0 23.8Q456.2 23.6 458.9 23.6L458.9 23.6Q461.4 23.6 461.4 22.9L461.4 22.9Q461.4 21.9 458.8 19.4Q456.1 17 452.1 15.1Q448.1 13.2 444.0 13.2L444.0 13.2Q440.8 13.2 437.5 14.6Q434.2 16 432.1 18.1Q429.9 20.3 429.9 22.4L429.9 22.4Q429.9 23.5 431.5 23.8Q433 24.1 436.8 24.1L436.8 24.1L441.5 24.1Z","M537.3 100Q532.3 100 532.3 95.5L532.3 95.5Q532.3 88.9 531.8 79.4L531.8 79.4Q531.1 65.9 529.7 59.3Q528.2 52.6 525.2 50Q522.2 47.4 516.5 47.4L516.5 47.4Q510.6 47.4 505.8 49.3Q501.0 51.2 498.0 53.8Q495.0 56.3 494.3 58.3L494.3 58.3Q496.6 59 500.5 60.5Q504.3 62.1 505.7 63L505.7 63Q507.4 64.1 508.3 66.7Q509.2 69.3 509.2 72.7L509.2 72.7Q509.2 75.6 508.0 86.9L508.0 86.9L507.1 96.3Q506.9 98 505.5 99Q504.0 100 501.9 100L501.9 100Q499.7 100 498.4 98.9Q497.0 97.8 497.2 95.7L497.2 95.7L498.0 87.9Q499.3 75.3 499.3 72L499.3 72Q499.3 69.1 498.3 68.6L498.3 68.6L489.5 64.9Q487.2 63.8 486.2 62.7Q485.2 61.6 485.2 59.6L485.2 59.6Q485.2 55.4 489.4 50.9Q493.6 46.4 500.8 43.3Q508.0 40.3 516.7 40.3L516.7 40.3Q527.3 40.3 532.5 45.1Q537.6 49.9 539.2 57.3Q540.7 64.7 541.7 78.8L541.7 78.8Q542.3 87.9 542.3 95.6L542.3 95.6Q542.3 97.6 541 98.8Q539.7 100 537.3 100L537.3 100Z","M586.8 100Q584.7 100 583.3 99.0Q581.9 97.9 581.9 96.2L581.9 96.2L582 65.8Q582 56.7 579.8 52.8Q577.6 49 572.4 49L572.4 49Q564 49 564 58.6L564 58.6Q564 60.2 562.6 61.1Q561.1 62.1 559 62.1L559 62.1Q557 62.1 555.6 61.1Q554.1 60.1 554.1 58.4L554.1 58.4Q554.1 50.2 558.8 45.8Q563.5 41.3 572.3 41.3L572.3 41.3Q582.9 41.3 587.4 47.3Q591.9 53.4 591.9 65.9L591.9 65.9L591.8 96.2Q591.8 97.9 590.4 99.0Q588.9 100 586.8 100L586.8 100Z","M654.6 44.3Q656.3 44.3 657.5 45Q658.6 45.7 658.6 47.3L658.6 47.3Q658.6 52.6 656.4 55.5Q654.1 58.4 650.2 58.4L650.2 58.4Q647.7 58.4 645.8 57.3Q643.8 56.1 641.2 53.8L641.2 53.8Q637.9 51 635.2 49.5Q632.5 48.1 628.6 48.1L628.6 48.1Q624.7 48.1 621.5 49.8Q618.4 51.6 616.6 54Q614.8 56.4 614.8 58.1L614.8 58.1Q614.8 59.1 615.6 59.3Q616.4 59.6 619.1 59.6L619.1 59.6L633.2 59.6Q639.4 59.6 643.3 63.1Q647.1 66.7 647 73.1L647 73.1L646.9 87.8Q646.8 93.5 643.0 96.9Q639.1 100.3 633.2 100.3L633.2 100.3Q627.2 100.3 623.9 97Q620.6 93.7 620.6 88.9L620.6 88.9Q620.6 84.1 623.8 80.8Q627 77.5 632.4 77.5L632.4 77.5Q635.1 77.5 637.1 78.5L637.1 78.5L637.1 73.6Q637.1 69.4 635.9 68.1Q634.7 66.8 631.7 66.8L631.7 66.8L616.4 66.8Q610.2 66.8 607.7 65.4Q605.2 64.1 605.2 60.6L605.2 60.6Q605.2 56.2 608.3 51.6Q611.3 47.1 616.7 44.1Q622.1 41.1 628.6 41.1L628.6 41.1Q634.5 41.1 638.3 43.0Q642.1 45 645.9 48.2L645.9 48.2Q648.5 50.6 649.6 50.6L649.6 50.6Q651.4 50.6 651.4 46.8L651.4 46.8Q651.4 45.7 652.3 45Q653.2 44.3 654.6 44.3L654.6 44.3Z","M633.3 94.8Q635.9 94.8 637.6 93.2Q639.3 91.6 639.3 89L639.3 89Q639.3 86.4 637.5 84.9Q635.8 83.4 633.2 83.4L633.2 83.4Q630.6 83.4 629 85.0Q627.4 86.5 627.4 89L627.4 89Q627.4 91.5 629.0 93.2Q630.7 94.8 633.3 94.8L633.3 94.8Z"]},"Welcome":{"vb":"-4.4 10.8 442 99.8","full":"M27.9 99.9Q25.5 99.9 23.6 98.7Q21.7 97.5 21.2 95.5L21.2 95.5Q20.4 92.8 17.3 79.8L17.3 79.8Q15.2 70.2 13 61.9L13 61.9Q9.6 48.6 5.8 35.7L5.8 35.7Q5.6 34.7 5.6 34L5.6 34Q5.6 32 7.1 30.8Q8.6 29.5 11.1 29.5L11.1 29.5Q12.9 29.5 14 30.3Q15.1 31.1 15.5 32.9L15.5 32.9L17.2 39.1Q20.3 50.2 22.5 59.6L22.5 59.6L24.9 70.1Q26.7 78 27.6 81.7Q28.5 85.4 29 85.4L29 85.4Q29.4 85.4 30.2 83.8Q30.9 82.1 31.5 80.5Q32.1 78.9 32.4 78.2L32.4 78.2L35.1 71.5Q38.4 63.6 40.0 60.8Q41.5 57.9 43.5 57.9L43.5 57.9Q45.5 57.9 47.2 60.5Q48.8 63.1 52.2 70.3L52.2 70.3L53.2 72.4L56 78.3Q57.3 81.2 58.4 83.3Q59.4 85.3 59.8 85.3L59.8 85.3Q60.1 85.3 61.1 80.9Q62 76.5 63.1 71L63.1 71L65.3 59.8Q68.2 45.9 71.3 32.9L71.3 32.9Q71.7 31.3 72.9 30.5Q74.1 29.6 76 29.6L76 29.6Q78.3 29.6 79.8 30.8Q81.3 32.1 81.3 34.2L81.3 34.2Q81.3 35 81.2 35.5L81.2 35.5Q79.1 43.5 74.9 61.8L74.9 61.8Q73.4 68.3 71.2 79.1L71.2 79.1Q69.3 88.6 67.9 94.9L67.9 94.9Q67 99.7 61.5 99.7L61.5 99.7Q58.6 99.7 56.2 97Q53.7 94.3 50.2 87.3L50.2 87.3Q48.6 84 46.9 80.2L46.9 80.2Q44.5 74.4 44 74.4L44 74.4Q43.7 74.4 43.2 75.7Q42.6 76.9 42.1 78.3Q41.5 79.6 41.1 80.6L41.1 80.6Q39.3 85.3 38 88.1L38 88.1Q34.9 95 32.8 97.5Q30.6 99.9 27.9 99.9L27.9 99.9ZM118.8 100.6Q110.3 100.6 104.3 97.1Q98.2 93.6 95.2 87.7Q92.1 81.8 92.1 74.7L92.1 74.7Q92.1 67.4 95.4 61.4Q98.7 55.5 104.7 52.0Q110.7 48.6 118.4 48.6L118.4 48.6Q125.2 48.6 130.7 51.3Q136.1 54.1 139.2 59.1Q142.3 64.1 142.3 70.5L142.3 70.5Q142.3 73.9 141.3 75.3Q140.3 76.8 137.2 76.9L137.2 76.9L101.1 77.4Q101.1 80.7 103.2 84.2Q105.3 87.7 109.3 90.0Q113.2 92.4 118.5 92.4L118.5 92.4Q122.3 92.4 125.0 91.3Q127.6 90.3 129.2 88.8Q130.8 87.4 133 85L133 85Q134.1 83.9 135.8 83.9L135.8 83.9Q137.4 83.9 138.9 85.2Q140.3 86.4 140.3 88L140.3 88Q140.3 89.3 139.4 90.5L139.4 90.5Q136.6 94.5 131.9 97.5Q127.2 100.6 118.8 100.6L118.8 100.6ZM101.1 70.4L132.9 69.8Q133.5 69.8 133.8 69.5Q134 69.1 134 68.4L134 68.4Q134 63.1 129.6 59.8Q125.1 56.4 118.4 56.4L118.4 56.4Q113.3 56.4 109.4 58.8Q105.4 61.2 103.3 64.5Q101.1 67.9 101.1 70.4L101.1 70.4ZM160.5 99.1Q158.3 99.1 157 97.9Q155.7 96.7 155.7 94.8L155.7 94.8L155.1 25.2Q155.1 23.2 156.6 22Q158 20.8 160.2 20.8L160.2 20.8Q162.4 20.8 163.7 22Q165 23.2 165 25.1L165 25.1L165.5 94.7Q165.5 96.7 164.1 97.9Q162.7 99.1 160.5 99.1L160.5 99.1ZM203.9 100Q196.1 100 190.4 96.8Q184.7 93.6 181.6 88.1Q178.6 82.6 178.6 75.7L178.6 75.7Q178.6 68.5 181.8 62.3Q184.9 56 190.8 52.3Q196.6 48.6 204.4 48.6L204.4 48.6Q212.8 48.6 218.6 52.6Q224.4 56.7 226.7 62.6L226.7 62.6Q227.3 63.8 227.3 64.9L227.3 64.9Q227.3 67.2 224.1 68.1L224.1 68.1Q222.9 68.3 222.6 68.3L222.6 68.3Q221.1 68.3 220.1 67.4Q219.1 66.6 218.2 64.9L218.2 64.9Q216.6 61.4 213.2 58.9Q209.8 56.5 205 56.5L205 56.5Q200.1 56.5 196.3 59.1Q192.6 61.7 190.5 66.1Q188.5 70.5 188.5 75.6L188.5 75.6Q188.5 82.9 192.6 87.5Q196.8 92.1 204.5 92.1L204.5 92.1Q209.4 92.1 212.8 90.2Q216.2 88.3 217.8 85.4Q219.5 82.5 219.7 79.5L219.7 79.5Q219.7 78.2 220.8 77.3Q221.8 76.5 223.7 76.5L223.7 76.5Q226.1 76.5 227.3 77.5Q228.6 78.4 228.6 80.8L228.6 80.8Q228.5 85.4 225.8 89.8Q223 94.2 217.5 97.1Q212 100 203.9 100L203.9 100ZM262.9 100.2Q251.1 100.2 243.6 94.0Q236.2 87.7 236.2 75.2L236.2 75.2Q236.2 67.3 239.3 61.2Q242.5 55.1 248.3 51.7Q254.2 48.3 262.2 48.3L262.2 48.3Q270 48.3 276.1 51.6Q282.3 54.9 285.8 61.0Q289.2 67.2 289.2 75.4L289.2 75.4Q289.2 87.4 282 93.8Q274.8 100.2 262.9 100.2L262.9 100.2ZM262.7 92.3Q270.1 92.3 274.7 88.0Q279.3 83.6 279.3 75.2L279.3 75.2Q279.3 69.8 277.3 65.4Q275.2 61.1 271.3 58.6Q267.5 56.2 262.5 56.2L262.5 56.2Q255.1 56.2 250.6 61.3Q246.2 66.5 246.2 75.1L246.2 75.1Q246.2 83.9 250.9 88.1Q255.6 92.3 262.7 92.3L262.7 92.3ZM348.6 49.2Q357.8 49.2 361.6 55.5Q365.5 61.8 365.5 72.9L365.5 72.9L365.3 96.1Q365.3 97.9 364.1 99.0Q362.9 100 360.7 100L360.7 100Q358.5 100 357.2 98.9Q355.9 97.8 355.9 95.8L355.9 95.8L355.9 72.9Q355.9 64.2 354.1 60.4Q352.4 56.7 347.8 56.7L347.8 56.7Q343.8 56.7 341.6 61.6Q339.5 66.5 339.4 73.9L339.4 73.9L339.4 81.3L339.4 95.8Q339.4 99.8 334.7 99.8L334.7 99.8Q329.6 99.8 329.6 95.7L329.6 95.7L329.7 78.4L329.7 73.9Q329.7 66.8 327.3 61.9Q325.0 57.1 320.8 57.1L320.8 57.1Q314.6 57.1 311.7 70.8L311.7 70.8Q310.9 75.1 310.9 83.2L310.9 83.2L310.9 90L310.9 96.3Q310.9 97.9 309.5 98.8Q308.2 99.8 306.4 99.8L306.4 99.8Q304.2 99.8 302.8 98.9Q301.5 98 301.5 96.2L301.5 96.2Q301.5 74.5 301.4 62L301.4 62Q301.3 59.6 300.8 58.4Q300.4 57.3 299.5 56.5L299.5 56.5Q299.4 56.4 298.8 55.9Q298.3 55.4 298.3 54.5L298.3 54.5Q298.3 52.6 299.7 51.4Q301.1 50.2 302.8 50.2L302.8 50.2Q304.5 50.2 306.4 52.9L306.4 52.9Q308.3 55.4 308.3 58.7L308.3 58.7L308.3 60.1Q310.0 55.2 313.3 52.3Q316.6 49.5 321.4 49.5L321.4 49.5Q331 49.5 334.3 59.4L334.3 59.4Q336 54.5 339.7 51.8Q343.4 49.2 348.6 49.2L348.6 49.2ZM404.1 100.6Q395.6 100.6 389.6 97.1Q383.5 93.6 380.4 87.7Q377.4 81.8 377.4 74.7L377.4 74.7Q377.4 67.4 380.7 61.4Q384 55.5 390 52.0Q396 48.6 403.7 48.6L403.7 48.6Q410.5 48.6 415.9 51.3Q421.4 54.1 424.5 59.1Q427.6 64.1 427.6 70.5L427.6 70.5Q427.6 73.9 426.6 75.3Q425.6 76.8 422.5 76.9L422.5 76.9L386.4 77.4Q386.4 80.7 388.5 84.2Q390.6 87.7 394.6 90.0Q398.5 92.4 403.8 92.4L403.8 92.4Q407.6 92.4 410.3 91.3Q412.9 90.3 414.5 88.8Q416.1 87.4 418.3 85L418.3 85Q419.4 83.9 421.1 83.9L421.1 83.9Q422.7 83.9 424.1 85.2Q425.6 86.4 425.6 88L425.6 88Q425.6 89.3 424.7 90.5L424.7 90.5Q421.9 94.5 417.2 97.5Q412.5 100.6 404.1 100.6L404.1 100.6ZM386.4 70.4L418.2 69.8Q418.8 69.8 419.1 69.5Q419.3 69.1 419.3 68.4L419.3 68.4Q419.3 63.1 414.9 59.8Q410.4 56.4 403.7 56.4L403.7 56.4Q398.6 56.4 394.6 58.8Q390.7 61.2 388.6 64.5Q386.4 67.9 386.4 70.4L386.4 70.4Z","parts":["M27.9 99.9Q25.5 99.9 23.6 98.7Q21.7 97.5 21.2 95.5L21.2 95.5Q20.4 92.8 17.3 79.8L17.3 79.8Q15.2 70.2 13 61.9L13 61.9Q9.6 48.6 5.8 35.7L5.8 35.7Q5.6 34.7 5.6 34L5.6 34Q5.6 32 7.1 30.8Q8.6 29.5 11.1 29.5L11.1 29.5Q12.9 29.5 14 30.3Q15.1 31.1 15.5 32.9L15.5 32.9L17.2 39.1Q20.3 50.2 22.5 59.6L22.5 59.6L24.9 70.1Q26.7 78 27.6 81.7Q28.5 85.4 29 85.4L29 85.4Q29.4 85.4 30.2 83.8Q30.9 82.1 31.5 80.5Q32.1 78.9 32.4 78.2L32.4 78.2L35.1 71.5Q38.4 63.6 40.0 60.8Q41.5 57.9 43.5 57.9L43.5 57.9Q45.5 57.9 47.2 60.5Q48.8 63.1 52.2 70.3L52.2 70.3L53.2 72.4L56 78.3Q57.3 81.2 58.4 83.3Q59.4 85.3 59.8 85.3L59.8 85.3Q60.1 85.3 61.1 80.9Q62 76.5 63.1 71L63.1 71L65.3 59.8Q68.2 45.9 71.3 32.9L71.3 32.9Q71.7 31.3 72.9 30.5Q74.1 29.6 76 29.6L76 29.6Q78.3 29.6 79.8 30.8Q81.3 32.1 81.3 34.2L81.3 34.2Q81.3 35 81.2 35.5L81.2 35.5Q79.1 43.5 74.9 61.8L74.9 61.8Q73.4 68.3 71.2 79.1L71.2 79.1Q69.3 88.6 67.9 94.9L67.9 94.9Q67 99.7 61.5 99.7L61.5 99.7Q58.6 99.7 56.2 97Q53.7 94.3 50.2 87.3L50.2 87.3Q48.6 84 46.9 80.2L46.9 80.2Q44.5 74.4 44 74.4L44 74.4Q43.7 74.4 43.2 75.7Q42.6 76.9 42.1 78.3Q41.5 79.6 41.1 80.6L41.1 80.6Q39.3 85.3 38 88.1L38 88.1Q34.9 95 32.8 97.5Q30.6 99.9 27.9 99.9L27.9 99.9Z","M118.8 100.6Q110.3 100.6 104.3 97.1Q98.2 93.6 95.2 87.7Q92.1 81.8 92.1 74.7L92.1 74.7Q92.1 67.4 95.4 61.4Q98.7 55.5 104.7 52.0Q110.7 48.6 118.4 48.6L118.4 48.6Q125.2 48.6 130.7 51.3Q136.1 54.1 139.2 59.1Q142.3 64.1 142.3 70.5L142.3 70.5Q142.3 73.9 141.3 75.3Q140.3 76.8 137.2 76.9L137.2 76.9L101.1 77.4Q101.1 80.7 103.2 84.2Q105.3 87.7 109.3 90.0Q113.2 92.4 118.5 92.4L118.5 92.4Q122.3 92.4 125.0 91.3Q127.6 90.3 129.2 88.8Q130.8 87.4 133 85L133 85Q134.1 83.9 135.8 83.9L135.8 83.9Q137.4 83.9 138.9 85.2Q140.3 86.4 140.3 88L140.3 88Q140.3 89.3 139.4 90.5L139.4 90.5Q136.6 94.5 131.9 97.5Q127.2 100.6 118.8 100.6L118.8 100.6Z","M101.1 70.4L132.9 69.8Q133.5 69.8 133.8 69.5Q134 69.1 134 68.4L134 68.4Q134 63.1 129.6 59.8Q125.1 56.4 118.4 56.4L118.4 56.4Q113.3 56.4 109.4 58.8Q105.4 61.2 103.3 64.5Q101.1 67.9 101.1 70.4L101.1 70.4Z","M160.5 99.1Q158.3 99.1 157 97.9Q155.7 96.7 155.7 94.8L155.7 94.8L155.1 25.2Q155.1 23.2 156.6 22Q158 20.8 160.2 20.8L160.2 20.8Q162.4 20.8 163.7 22Q165 23.2 165 25.1L165 25.1L165.5 94.7Q165.5 96.7 164.1 97.9Q162.7 99.1 160.5 99.1L160.5 99.1Z","M203.9 100Q196.1 100 190.4 96.8Q184.7 93.6 181.6 88.1Q178.6 82.6 178.6 75.7L178.6 75.7Q178.6 68.5 181.8 62.3Q184.9 56 190.8 52.3Q196.6 48.6 204.4 48.6L204.4 48.6Q212.8 48.6 218.6 52.6Q224.4 56.7 226.7 62.6L226.7 62.6Q227.3 63.8 227.3 64.9L227.3 64.9Q227.3 67.2 224.1 68.1L224.1 68.1Q222.9 68.3 222.6 68.3L222.6 68.3Q221.1 68.3 220.1 67.4Q219.1 66.6 218.2 64.9L218.2 64.9Q216.6 61.4 213.2 58.9Q209.8 56.5 205 56.5L205 56.5Q200.1 56.5 196.3 59.1Q192.6 61.7 190.5 66.1Q188.5 70.5 188.5 75.6L188.5 75.6Q188.5 82.9 192.6 87.5Q196.8 92.1 204.5 92.1L204.5 92.1Q209.4 92.1 212.8 90.2Q216.2 88.3 217.8 85.4Q219.5 82.5 219.7 79.5L219.7 79.5Q219.7 78.2 220.8 77.3Q221.8 76.5 223.7 76.5L223.7 76.5Q226.1 76.5 227.3 77.5Q228.6 78.4 228.6 80.8L228.6 80.8Q228.5 85.4 225.8 89.8Q223 94.2 217.5 97.1Q212 100 203.9 100L203.9 100Z","M262.9 100.2Q251.1 100.2 243.6 94.0Q236.2 87.7 236.2 75.2L236.2 75.2Q236.2 67.3 239.3 61.2Q242.5 55.1 248.3 51.7Q254.2 48.3 262.2 48.3L262.2 48.3Q270 48.3 276.1 51.6Q282.3 54.9 285.8 61.0Q289.2 67.2 289.2 75.4L289.2 75.4Q289.2 87.4 282 93.8Q274.8 100.2 262.9 100.2L262.9 100.2Z","M262.7 92.3Q270.1 92.3 274.7 88.0Q279.3 83.6 279.3 75.2L279.3 75.2Q279.3 69.8 277.3 65.4Q275.2 61.1 271.3 58.6Q267.5 56.2 262.5 56.2L262.5 56.2Q255.1 56.2 250.6 61.3Q246.2 66.5 246.2 75.1L246.2 75.1Q246.2 83.9 250.9 88.1Q255.6 92.3 262.7 92.3L262.7 92.3Z","M348.6 49.2Q357.8 49.2 361.6 55.5Q365.5 61.8 365.5 72.9L365.5 72.9L365.3 96.1Q365.3 97.9 364.1 99.0Q362.9 100 360.7 100L360.7 100Q358.5 100 357.2 98.9Q355.9 97.8 355.9 95.8L355.9 95.8L355.9 72.9Q355.9 64.2 354.1 60.4Q352.4 56.7 347.8 56.7L347.8 56.7Q343.8 56.7 341.6 61.6Q339.5 66.5 339.4 73.9L339.4 73.9L339.4 81.3L339.4 95.8Q339.4 99.8 334.7 99.8L334.7 99.8Q329.6 99.8 329.6 95.7L329.6 95.7L329.7 78.4L329.7 73.9Q329.7 66.8 327.3 61.9Q325.0 57.1 320.8 57.1L320.8 57.1Q314.6 57.1 311.7 70.8L311.7 70.8Q310.9 75.1 310.9 83.2L310.9 83.2L310.9 90L310.9 96.3Q310.9 97.9 309.5 98.8Q308.2 99.8 306.4 99.8L306.4 99.8Q304.2 99.8 302.8 98.9Q301.5 98 301.5 96.2L301.5 96.2Q301.5 74.5 301.4 62L301.4 62Q301.3 59.6 300.8 58.4Q300.4 57.3 299.5 56.5L299.5 56.5Q299.4 56.4 298.8 55.9Q298.3 55.4 298.3 54.5L298.3 54.5Q298.3 52.6 299.7 51.4Q301.1 50.2 302.8 50.2L302.8 50.2Q304.5 50.2 306.4 52.9L306.4 52.9Q308.3 55.4 308.3 58.7L308.3 58.7L308.3 60.1Q310.0 55.2 313.3 52.3Q316.6 49.5 321.4 49.5L321.4 49.5Q331 49.5 334.3 59.4L334.3 59.4Q336 54.5 339.7 51.8Q343.4 49.2 348.6 49.2L348.6 49.2Z","M404.1 100.6Q395.6 100.6 389.6 97.1Q383.5 93.6 380.4 87.7Q377.4 81.8 377.4 74.7L377.4 74.7Q377.4 67.4 380.7 61.4Q384 55.5 390 52.0Q396 48.6 403.7 48.6L403.7 48.6Q410.5 48.6 415.9 51.3Q421.4 54.1 424.5 59.1Q427.6 64.1 427.6 70.5L427.6 70.5Q427.6 73.9 426.6 75.3Q425.6 76.8 422.5 76.9L422.5 76.9L386.4 77.4Q386.4 80.7 388.5 84.2Q390.6 87.7 394.6 90.0Q398.5 92.4 403.8 92.4L403.8 92.4Q407.6 92.4 410.3 91.3Q412.9 90.3 414.5 88.8Q416.1 87.4 418.3 85L418.3 85Q419.4 83.9 421.1 83.9L421.1 83.9Q422.7 83.9 424.1 85.2Q425.6 86.4 425.6 88L425.6 88Q425.6 89.3 424.7 90.5L424.7 90.5Q421.9 94.5 417.2 97.5Q412.5 100.6 404.1 100.6L404.1 100.6Z","M386.4 70.4L418.2 69.8Q418.8 69.8 419.1 69.5Q419.3 69.1 419.3 68.4L419.3 68.4Q419.3 63.1 414.9 59.8Q410.4 56.4 403.7 56.4L403.7 56.4Q398.6 56.4 394.6 58.8Q390.7 61.2 388.6 64.5Q386.4 67.9 386.4 70.4L386.4 70.4Z"]},"At your service":{"vb":"-3.1 18.9 772.9 117.2","full":"M58.1 83.5L61.7 95.4Q62 96.4 62 96.9L62 96.9Q62 98.9 60.4 100.0Q58.8 101 56.4 101L56.4 101Q54.7 101 53.4 100.3Q52.1 99.5 51.7 98.2L51.7 98.2Q49.3 90.1 47.5 83.5L47.5 83.5L21.7 83.4L17.3 97.8Q16.4 100.9 12.5 100.9L12.5 100.9Q10.3 100.9 8.6 99.8Q6.9 98.6 6.9 96.8L6.9 96.8Q6.9 96.2 7.2 95.3L7.2 95.3Q17.2 65.4 22.5 49.3L22.5 49.3L25.3 40.6Q27.5 34.2 29.7 31.5Q31.9 28.9 35.4 28.9L35.4 28.9Q38.7 28.9 40.8 31.3Q42.8 33.7 44.7 39.6L44.7 39.6Q49.5 54.7 55.3 74.1L55.3 74.1L58.1 74.1Q60.1 74.1 61.2 75.3Q62.2 76.6 62.2 78.8L62.2 78.8Q62.2 83.5 58.9 83.5L58.9 83.5L58.1 83.5ZM24.7 73.8L44.8 74L44.2 71.7Q40.3 57.9 38 50.3L38 50.3Q37.7 49.4 37 47Q36.3 44.6 35.9 43.6Q35.4 42.6 35 42.6L35 42.6Q34.5 42.6 34.1 43.8Q33.6 44.9 32.8 47.8L32.8 47.8Q32.7 48.3 32.5 48.8Q32.3 49.3 32.1 50L32.1 50Q31.7 51.4 31.4 52.1L31.4 52.1Q30.3 55.6 28.7 60.8Q27.1 65.9 24.7 73.8L24.7 73.8ZM104.8 82.5Q107.1 82.5 108.1 83.5Q109.1 84.5 109.1 86.9L109.1 86.9Q109.1 92.6 105.4 96.3Q101.7 100.1 96 100.1L96 100.1Q88.1 100.1 84.6 93.3Q81.1 86.6 81.1 72.2L81.1 72.2Q81.1 67.1 81.4 62L81.4 62L76.6 61.7Q72.7 61.5 72.7 57.6L72.7 57.6Q72.7 55.6 73.8 54.6Q74.8 53.7 77.2 53.8L77.2 53.8L82.1 54.1Q82.7 47.8 84.4 36.6L84.4 36.6Q85 33 89.3 33L89.3 33Q91.8 33 93.2 34.3Q94.5 35.6 94.3 37.4L94.3 37.4Q92.9 46.1 91.9 54.6L91.9 54.6Q97.3 54.8 99 54.8L99 54.8Q100.9 54.8 101.8 55.6Q102.7 56.5 102.7 58.3L102.7 58.3Q102.7 60.5 101.8 61.3Q100.8 62.2 98.3 62.3L98.3 62.3L91.2 62.3Q90.9 67.1 90.9 72.2L90.9 72.2Q90.9 82.3 92.2 87.2Q93.5 92 96.8 92L96.8 92Q100.6 92 100.9 86.1L100.9 86.1Q100.9 84.3 101.8 83.4Q102.6 82.5 104.8 82.5L104.8 82.5ZM168.8 126.1Q166.6 126.1 165.1 124.8Q163.6 123.4 163.6 121.5L163.6 121.5Q163.6 120.6 164 119.8L164 119.8Q168.6 107.9 172.8 96.1L172.8 96.1Q168.5 93.2 164.1 86.0Q159.6 78.9 156.1 70.3Q152.6 61.6 150.9 54.5L150.9 54.5Q150.7 53.7 150.7 53L150.7 53Q150.7 51.3 152.1 50.2Q153.4 49.1 155.6 49.1L155.6 49.1Q157.5 49.1 158.4 49.9Q159.2 50.7 159.6 52.4L159.6 52.4Q168.2 81.2 176.1 86.5L176.1 86.5Q179.6 74.5 185.4 51.9L185.4 51.9Q185.9 50.2 186.8 49.5Q187.7 48.8 189.5 48.8L189.5 48.8Q191.9 48.8 193.4 49.8Q194.8 50.9 195 52.6L195 52.6Q195.1 53 194.9 53.7L194.9 53.7Q191.9 65.7 189.5 74.3Q187.1 82.9 184.1 91.8L184.1 91.8Q181.8 98.7 178.5 108.3Q175.1 117.9 173.1 122.9L173.1 122.9Q172.5 124.5 171.6 125.3Q170.6 126.1 168.8 126.1L168.8 126.1ZM229.8 100.2Q218.0 100.2 210.6 94.0Q203.1 87.7 203.1 75.2L203.1 75.2Q203.1 67.3 206.3 61.2Q209.4 55.1 215.3 51.7Q221.1 48.3 229.1 48.3L229.1 48.3Q236.9 48.3 243.1 51.6Q249.2 54.9 252.7 61.0Q256.1 67.2 256.1 75.4L256.1 75.4Q256.1 87.4 248.9 93.8Q241.7 100.2 229.8 100.2L229.8 100.2ZM229.6 92.3Q237.0 92.3 241.6 88.0Q246.2 83.6 246.2 75.2L246.2 75.2Q246.2 69.8 244.2 65.4Q242.1 61.1 238.3 58.6Q234.4 56.2 229.4 56.2L229.4 56.2Q222.0 56.2 217.6 61.3Q213.1 66.5 213.1 75.1L213.1 75.1Q213.1 83.9 217.8 88.1Q222.5 92.3 229.6 92.3L229.6 92.3ZM306.4 87.4Q306.4 89.8 306.9 91.3Q307.4 92.9 308.1 94.1Q308.8 95.3 308.8 95.6L308.8 95.6Q308.8 97.2 307.4 98.4Q306.1 99.6 304.4 99.6L304.4 99.6Q302.4 99.6 300.5 97.0Q298.6 94.5 298.6 92L298.6 92L298.6 91.4Q296.6 95.6 292.7 97.8Q288.8 100.1 283.3 100.1L283.3 100.1Q274.8 100.1 270.4 94.2Q265.9 88.2 265.9 77.6L265.9 77.6L265.9 53.3Q265.9 51.6 267.3 50.6Q268.6 49.6 270.7 49.6L270.7 49.6Q272.9 49.6 274.4 50.6Q275.8 51.6 275.8 53.3L275.8 53.3L275.8 77.7Q275.8 92.2 284.5 92.2L284.5 92.2Q290.6 92.2 293.4 86.7Q296.1 81.1 296.1 70.6L296.1 70.6L296.1 53.3Q296.1 51.3 297.4 50.1Q298.7 49 300.9 49L300.9 49Q303.2 49 304.6 50.2Q306 51.4 306 53.3L306 53.3L306.4 87.4ZM346.7 48.4Q353.1 48.4 356.9 52.5Q360.7 56.6 360.7 62.7L360.7 62.7Q360.7 68.5 357.1 71.8Q353.5 75.1 347.8 75.1L347.8 75.1Q345.3 75.1 344.3 74.3Q343.2 73.6 343.2 71.7L343.2 71.7Q343.2 70 344.0 69.3Q344.7 68.5 346.2 68.4L346.2 68.4Q352.5 67.9 352.5 62.5L352.5 62.5Q352.5 59.9 351.1 58.1Q349.6 56.3 346.6 56.3L346.6 56.3Q343.1 56.3 340.4 59.6Q337.6 62.9 336.0 67.6Q334.3 72.3 334 76.5L334 76.5Q333.3 84 333.3 93.3L333.3 93.3Q333.3 97.8 332.3 99.3Q331.3 100.8 328.5 100.8L328.5 100.8Q325.8 100.8 324.7 99.7Q323.5 98.5 323.5 95.8L323.5 95.8Q323.4 93.9 323.4 77.7L323.4 77.7Q323.4 69.6 322.3 59L322.3 59L321.7 51.3Q321.6 49.4 322.9 48.3Q324.1 47.2 326.4 47.2L326.4 47.2Q330.4 47.2 330.6 50.8L330.6 50.8L331.3 61Q333.1 55.3 337.1 51.8Q341.1 48.4 346.7 48.4L346.7 48.4ZM423.9 100.6Q417.0 100.6 412.0 97.3Q407.0 94 404.5 88.7L404.5 88.7Q403.8 87.3 403.8 86.5L403.8 86.5Q403.9 84.8 405.7 83.5Q407.5 82.1 409.3 82.3L409.3 82.3Q410.3 82.5 410.9 83.0Q411.4 83.6 412.4 84.9L412.4 84.9Q415.1 88.6 417.6 90.5Q420.0 92.5 424.0 92.5L424.0 92.5Q427.7 92.5 430.2 90.7Q432.7 88.9 432.7 86.2L432.7 86.2Q432.7 83.3 430.1 81.8Q427.5 80.2 421.9 78.2L421.9 78.2Q416.7 76.5 413.4 74.8Q410.1 73.2 407.8 70.3Q405.4 67.3 405.4 62.7L405.4 62.7Q405.4 58.5 407.8 55.0Q410.1 51.6 414.3 49.6Q418.5 47.7 423.8 47.7L423.8 47.7Q429.2 47.7 433.3 49.8Q437.4 51.8 439.6 55.2Q441.8 58.6 441.8 62.6L441.8 62.6Q441.8 64.9 440.8 65.9Q439.7 67 437.3 67L437.3 67Q434.9 67 434.1 66.2Q433.3 65.3 433.2 63.9L433.2 63.9Q432.8 60 430.5 57.9Q428.1 55.9 423.8 55.9L423.8 55.9Q419.3 55.9 417.3 57.9Q415.2 60 415.2 62.5L415.2 62.5Q415.2 65.5 417.9 67.1Q420.5 68.7 426.3 70.7L426.3 70.7Q431.5 72.5 434.8 74.1Q438.0 75.7 440.3 78.5Q442.6 81.4 442.6 85.9L442.6 85.9Q442.6 90.7 440.0 94Q437.3 97.3 433.0 99.0Q428.7 100.6 423.9 100.6L423.9 100.6ZM480.3 100.6Q471.8 100.6 465.8 97.1Q459.7 93.6 456.7 87.7Q453.6 81.8 453.6 74.7L453.6 74.7Q453.6 67.4 456.9 61.4Q460.2 55.5 466.2 52.0Q472.2 48.6 479.9 48.6L479.9 48.6Q486.7 48.6 492.2 51.3Q497.6 54.1 500.7 59.1Q503.8 64.1 503.8 70.5L503.8 70.5Q503.8 73.9 502.8 75.3Q501.8 76.8 498.7 76.9L498.7 76.9L462.6 77.4Q462.6 80.7 464.7 84.2Q466.8 87.7 470.8 90.0Q474.7 92.4 480.0 92.4L480.0 92.4Q483.8 92.4 486.5 91.3Q489.1 90.3 490.7 88.8Q492.3 87.4 494.5 85L494.5 85Q495.6 83.9 497.3 83.9L497.3 83.9Q498.9 83.9 500.4 85.2Q501.8 86.4 501.8 88L501.8 88Q501.8 89.3 500.9 90.5L500.9 90.5Q498.1 94.5 493.4 97.5Q488.7 100.6 480.3 100.6L480.3 100.6ZM462.6 70.4L494.4 69.8Q495.0 69.8 495.3 69.5Q495.5 69.1 495.5 68.4L495.5 68.4Q495.5 63.1 491.1 59.8Q486.6 56.4 479.9 56.4L479.9 56.4Q474.8 56.4 470.9 58.8Q466.9 61.2 464.8 64.5Q462.6 67.9 462.6 70.4L462.6 70.4ZM541.1 48.4Q547.5 48.4 551.3 52.5Q555.1 56.6 555.1 62.7L555.1 62.7Q555.1 68.5 551.5 71.8Q547.9 75.1 542.2 75.1L542.2 75.1Q539.7 75.1 538.7 74.3Q537.6 73.6 537.6 71.7L537.6 71.7Q537.6 70 538.4 69.3Q539.1 68.5 540.6 68.4L540.6 68.4Q546.9 67.9 546.9 62.5L546.9 62.5Q546.9 59.9 545.5 58.1Q544 56.3 541 56.3L541 56.3Q537.5 56.3 534.8 59.6Q532 62.9 530.4 67.6Q528.7 72.3 528.4 76.5L528.4 76.5Q527.7 84 527.7 93.3L527.7 93.3Q527.7 97.8 526.7 99.3Q525.7 100.8 522.9 100.8L522.9 100.8Q520.2 100.8 519.1 99.7Q517.9 98.5 517.9 95.8L517.9 95.8Q517.8 93.9 517.8 77.7L517.8 77.7Q517.8 69.6 516.7 59L516.7 59L516.1 51.3Q516 49.4 517.3 48.3Q518.5 47.2 520.8 47.2L520.8 47.2Q524.8 47.2 525 50.8L525 50.8L525.7 61Q527.5 55.3 531.5 51.8Q535.5 48.4 541.1 48.4L541.1 48.4ZM586.5 99.6Q578.6 99.6 570.8 77.9L570.8 77.9Q568.4 71 566.7 64.1Q565.0 57.2 565.0 54.3L565.0 54.3Q565.0 52 566.4 50.8Q567.7 49.7 570.0 49.7L570.0 49.7Q571.9 49.7 573.2 50.7Q574.5 51.7 574.8 53.6L574.8 53.6Q576.0 62.6 579.4 73.6L579.4 73.6Q581.3 79.5 583.5 84.2Q585.6 88.8 586.5 88.8L586.5 88.8Q587.5 88.8 589.8 84.2Q592.1 79.5 594.2 73.5L594.2 73.5Q596.5 66.4 597.6 61.9Q598.6 57.3 599.1 53.2L599.1 53.2Q599.3 51.4 600.6 50.3Q601.9 49.2 604.1 49.2L604.1 49.2Q606.4 49.2 607.7 50.5Q609.0 51.8 609.0 54.1L609.0 54.1Q609.0 57.1 607.3 63.7Q605.5 70.3 602.8 77.5L602.8 77.5Q598.7 88.2 594.7 93.9Q590.7 99.6 586.5 99.6L586.5 99.6ZM630.4 44.9Q627.3 44.9 625.3 42.8Q623.3 40.8 623.3 37.7L623.3 37.7Q623.3 34.7 625.4 32.7Q627.4 30.7 630.6 30.7L630.6 30.7Q633.8 30.7 635.8 32.6Q637.7 34.5 637.7 37.6L637.7 37.6Q637.7 40.7 635.6 42.8Q633.6 44.9 630.4 44.9L630.4 44.9ZM629 99.4Q626.7 99.4 625.3 98.3Q623.9 97.2 623.9 95.2L623.9 95.2L624.9 54.6Q624.9 52.6 626.3 51.4Q627.7 50.3 629.9 50.3L629.9 50.3Q632.1 50.3 633.6 51.5Q635 52.7 635 54.7L635 54.7L634 95.3Q633.9 97.3 632.6 98.3Q631.2 99.4 629 99.4L629 99.4ZM675.5 100Q667.7 100 662.0 96.8Q656.3 93.6 653.3 88.1Q650.2 82.6 650.2 75.7L650.2 75.7Q650.2 68.5 653.4 62.3Q656.5 56 662.4 52.3Q668.2 48.6 676.0 48.6L676.0 48.6Q684.4 48.6 690.2 52.6Q696.0 56.7 698.3 62.6L698.3 62.6Q698.9 63.8 698.9 64.9L698.9 64.9Q698.9 67.2 695.7 68.1L695.7 68.1Q694.5 68.3 694.2 68.3L694.2 68.3Q692.7 68.3 691.7 67.4Q690.7 66.6 689.8 64.9L689.8 64.9Q688.2 61.4 684.8 58.9Q681.4 56.5 676.6 56.5L676.6 56.5Q671.7 56.5 668.0 59.1Q664.2 61.7 662.2 66.1Q660.1 70.5 660.1 75.6L660.1 75.6Q660.1 82.9 664.3 87.5Q668.4 92.1 676.1 92.1L676.1 92.1Q681.0 92.1 684.4 90.2Q687.8 88.3 689.5 85.4Q691.1 82.5 691.3 79.5L691.3 79.5Q691.3 78.2 692.4 77.3Q693.4 76.5 695.3 76.5L695.3 76.5Q697.7 76.5 699.0 77.5Q700.2 78.4 700.2 80.8L700.2 80.8Q700.1 85.4 697.4 89.8Q694.6 94.2 689.1 97.1Q683.6 100 675.5 100L675.5 100ZM736.3 100.6Q727.8 100.6 721.8 97.1Q715.7 93.6 712.7 87.7Q709.6 81.8 709.6 74.7L709.6 74.7Q709.6 67.4 712.9 61.4Q716.2 55.5 722.2 52.0Q728.2 48.6 735.9 48.6L735.9 48.6Q742.7 48.6 748.2 51.3Q753.6 54.1 756.7 59.1Q759.8 64.1 759.8 70.5L759.8 70.5Q759.8 73.9 758.8 75.3Q757.8 76.8 754.7 76.9L754.7 76.9L718.6 77.4Q718.6 80.7 720.7 84.2Q722.8 87.7 726.8 90.0Q730.7 92.4 736.0 92.4L736.0 92.4Q739.8 92.4 742.5 91.3Q745.1 90.3 746.7 88.8Q748.3 87.4 750.5 85L750.5 85Q751.6 83.9 753.3 83.9L753.3 83.9Q754.9 83.9 756.4 85.2Q757.8 86.4 757.8 88L757.8 88Q757.8 89.3 756.9 90.5L756.9 90.5Q754.1 94.5 749.4 97.5Q744.7 100.6 736.3 100.6L736.3 100.6ZM718.6 70.4L750.4 69.8Q751.0 69.8 751.3 69.5Q751.5 69.1 751.5 68.4L751.5 68.4Q751.5 63.1 747.1 59.8Q742.6 56.4 735.9 56.4L735.9 56.4Q730.8 56.4 726.9 58.8Q722.9 61.2 720.8 64.5Q718.6 67.9 718.6 70.4L718.6 70.4Z","parts":["M58.1 83.5L61.7 95.4Q62 96.4 62 96.9L62 96.9Q62 98.9 60.4 100.0Q58.8 101 56.4 101L56.4 101Q54.7 101 53.4 100.3Q52.1 99.5 51.7 98.2L51.7 98.2Q49.3 90.1 47.5 83.5L47.5 83.5L21.7 83.4L17.3 97.8Q16.4 100.9 12.5 100.9L12.5 100.9Q10.3 100.9 8.6 99.8Q6.9 98.6 6.9 96.8L6.9 96.8Q6.9 96.2 7.2 95.3L7.2 95.3Q17.2 65.4 22.5 49.3L22.5 49.3L25.3 40.6Q27.5 34.2 29.7 31.5Q31.9 28.9 35.4 28.9L35.4 28.9Q38.7 28.9 40.8 31.3Q42.8 33.7 44.7 39.6L44.7 39.6Q49.5 54.7 55.3 74.1L55.3 74.1L58.1 74.1Q60.1 74.1 61.2 75.3Q62.2 76.6 62.2 78.8L62.2 78.8Q62.2 83.5 58.9 83.5L58.9 83.5L58.1 83.5Z","M24.7 73.8L44.8 74L44.2 71.7Q40.3 57.9 38 50.3L38 50.3Q37.7 49.4 37 47Q36.3 44.6 35.9 43.6Q35.4 42.6 35 42.6L35 42.6Q34.5 42.6 34.1 43.8Q33.6 44.9 32.8 47.8L32.8 47.8Q32.7 48.3 32.5 48.8Q32.3 49.3 32.1 50L32.1 50Q31.7 51.4 31.4 52.1L31.4 52.1Q30.3 55.6 28.7 60.8Q27.1 65.9 24.7 73.8L24.7 73.8Z","M104.8 82.5Q107.1 82.5 108.1 83.5Q109.1 84.5 109.1 86.9L109.1 86.9Q109.1 92.6 105.4 96.3Q101.7 100.1 96 100.1L96 100.1Q88.1 100.1 84.6 93.3Q81.1 86.6 81.1 72.2L81.1 72.2Q81.1 67.1 81.4 62L81.4 62L76.6 61.7Q72.7 61.5 72.7 57.6L72.7 57.6Q72.7 55.6 73.8 54.6Q74.8 53.7 77.2 53.8L77.2 53.8L82.1 54.1Q82.7 47.8 84.4 36.6L84.4 36.6Q85 33 89.3 33L89.3 33Q91.8 33 93.2 34.3Q94.5 35.6 94.3 37.4L94.3 37.4Q92.9 46.1 91.9 54.6L91.9 54.6Q97.3 54.8 99 54.8L99 54.8Q100.9 54.8 101.8 55.6Q102.7 56.5 102.7 58.3L102.7 58.3Q102.7 60.5 101.8 61.3Q100.8 62.2 98.3 62.3L98.3 62.3L91.2 62.3Q90.9 67.1 90.9 72.2L90.9 72.2Q90.9 82.3 92.2 87.2Q93.5 92 96.8 92L96.8 92Q100.6 92 100.9 86.1L100.9 86.1Q100.9 84.3 101.8 83.4Q102.6 82.5 104.8 82.5L104.8 82.5Z","M168.8 126.1Q166.6 126.1 165.1 124.8Q163.6 123.4 163.6 121.5L163.6 121.5Q163.6 120.6 164 119.8L164 119.8Q168.6 107.9 172.8 96.1L172.8 96.1Q168.5 93.2 164.1 86.0Q159.6 78.9 156.1 70.3Q152.6 61.6 150.9 54.5L150.9 54.5Q150.7 53.7 150.7 53L150.7 53Q150.7 51.3 152.1 50.2Q153.4 49.1 155.6 49.1L155.6 49.1Q157.5 49.1 158.4 49.9Q159.2 50.7 159.6 52.4L159.6 52.4Q168.2 81.2 176.1 86.5L176.1 86.5Q179.6 74.5 185.4 51.9L185.4 51.9Q185.9 50.2 186.8 49.5Q187.7 48.8 189.5 48.8L189.5 48.8Q191.9 48.8 193.4 49.8Q194.8 50.9 195 52.6L195 52.6Q195.1 53 194.9 53.7L194.9 53.7Q191.9 65.7 189.5 74.3Q187.1 82.9 184.1 91.8L184.1 91.8Q181.8 98.7 178.5 108.3Q175.1 117.9 173.1 122.9L173.1 122.9Q172.5 124.5 171.6 125.3Q170.6 126.1 168.8 126.1L168.8 126.1Z","M229.8 100.2Q218.0 100.2 210.6 94.0Q203.1 87.7 203.1 75.2L203.1 75.2Q203.1 67.3 206.3 61.2Q209.4 55.1 215.3 51.7Q221.1 48.3 229.1 48.3L229.1 48.3Q236.9 48.3 243.1 51.6Q249.2 54.9 252.7 61.0Q256.1 67.2 256.1 75.4L256.1 75.4Q256.1 87.4 248.9 93.8Q241.7 100.2 229.8 100.2L229.8 100.2Z","M229.6 92.3Q237.0 92.3 241.6 88.0Q246.2 83.6 246.2 75.2L246.2 75.2Q246.2 69.8 244.2 65.4Q242.1 61.1 238.3 58.6Q234.4 56.2 229.4 56.2L229.4 56.2Q222.0 56.2 217.6 61.3Q213.1 66.5 213.1 75.1L213.1 75.1Q213.1 83.9 217.8 88.1Q222.5 92.3 229.6 92.3L229.6 92.3Z","M306.4 87.4Q306.4 89.8 306.9 91.3Q307.4 92.9 308.1 94.1Q308.8 95.3 308.8 95.6L308.8 95.6Q308.8 97.2 307.4 98.4Q306.1 99.6 304.4 99.6L304.4 99.6Q302.4 99.6 300.5 97.0Q298.6 94.5 298.6 92L298.6 92L298.6 91.4Q296.6 95.6 292.7 97.8Q288.8 100.1 283.3 100.1L283.3 100.1Q274.8 100.1 270.4 94.2Q265.9 88.2 265.9 77.6L265.9 77.6L265.9 53.3Q265.9 51.6 267.3 50.6Q268.6 49.6 270.7 49.6L270.7 49.6Q272.9 49.6 274.4 50.6Q275.8 51.6 275.8 53.3L275.8 53.3L275.8 77.7Q275.8 92.2 284.5 92.2L284.5 92.2Q290.6 92.2 293.4 86.7Q296.1 81.1 296.1 70.6L296.1 70.6L296.1 53.3Q296.1 51.3 297.4 50.1Q298.7 49 300.9 49L300.9 49Q303.2 49 304.6 50.2Q306 51.4 306 53.3L306 53.3L306.4 87.4Z","M346.7 48.4Q353.1 48.4 356.9 52.5Q360.7 56.6 360.7 62.7L360.7 62.7Q360.7 68.5 357.1 71.8Q353.5 75.1 347.8 75.1L347.8 75.1Q345.3 75.1 344.3 74.3Q343.2 73.6 343.2 71.7L343.2 71.7Q343.2 70 344.0 69.3Q344.7 68.5 346.2 68.4L346.2 68.4Q352.5 67.9 352.5 62.5L352.5 62.5Q352.5 59.9 351.1 58.1Q349.6 56.3 346.6 56.3L346.6 56.3Q343.1 56.3 340.4 59.6Q337.6 62.9 336.0 67.6Q334.3 72.3 334 76.5L334 76.5Q333.3 84 333.3 93.3L333.3 93.3Q333.3 97.8 332.3 99.3Q331.3 100.8 328.5 100.8L328.5 100.8Q325.8 100.8 324.7 99.7Q323.5 98.5 323.5 95.8L323.5 95.8Q323.4 93.9 323.4 77.7L323.4 77.7Q323.4 69.6 322.3 59L322.3 59L321.7 51.3Q321.6 49.4 322.9 48.3Q324.1 47.2 326.4 47.2L326.4 47.2Q330.4 47.2 330.6 50.8L330.6 50.8L331.3 61Q333.1 55.3 337.1 51.8Q341.1 48.4 346.7 48.4L346.7 48.4Z","M423.9 100.6Q417.0 100.6 412.0 97.3Q407.0 94 404.5 88.7L404.5 88.7Q403.8 87.3 403.8 86.5L403.8 86.5Q403.9 84.8 405.7 83.5Q407.5 82.1 409.3 82.3L409.3 82.3Q410.3 82.5 410.9 83.0Q411.4 83.6 412.4 84.9L412.4 84.9Q415.1 88.6 417.6 90.5Q420.0 92.5 424.0 92.5L424.0 92.5Q427.7 92.5 430.2 90.7Q432.7 88.9 432.7 86.2L432.7 86.2Q432.7 83.3 430.1 81.8Q427.5 80.2 421.9 78.2L421.9 78.2Q416.7 76.5 413.4 74.8Q410.1 73.2 407.8 70.3Q405.4 67.3 405.4 62.7L405.4 62.7Q405.4 58.5 407.8 55.0Q410.1 51.6 414.3 49.6Q418.5 47.7 423.8 47.7L423.8 47.7Q429.2 47.7 433.3 49.8Q437.4 51.8 439.6 55.2Q441.8 58.6 441.8 62.6L441.8 62.6Q441.8 64.9 440.8 65.9Q439.7 67 437.3 67L437.3 67Q434.9 67 434.1 66.2Q433.3 65.3 433.2 63.9L433.2 63.9Q432.8 60 430.5 57.9Q428.1 55.9 423.8 55.9L423.8 55.9Q419.3 55.9 417.3 57.9Q415.2 60 415.2 62.5L415.2 62.5Q415.2 65.5 417.9 67.1Q420.5 68.7 426.3 70.7L426.3 70.7Q431.5 72.5 434.8 74.1Q438.0 75.7 440.3 78.5Q442.6 81.4 442.6 85.9L442.6 85.9Q442.6 90.7 440.0 94Q437.3 97.3 433.0 99.0Q428.7 100.6 423.9 100.6L423.9 100.6Z","M480.3 100.6Q471.8 100.6 465.8 97.1Q459.7 93.6 456.7 87.7Q453.6 81.8 453.6 74.7L453.6 74.7Q453.6 67.4 456.9 61.4Q460.2 55.5 466.2 52.0Q472.2 48.6 479.9 48.6L479.9 48.6Q486.7 48.6 492.2 51.3Q497.6 54.1 500.7 59.1Q503.8 64.1 503.8 70.5L503.8 70.5Q503.8 73.9 502.8 75.3Q501.8 76.8 498.7 76.9L498.7 76.9L462.6 77.4Q462.6 80.7 464.7 84.2Q466.8 87.7 470.8 90.0Q474.7 92.4 480.0 92.4L480.0 92.4Q483.8 92.4 486.5 91.3Q489.1 90.3 490.7 88.8Q492.3 87.4 494.5 85L494.5 85Q495.6 83.9 497.3 83.9L497.3 83.9Q498.9 83.9 500.4 85.2Q501.8 86.4 501.8 88L501.8 88Q501.8 89.3 500.9 90.5L500.9 90.5Q498.1 94.5 493.4 97.5Q488.7 100.6 480.3 100.6L480.3 100.6Z","M462.6 70.4L494.4 69.8Q495.0 69.8 495.3 69.5Q495.5 69.1 495.5 68.4L495.5 68.4Q495.5 63.1 491.1 59.8Q486.6 56.4 479.9 56.4L479.9 56.4Q474.8 56.4 470.9 58.8Q466.9 61.2 464.8 64.5Q462.6 67.9 462.6 70.4L462.6 70.4Z","M541.1 48.4Q547.5 48.4 551.3 52.5Q555.1 56.6 555.1 62.7L555.1 62.7Q555.1 68.5 551.5 71.8Q547.9 75.1 542.2 75.1L542.2 75.1Q539.7 75.1 538.7 74.3Q537.6 73.6 537.6 71.7L537.6 71.7Q537.6 70 538.4 69.3Q539.1 68.5 540.6 68.4L540.6 68.4Q546.9 67.9 546.9 62.5L546.9 62.5Q546.9 59.9 545.5 58.1Q544 56.3 541 56.3L541 56.3Q537.5 56.3 534.8 59.6Q532 62.9 530.4 67.6Q528.7 72.3 528.4 76.5L528.4 76.5Q527.7 84 527.7 93.3L527.7 93.3Q527.7 97.8 526.7 99.3Q525.7 100.8 522.9 100.8L522.9 100.8Q520.2 100.8 519.1 99.7Q517.9 98.5 517.9 95.8L517.9 95.8Q517.8 93.9 517.8 77.7L517.8 77.7Q517.8 69.6 516.7 59L516.7 59L516.1 51.3Q516 49.4 517.3 48.3Q518.5 47.2 520.8 47.2L520.8 47.2Q524.8 47.2 525 50.8L525 50.8L525.7 61Q527.5 55.3 531.5 51.8Q535.5 48.4 541.1 48.4L541.1 48.4Z","M586.5 99.6Q578.6 99.6 570.8 77.9L570.8 77.9Q568.4 71 566.7 64.1Q565.0 57.2 565.0 54.3L565.0 54.3Q565.0 52 566.4 50.8Q567.7 49.7 570.0 49.7L570.0 49.7Q571.9 49.7 573.2 50.7Q574.5 51.7 574.8 53.6L574.8 53.6Q576.0 62.6 579.4 73.6L579.4 73.6Q581.3 79.5 583.5 84.2Q585.6 88.8 586.5 88.8L586.5 88.8Q587.5 88.8 589.8 84.2Q592.1 79.5 594.2 73.5L594.2 73.5Q596.5 66.4 597.6 61.9Q598.6 57.3 599.1 53.2L599.1 53.2Q599.3 51.4 600.6 50.3Q601.9 49.2 604.1 49.2L604.1 49.2Q606.4 49.2 607.7 50.5Q609.0 51.8 609.0 54.1L609.0 54.1Q609.0 57.1 607.3 63.7Q605.5 70.3 602.8 77.5L602.8 77.5Q598.7 88.2 594.7 93.9Q590.7 99.6 586.5 99.6L586.5 99.6Z","M630.4 44.9Q627.3 44.9 625.3 42.8Q623.3 40.8 623.3 37.7L623.3 37.7Q623.3 34.7 625.4 32.7Q627.4 30.7 630.6 30.7L630.6 30.7Q633.8 30.7 635.8 32.6Q637.7 34.5 637.7 37.6L637.7 37.6Q637.7 40.7 635.6 42.8Q633.6 44.9 630.4 44.9L630.4 44.9Z","M629 99.4Q626.7 99.4 625.3 98.3Q623.9 97.2 623.9 95.2L623.9 95.2L624.9 54.6Q624.9 52.6 626.3 51.4Q627.7 50.3 629.9 50.3L629.9 50.3Q632.1 50.3 633.6 51.5Q635 52.7 635 54.7L635 54.7L634 95.3Q633.9 97.3 632.6 98.3Q631.2 99.4 629 99.4L629 99.4Z","M675.5 100Q667.7 100 662.0 96.8Q656.3 93.6 653.3 88.1Q650.2 82.6 650.2 75.7L650.2 75.7Q650.2 68.5 653.4 62.3Q656.5 56 662.4 52.3Q668.2 48.6 676.0 48.6L676.0 48.6Q684.4 48.6 690.2 52.6Q696.0 56.7 698.3 62.6L698.3 62.6Q698.9 63.8 698.9 64.9L698.9 64.9Q698.9 67.2 695.7 68.1L695.7 68.1Q694.5 68.3 694.2 68.3L694.2 68.3Q692.7 68.3 691.7 67.4Q690.7 66.6 689.8 64.9L689.8 64.9Q688.2 61.4 684.8 58.9Q681.4 56.5 676.6 56.5L676.6 56.5Q671.7 56.5 668.0 59.1Q664.2 61.7 662.2 66.1Q660.1 70.5 660.1 75.6L660.1 75.6Q660.1 82.9 664.3 87.5Q668.4 92.1 676.1 92.1L676.1 92.1Q681.0 92.1 684.4 90.2Q687.8 88.3 689.5 85.4Q691.1 82.5 691.3 79.5L691.3 79.5Q691.3 78.2 692.4 77.3Q693.4 76.5 695.3 76.5L695.3 76.5Q697.7 76.5 699.0 77.5Q700.2 78.4 700.2 80.8L700.2 80.8Q700.1 85.4 697.4 89.8Q694.6 94.2 689.1 97.1Q683.6 100 675.5 100L675.5 100Z","M736.3 100.6Q727.8 100.6 721.8 97.1Q715.7 93.6 712.7 87.7Q709.6 81.8 709.6 74.7L709.6 74.7Q709.6 67.4 712.9 61.4Q716.2 55.5 722.2 52.0Q728.2 48.6 735.9 48.6L735.9 48.6Q742.7 48.6 748.2 51.3Q753.6 54.1 756.7 59.1Q759.8 64.1 759.8 70.5L759.8 70.5Q759.8 73.9 758.8 75.3Q757.8 76.8 754.7 76.9L754.7 76.9L718.6 77.4Q718.6 80.7 720.7 84.2Q722.8 87.7 726.8 90.0Q730.7 92.4 736.0 92.4L736.0 92.4Q739.8 92.4 742.5 91.3Q745.1 90.3 746.7 88.8Q748.3 87.4 750.5 85L750.5 85Q751.6 83.9 753.3 83.9L753.3 83.9Q754.9 83.9 756.4 85.2Q757.8 86.4 757.8 88L757.8 88Q757.8 89.3 756.9 90.5L756.9 90.5Q754.1 94.5 749.4 97.5Q744.7 100.6 736.3 100.6L736.3 100.6Z","M718.6 70.4L750.4 69.8Q751.0 69.8 751.3 69.5Q751.5 69.1 751.5 68.4L751.5 68.4Q751.5 63.1 747.1 59.8Q742.6 56.4 735.9 56.4L735.9 56.4Q730.8 56.4 726.9 58.8Q722.9 61.2 720.8 64.5Q718.6 67.9 718.6 70.4L718.6 70.4Z"]}};
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const label = document.createElement('span');
  label.className = 'sr-only';
  const stage = document.createElement('span');
  stage.className = 'rotate-stage';
  stage.setAttribute('aria-hidden', 'true');
  line.replaceChildren(label, stage);

  let index = 0;
  const render = ({ text, lang }) => {
    label.textContent = text;
    label.lang = lang;
    const glyphs = HAND[text];
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'hand-svg');
    svg.setAttribute('viewBox', glyphs.vb);
    svg.setAttribute('focusable', 'false');
    const fill = document.createElementNS(SVG_NS, 'path');
    fill.setAttribute('class', 'hand-fill');
    fill.setAttribute('d', glyphs.full);
    const strokes = document.createElementNS(SVG_NS, 'g');
    strokes.setAttribute('class', 'hand-strokes');
    glyphs.parts.forEach(part => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('pathLength', '1');
      path.setAttribute('d', part);
      strokes.append(path);
    });
    svg.append(fill, strokes);
    stage.replaceChildren(svg);
    return svg;
  };
  // Pen crosses the phrase left to right (contours overlap so it reads as one movement), then the ink fades in.
  const write = svg => {
    if (motion.matches || !Element.prototype.animate) return Promise.resolve();
    const strokes = [...svg.querySelectorAll('.hand-strokes path')];
    const total = 1500;
    const each = total / strokes.length * 2.4;
    strokes.forEach((path, i) => path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: each, delay: 50 + i / strokes.length * total, easing: 'ease-out', fill: 'both' }));
    return svg.querySelector('.hand-fill').animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 450, delay: 50 + total * 0.72, easing: 'ease-out', fill: 'both' }).finished.catch(() => {});
  };

  let current = render(texts[0]);
  const firstWrite = () => (document.documentElement.classList.contains('welcome-pending') ? setTimeout(firstWrite, 100) : write(current));
  firstWrite();
  const next = async () => {
    index = (index + 1) % texts.length;
    if (!motion.matches && Element.prototype.animate) {
      await current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).finished.catch(() => {});
    }
    current = render(texts[index]);
    await write(current);
  };
  // Rotate only while the welcome screen is showing and the tab is visible.
  const tick = async () => {
    if (!document.hidden && document.body.classList.contains('at-intro')) await next();
    setTimeout(tick, 1600);
  };
  setTimeout(tick, 3400);
})();

// "ดูรูปขนาดเต็ม" buttons open the same in-page viewer as tapping the poster itself.
document.querySelectorAll('[data-open-poster]').forEach(button => button.addEventListener('click', event => {
  const poster = button.closest('.poster-panel')?.querySelector('.vehicle-age-poster');
  if (!poster || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  poster.click();
}));

// Visitor counter via GoatCounter (trokp.goatcounter.com). Counts once per browser session;
// local previews only read the total so testing doesn't inflate it.
(() => {
  const out = document.getElementById('visitor-count');
  if (!out) return;
  const base = 'https://trokp.goatcounter.com';
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  let counted = false;
  try { counted = sessionStorage.getItem('gc-counted') === '1'; } catch {}
  const hit = local || counted ? Promise.resolve() :
    fetch(`${base}/count?p=${encodeURIComponent(location.pathname)}&r=${encodeURIComponent(document.referrer)}&s=${screen.width}&rnd=${Math.random().toString(36).slice(2)}`,
      { mode: 'no-cors', keepalive: true }).then(() => { try { sessionStorage.setItem('gc-counted', '1'); } catch {} }).catch(() => {});
  hit.then(() => fetch(`${base}/counter/TOTAL.json`))
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => { if (data && data.count) out.textContent = String(data.count).replace(/\s/g, ','); })
    .catch(() => {});
})();

// About gallery: drifts right on its own and loops; drag (mouse) or swipe (touch) to move it by hand.
// Hovering pauses it, and after a manual move it waits a moment before drifting again.
(() => {
  const gallery = document.querySelector('.about-gallery');
  const track = gallery?.querySelector('.gallery-track');
  if (!track) return;
  const cards = track.children;
  const half = cards.length / 2;
  const period = () => cards[half].offsetLeft - cards[0].offsetLeft;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pos = 0, hovered = false, drag = null, resumeAt = 0, last = 0;
  const wrap = () => {
    const p = period();
    if (p <= 0) return;
    if (pos >= p) pos -= p;
    if (pos < 0) pos += p;
    gallery.scrollLeft = pos;
  };
  const holdOff = () => { resumeAt = performance.now() + 2500; };
  const tick = now => {
    const dt = last ? Math.min(now - last, 64) : 0;
    last = now;
    if (!still && !hovered && !drag && now > resumeAt && gallery.offsetParent) {
      pos -= dt * 0.04;
      wrap();
    }
    requestAnimationFrame(tick);
  };
  gallery.addEventListener('scroll', () => { if (Math.abs(gallery.scrollLeft - pos) > 1) { pos = gallery.scrollLeft; wrap(); } }, { passive: true });
  gallery.addEventListener('mouseenter', () => { hovered = true; });
  gallery.addEventListener('mouseleave', () => { hovered = false; });
  gallery.addEventListener('touchstart', holdOff, { passive: true });
  gallery.addEventListener('touchend', holdOff, { passive: true });
  gallery.addEventListener('wheel', holdOff, { passive: true });
  gallery.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, start: pos };
    gallery.classList.add('is-dragging');
    gallery.setPointerCapture(event.pointerId);
  });
  gallery.addEventListener('pointermove', event => {
    if (!drag) return;
    pos = drag.start - (event.clientX - drag.x);
    wrap();
  });
  const endDrag = () => { if (!drag) return; drag = null; gallery.classList.remove('is-dragging'); holdOff(); };
  gallery.addEventListener('pointerup', endDrag);
  gallery.addEventListener('pointercancel', endDrag);
  requestAnimationFrame(tick);
})();

// Service steps: on phones the cards zigzag in normal flow, so the dashed path is redrawn through their centres whenever the board resizes.
(() => {
  const board = document.querySelector('.hiw-board');
  const svg = board?.querySelector('.hiw-path');
  const path = svg?.querySelector('path');
  if (!path) return;
  const desktop = { viewBox: svg.getAttribute('viewBox'), d: path.getAttribute('d') };
  const phone = matchMedia('(max-width: 760px)');
  const fit = () => {
    if (!phone.matches) {
      svg.setAttribute('viewBox', desktop.viewBox);
      path.setAttribute('d', desktop.d);
      return;
    }
    const w = board.clientWidth, h = board.clientHeight;
    if (!w || !h) return;
    // Offsets ignore the scroll-reveal transforms, so the line lands where the cards settle.
    const steps = board.querySelector('.hiw-steps');
    const cards = [...board.querySelectorAll('.hiw-card')].map(card => ({
      x: steps.offsetLeft + card.offsetLeft + card.offsetWidth / 2,
      top: steps.offsetTop + card.offsetTop,
      bottom: steps.offsetTop + card.offsetTop + card.offsetHeight
    }));
    let d = '';
    for (let i = 1; i < cards.length; i++) {
      const a = cards[i - 1], b = cards[i];
      const y0 = a.bottom - 6, y1 = b.top + 6, mid = (y0 + y1) / 2;
      d += `M ${a.x} ${y0} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${y1} `;
    }
    const box = { width: w, height: h };
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    path.setAttribute('d', d);
  };
  new ResizeObserver(fit).observe(board);
  phone.addEventListener('change', fit);
})();
