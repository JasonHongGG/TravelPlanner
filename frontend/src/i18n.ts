import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhTW from './locales/zh-TW.json';
import enUS from './locales/en-US.json';
import jaJP from './locales/ja-JP.json';
import koKR from './locales/ko-KR.json';

i18n
    // detect user language
    // learn more: https://github.com/i18next/i18next-browser-languagedetector
    .use(LanguageDetector)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
        debug: true,
        fallbackLng: 'zh-TW',
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        resources: {
            'zh-TW': {
                translation: zhTW
            },
            'en-US': {
                translation: enUS
            },
            'ja-JP': {
                translation: jaJP
            },
            'ko-KR': {
                translation: koKR
            },
            'zh': { // Fallback for various Chinese locales to zh-TW
                translation: zhTW
            },
            'en': {
                translation: enUS
            },
            'ja': {
                translation: jaJP
            },
            'ko': {
                translation: koKR
            }
        }
    });

export default i18n;
