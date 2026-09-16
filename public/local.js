'use strict';
const popup = document.querySelector('.pop-up-wrp-min');
const form = document.querySelector('#email-form');
const openButton = document.querySelector('#openForm');
const closeButton = document.querySelector('.close-img');
const phoneInput = document.querySelector('#phone');
let previousFocus;

function detectPhoneCountry() {
  const timeZoneCountries = {
    'Europe/Kyiv': 'ua', 'Europe/Kiev': 'ua', 'Europe/Warsaw': 'pl',
    'Europe/Berlin': 'de', 'Europe/Madrid': 'es', 'Europe/Bucharest': 'ro',
    'Europe/Prague': 'cz', 'Europe/Bratislava': 'sk', 'Europe/Vilnius': 'lt',
    'Europe/Riga': 'lv', 'Europe/Tallinn': 'ee', 'Europe/Chisinau': 'md',
    'Europe/Rome': 'it', 'Europe/Paris': 'fr', 'Europe/Lisbon': 'pt',
    'Europe/Amsterdam': 'nl', 'Europe/Brussels': 'be', 'Europe/Vienna': 'at',
    'Europe/London': 'gb'
  };
  const timeZoneCountry = timeZoneCountries[Intl.DateTimeFormat().resolvedOptions().timeZone];
  if (timeZoneCountry) return timeZoneCountry;
  try {
    const locale = new Intl.Locale(navigator.languages?.[0] || navigator.language).maximize();
    if (locale.region) return locale.region.toLowerCase();
  } catch {}
  return 'ua';
}

const detectedPhoneCountry = detectPhoneCountry();
const phonePicker = phoneInput && window.intlTelInput ? window.intlTelInput(phoneInput, {
  initialCountry: detectedPhoneCountry,
  countryOrder: ['ua', 'pl', 'de', 'es', 'ro', 'cz', 'sk', 'lt', 'lv', 'ee', 'md'],
  countrySearch: true,
  separateDialCode: true,
  showFlags: true,
  strictMode: true,
  formatAsYouType: true,
  placeholderNumberPolicy: 'AGGRESSIVE',
  uiTranslations: {
    selectedCountryAriaLabel: 'Обрана країна',
    searchPlaceholder: 'Пошук країни',
    clearSearchAriaLabel: 'Очистити пошук',
    countryListAriaLabel: 'Список країн',
    noCountrySelected: 'Країну не обрано',
    searchEmptyState: 'Країну не знайдено',
    countryNames: {
      ua: 'Україна', pl: 'Польща', de: 'Німеччина', es: 'Іспанія',
      ro: 'Румунія', cz: 'Чехія', sk: 'Словаччина', lt: 'Литва',
      lv: 'Латвія', ee: 'Естонія', md: 'Молдова'
    }
  }
}) : null;

phoneInput?.addEventListener('input', () => phoneInput.setCustomValidity(''));
phoneInput?.addEventListener('countrychange', () => phoneInput.setCustomValidity(''));
function closePopup() {
  popup.style.display = 'none';
  document.body.style.overflow = '';
  document.body.classList.remove('popup-open');
  previousFocus?.focus();
}
openButton?.addEventListener('click', event => {
  event.preventDefault();
  previousFocus = document.activeElement;
  popup.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.body.classList.add('popup-open');
  form.querySelector('input[type=tel]').focus();
});
closeButton?.addEventListener('click', closePopup);
closeButton?.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); closePopup(); }
});
popup?.addEventListener('click', event => { if (event.target === popup) closePopup(); });
document.addEventListener('keydown', event => {
  if (popup?.style.display !== 'flex') return;
  if (event.key === 'Escape') closePopup();
  if (event.key === 'Tab') {
    const items = [...popup.querySelectorAll('input, button, [tabindex="0"], a[href]')].filter(el => el.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
form?.addEventListener('submit', event => {
  event.preventDefault();
  const status = document.querySelector('#local-status');
  if (phonePicker && !phonePicker.isValidNumber()) {
    phoneInput.setCustomValidity('Перевірте номер телефону для вибраної країни');
    phoneInput.reportValidity();
    return;
  }
  try {
    const entries = JSON.parse(localStorage.getItem('luna-local-registrations') || '[]');
    const phone = phonePicker ? phonePicker.getNumber() : form.elements.phone.value;
    entries.push({phone, createdAt: new Date().toISOString()});
    localStorage.setItem('luna-local-registrations', JSON.stringify(entries));
    status.textContent = 'Тестовая заявка сохранена в этом браузере. Данные никуда не отправлены.';
    form.reset();
    phonePicker?.setNumber('');
  } catch {
    status.textContent = 'Браузер не разрешил локальное сохранение. Заявка не сохранена и никуда не отправлена.';
  }
});
const end = Date.now() + 1140 * 1000;
function updateTimer() {
  const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
  for (const [id, value] of Object.entries({hours: Math.floor(remaining/3600), minutes:Math.floor(remaining/60)%60, seconds:remaining%60})) {
    const el=document.getElementById(id); if(el) el.textContent=String(value).padStart(2,'0');
  }
}
updateTimer(); setInterval(updateTimer, 1000);
const trigger = document.querySelector('#buttonTrigger');
const hideTarget = document.querySelector('#buttonHide');
if (trigger && hideTarget) new IntersectionObserver(entries => {
  trigger.classList.toggle('is-hidden', entries[0].isIntersecting);
}).observe(hideTarget);
if (window.Swiper && document.querySelector('.swiper')?.clientWidth) new Swiper('.swiper', {
  loop:true, speed:600, autoplay:{delay:3000,disableOnInteraction:false,pauseOnMouseEnter:true},slidesPerView:1,spaceBetween:0
});
