/* telegram.js — интеграция с Telegram Web App SDK.
   Все обращения обёрнуты в проверки: вне Telegram игра работает так же. */

var TG = (function () {
  var wa = null;

  function api() {
    if (wa) return wa;
    if (window.Telegram && window.Telegram.WebApp) wa = window.Telegram.WebApp;
    return wa;
  }

  function init() {
    var t = api();
    if (!t) return false;
    try {
      t.ready();
      t.expand();
      // Игра всегда тёмная — тему клиента не применяем, только красим хром
      if (t.setHeaderColor) t.setHeaderColor('#0A0E14');
      if (t.setBackgroundColor) t.setBackgroundColor('#0A0E14');
      if (t.disableVerticalSwipes) t.disableVerticalSwipes();   // свайп вниз не должен закрывать игру
      if (t.enableClosingConfirmation) t.enableClosingConfirmation();
    } catch (e) { /* старый клиент — не критично */ }
    return true;
  }

  // Тактильная отдача: 'light' | 'medium' | 'heavy' | 'error' | 'success'
  function haptic(kind) {
    var t = api();
    if (!t || !t.HapticFeedback) return;
    try {
      if (kind === 'error' || kind === 'success' || kind === 'warning') {
        t.HapticFeedback.notificationOccurred(kind);
      } else {
        t.HapticFeedback.impactOccurred(kind);
      }
    } catch (e) { /* игнорируем */ }
  }

  function userName() {
    var t = api();
    try {
      if (t && t.initDataUnsafe && t.initDataUnsafe.user && t.initDataUnsafe.user.first_name) {
        return t.initDataUnsafe.user.first_name;
      }
    } catch (e) { /* игнорируем */ }
    return null;
  }

  // Поделиться результатом: внутри Telegram — шаринг, снаружи — копирование в буфер
  function share(text) {
    var t = api();
    var url = 'https://t.me/share/url?url=' +
      encodeURIComponent('https://t.me/') + '&text=' + encodeURIComponent(text);
    if (t && t.openTelegramLink) {
      try { t.openTelegramLink(url); return true; } catch (e) { /* упадём в фолбэк */ }
    }
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) { /* игнорируем */ }
    return false;
  }

  function isInside() { return !!api(); }

  return { init: init, haptic: haptic, userName: userName, share: share, isInside: isInside };
})();
