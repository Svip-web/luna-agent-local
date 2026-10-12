'use strict';

const modal = document.querySelector('[data-modal]');
const dialog = modal?.querySelector('.modal__dialog');
const form = document.querySelector('#email-form');
const nameInput = document.querySelector('#name');
const phoneInput = document.querySelector('#phone');
const submitButton = form?.querySelector('.modal-submit');
const formPanel = document.querySelector('.modal__form-panel');
const formSuccess = document.querySelector('.form-success');
const formError = document.querySelector('.form-error');
const openButtons = [...document.querySelectorAll('[data-open-modal]')];
const closeButtons = [...document.querySelectorAll('[data-close-modal]')];
const recordVideo = document.querySelector('.video-frame video');
const videoPlayButton = document.querySelector('.video-play');
let previousFocus = null;
let phonePicker = null;
let phoneAssetsPromise = null;
let leadScriptPromise = null;
let formAssetsPromise = null;
let formAssetsReady = false;
let countdownTimer = null;
const submitButtonLabel = submitButton?.textContent || 'Оставить заявку';

function setSubmitting(isSubmitting) {
  if (!submitButton) return;
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? 'Отправляем…' : submitButtonLabel;
  form?.setAttribute('aria-busy', String(isSubmitting));
}

window.IlPrepareForm = async data => {
  if (formError) formError.hidden = true;
  setSubmitting(true);
  return data;
};

window.IlAfterForm = async data => {
  setSubmitting(false);

  if (data?.error) {
    if (formError) {
      formError.hidden = false;
      formError.textContent = 'Не удалось отправить заявку. Проверьте данные и попробуйте ещё раз.';
    }
    return false;
  }

  if (form) form.hidden = true;
  if (formError) formError.hidden = true;
  if (formSuccess) formSuccess.hidden = false;
  formPanel?.classList.add('modal__form-panel--success');
  dialog?.classList.add('modal__dialog--success');
  stopCountdown();
  window.setTimeout(() => formSuccess?.focus(), 20);
  return false;
};

function loadStylesheet(id, href) {
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = error => {
      link.remove();
      reject(error);
    };
    document.head.append(link);
  });
}

function loadScript(id, src) {
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = error => {
      script.remove();
      reject(error);
    };
    document.head.append(script);
  });
}

function syncVideoPlayButton() {
  if (videoPlayButton && recordVideo) videoPlayButton.hidden = !recordVideo.paused && !recordVideo.ended;
}

videoPlayButton?.addEventListener('click', () => {
  recordVideo?.play().catch(() => {});
});
recordVideo?.addEventListener('play', syncVideoPlayButton);
recordVideo?.addEventListener('pause', syncVideoPlayButton);
recordVideo?.addEventListener('ended', syncVideoPlayButton);

function detectPhoneCountry() {
  const countries = {
    'Europe/Kyiv': 'ua', 'Europe/Kiev': 'ua', 'Europe/Warsaw': 'pl',
    'Europe/Berlin': 'de', 'Europe/Madrid': 'es', 'Europe/Bucharest': 'ro',
    'Europe/Prague': 'cz', 'Europe/Bratislava': 'sk', 'Europe/Vilnius': 'lt',
    'Europe/Riga': 'lv', 'Europe/Tallinn': 'ee', 'Europe/Chisinau': 'md',
    'Europe/Rome': 'it', 'Europe/Paris': 'fr', 'Europe/Lisbon': 'pt',
    'Europe/Amsterdam': 'nl', 'Europe/Brussels': 'be', 'Europe/Vienna': 'at',
    'Europe/London': 'gb'
  };
  const timeZoneCountry = countries[Intl.DateTimeFormat().resolvedOptions().timeZone];
  if (timeZoneCountry) return timeZoneCountry;
  try {
    const locale = new Intl.Locale(navigator.languages?.[0] || navigator.language).maximize();
    if (locale.region) return locale.region.toLowerCase();
  } catch {}
  return 'ua';
}

function ensurePhonePicker() {
  if (phonePicker || !phoneInput) return Promise.resolve(phonePicker);
  if (!phoneAssetsPromise) {
    phoneAssetsPromise = Promise.all([
      loadStylesheet('intl-phone-styles', '../assets/intl-tel-input/css/intlTelInput.min.css'),
      loadScript('intl-phone-script', '../assets/intl-tel-input/js/intlTelInputWithUtils.min.js')
    ]).then(() => {
      if (!window.intlTelInput) throw new Error('Phone field library failed to initialize');
      phonePicker = window.intlTelInput(phoneInput, {
        initialCountry: detectPhoneCountry(),
        countryOrder: ['ua', 'pl', 'de', 'es', 'ro', 'cz', 'sk', 'lt', 'lv', 'ee', 'md'],
        countrySearch: true,
        separateDialCode: true,
        showFlags: true,
        strictMode: true,
        formatAsYouType: true,
        placeholderNumberPolicy: 'AGGRESSIVE',
        uiTranslations: {
          selectedCountryAriaLabel: 'Выбранная страна',
          searchPlaceholder: 'Поиск страны',
          clearSearchAriaLabel: 'Очистить поиск',
          countryListAriaLabel: 'Список стран',
          noCountrySelected: 'Страна не выбрана',
          searchEmptyState: 'Страна не найдена'
        }
      });
      return phonePicker;
    });
  }
  return phoneAssetsPromise;
}

function ensureLeadScript() {
  if (window.ilForms?.state) return Promise.resolve();
  if (!leadScriptPromise) {
    leadScriptPromise = loadScript('integraleap-forms', 'https://client.integraleap.com/js/sf.js')
      .then(() => window.ilForms?.create());
  }
  return leadScriptPromise;
}

function prepareFormAssets() {
  if (!formAssetsPromise) {
    formAssetsPromise = Promise.all([ensurePhonePicker(), ensureLeadScript()])
      .then(() => { formAssetsReady = true; });
  }
  return formAssetsPromise;
}

function openModal() {
  previousFocus = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  prepareFormAssets().catch(error => console.error('Form assets failed to load', error));
  startCountdown();
  window.setTimeout(() => nameInput?.focus(), 20);
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
  stopCountdown();
  previousFocus?.focus();
}

openButtons.forEach(button => button.addEventListener('click', openModal));
closeButtons.forEach(button => button.addEventListener('click', closeModal));

document.addEventListener('keydown', event => {
  if (!modal || modal.hidden) return;
  if (event.key === 'Escape') closeModal();
  if (event.key !== 'Tab') return;

  const focusable = [...dialog.querySelectorAll('button, input, a[href], [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.disabled && element.getClientRects().length);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

phoneInput?.addEventListener('input', () => phoneInput.setCustomValidity(''));
phoneInput?.addEventListener('countrychange', () => phoneInput.setCustomValidity(''));

function validatePhone(event) {
  if (phonePicker && !phonePicker.isValidNumber()) {
    event?.preventDefault();
    event?.stopImmediatePropagation();
    phoneInput.setCustomValidity('Проверьте номер телефона для выбранной страны');
    phoneInput.reportValidity();
    return false;
  }
  if (phonePicker) phoneInput.value = phonePicker.getNumber();
  return true;
}

form?.addEventListener('submit', event => {
  if (!formAssetsReady) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setSubmitting(true);
    prepareFormAssets()
      .then(() => {
        setSubmitting(false);
        if (validatePhone()) form.requestSubmit();
      })
      .catch(error => {
        setSubmitting(false);
        console.error('Form assets failed to load', error);
        phoneInput.setCustomValidity('Не удалось загрузить форму. Проверьте соединение и попробуйте ещё раз.');
        phoneInput.reportValidity();
      });
    return;
  }
  validatePhone(event);
}, true);

const countdownEndsAt = Date.now() + 15 * 60 * 1000;

function updateCountdown() {
  const remaining = Math.max(0, Math.floor((countdownEndsAt - Date.now()) / 1000));
  const values = {
    'record-hours': Math.floor(remaining / 3600),
    'record-minutes': Math.floor(remaining / 60) % 60,
    'record-seconds': remaining % 60
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value).padStart(2, '0');
  });
  if (remaining === 0) stopCountdown();
}

function startCountdown() {
  updateCountdown();
  if (!countdownTimer) countdownTimer = window.setInterval(updateCountdown, 1000);
}

function stopCountdown() {
  if (!countdownTimer) return;
  window.clearInterval(countdownTimer);
  countdownTimer = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCountdown();
  else if (modal && !modal.hidden) startCountdown();
});
