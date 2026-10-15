import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Globe } from 'lucide-react';

type Language = 'th' | 'en';
const LanguageContext = createContext({ language: 'th' as Language, setLanguage: (_: Language) => {} });
export const COACH_MASCOT = '/images/rookie-coach-mascot-v1.png';

export function PlayerLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem('rookie-ui-language') === 'en' ? 'en' : 'th'; }
    catch { return 'th'; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('rookie-ui-language', language); } catch { /* Session-only preference. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function usePlayerLanguage() {
  const value = useContext(LanguageContext);
  return { ...value, t: (thai: string, english: string) => value.language === 'en' ? english : thai };
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = usePlayerLanguage();
  return <div className="language-switcher" role="group" aria-label={t('ภาษา', 'Language')}>
    <Globe size={15} aria-hidden />
    <button type="button" lang="th" aria-pressed={language === 'th'} onClick={() => setLanguage('th')}>ไทย</button>
    <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
  </div>;
}

export function CoachMascot({ className = '' }: { className?: string }) {
  return <img src={COACH_MASCOT} alt="Rookie Coach" className={`coach-mascot ${className}`} draggable={false} />;
}
