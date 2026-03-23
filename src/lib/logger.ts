/**
 * Application logger – wraps console methods so they can be conditionally silenced
 * in production (L-05 audit finding).
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("message");
 *   logger.warn("warning");
 *   logger.error("error");
 */

const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  /** Info-level log – suppressed in production */
  info: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  /** Warning-level log – always shown */
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  /** Error-level log – always shown */
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
