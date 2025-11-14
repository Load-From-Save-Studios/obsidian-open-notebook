// Notice helper utility for user notifications
import { Notice } from 'obsidian';

export class NoticeHelper {
  private static lastNoticeTime: Map<string, number> = new Map();
  private static readonly DEBOUNCE_MS = 3000; // 3 seconds

  public static success(message: string, timeout?: number): void {
    new Notice(`✓ ${message}`, timeout);
  }

  public static error(message: string, timeout?: number): void {
    new Notice(`✗ ${message}`, timeout || 5000);
  }

  public static warn(message: string, timeout?: number): void {
    new Notice(`⚠ ${message}`, timeout);
  }

  public static info(message: string, timeout?: number): void {
    new Notice(message, timeout);
  }

  /**
   * Show a notice only if the same message hasn't been shown recently
   * Useful for preventing spam during rapid events
   */
  public static debounced(key: string, message: string, timeout?: number): void {
    const now = Date.now();
    const lastTime = this.lastNoticeTime.get(key);

    if (!lastTime || now - lastTime > this.DEBOUNCE_MS) {
      new Notice(message, timeout);
      this.lastNoticeTime.set(key, now);
    }
  }

  public static loading(message: string): Notice {
    return new Notice(`⏳ ${message}`, 0); // 0 = no auto-hide
  }

  public static hideNotice(notice: Notice): void {
    notice.hide();
  }
}
