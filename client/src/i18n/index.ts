import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

const stored = localStorage.getItem('gavran.locale');
const lng = stored === 'hi' || stored === 'mr' || stored === 'en' ? stored : 'en';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    mr: { translation: mr },
  },
  lng,
  fallbackLng: 'en',
  keySeparator: false,
  interpolation: { escapeValue: false },
});

function applyLang(language: string) {
  document.documentElement.lang = language;
}

applyLang(lng);
i18n.on('languageChanged', applyLang);

export default i18n;
