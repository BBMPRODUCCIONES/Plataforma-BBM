/**
 * Production-safe logger utility
 * Only logs in development mode to keep production console clean
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  // These always log (errors and warnings are important in production)
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};
