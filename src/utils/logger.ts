/**
 * Browser-compatible logger for metaGOTHIC UI components
 * Replaces the Winston-based logger which doesn't work in browser environments
 */

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error): void;
  debug(message: string, ...args: any[]): void;
}

class BrowserLogger implements Logger {
  constructor(private name: string) {}

  info(message: string, ...args: any[]): void {
    console.log(`[${this.name}] INFO:`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.name}] WARN:`, message, ...args);
  }

  error(message: string, error?: Error): void {
    if (error) {
      console.error(`[${this.name}] ERROR:`, message, error);
    } else {
      console.error(`[${this.name}] ERROR:`, message);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (import.meta.env.DEV) {
      console.debug(`[${this.name}] DEBUG:`, message, ...args);
    }
  }
}

export function createLogger(name: string): Logger {
  return new BrowserLogger(name);
}