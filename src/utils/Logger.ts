// Logger utility for Open Notebook plugin

export class Logger {
  private static instance: Logger;
  private debugEnabled: boolean = false;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  public debug(message: string, ...args: any[]): void {
    if (this.debugEnabled) {
      console.log(`[Open Notebook Debug] ${message}`, ...args);
    }
  }

  public info(message: string, ...args: any[]): void {
    console.log(`[Open Notebook] ${message}`, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    console.warn(`[Open Notebook Warning] ${message}`, ...args);
  }

  public error(message: string, error?: any): void {
    console.error(`[Open Notebook Error] ${message}`, error);
  }
}

export const logger = Logger.getInstance();
