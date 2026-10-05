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

// Start at the top on entry; keep section links working after the page opens.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash) {
  try {
    history.replaceState(history.state, '', location.pathname + location.search);
  } catch {
    location.hash = 'top';
  }
}
function startAtTop() {
  if (!location.hash || location.hash === '#top') {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
}
startAtTop();
window.addEventListener('pageshow', startAtTop, { once: true });

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
    selectContactBranch(toggle.getAttribute('aria-expanded') === 'true' ? -1 : index);
  });
});
function selectContactBranch(index) {
  branchCards.forEach((item, i) => {
    item.classList.toggle('selected-branch', i === index);
    item.querySelector('.branch-toggle').setAttribute('aria-expanded', String(i === index));
    item.querySelector('.branch-detail').hidden = i !== index;
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
    'main h2:not(#contact-title), .services-list > li, .steps > article, .branch-row h3'
  );
  const running = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      entry.target.dataset.scrollRevealed = 'true';
      if (motion.matches) return;
      const animation = entry.target.animate([
        { opacity: 0.25, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 900, easing: 'cubic-bezier(0.2, 0.65, 0.3, 1)' });
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

// Autoplay stays silent; reduced-motion and data-saving users get the poster.
(() => {
  const hero = document.querySelector('.hero-cinema');
  if (!hero) return;
  const update = () => document.body.classList.toggle('at-intro', hero.getBoundingClientRect().bottom > 160);
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

(() => {
  const video = document.getElementById('hero-video');
  if (!video) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobileHero = matchMedia('(max-width: 760px)');
  let wantsPlayback = !motion.matches && !navigator.connection?.saveData && !mobileHero.matches;
  mobileHero.addEventListener('change', () => {
    wantsPlayback = !mobileHero.matches && !motion.matches && !navigator.connection?.saveData;
    if (wantsPlayback && !document.hidden) play(); else video.pause();
  });
  const play = () => { video.muted = true; video.play().catch(() => {}); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause(); else if (wantsPlayback) play();
  });
  motion.addEventListener('change', () => {
    if (motion.matches) { wantsPlayback = false; video.pause(); }
  });
  if (wantsPlayback) play();
})();
