/**
 * Session constants safe to import from both Node and Edge runtimes.
 * No crypto imports in this file.
 */
export const SESSION_COOKIE_NAME = 'idso_session';
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours
