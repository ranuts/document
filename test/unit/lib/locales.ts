import { loadLocale, SHELL_LOCALES } from '@ranuts/shared/i18n';

/** Tests that switch languages synchronously need every table in memory first. */
export const loadAllLocales = (): Promise<void[]> => Promise.all(SHELL_LOCALES.map(loadLocale));
