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
  menu.setAttribute('aria-expanded', open);
  menu.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
  menu.textContent = open ? '×' : '☰';
});
document.querySelectorAll('.main-nav a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.textContent = '☰';
  menu.setAttribute('aria-label', 'เปิดเมนู');
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    menu.click();
    menu.focus();
  }
});
const shortcuts = document.querySelectorAll('.mobile-dock a');
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
  const open = parts.weekday !== 'Sun' && minutes >= 470 && minutes < 1035;
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
});
function resetBranches() {
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
