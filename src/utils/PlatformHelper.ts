// Platform detection utility for mobile vs desktop
import { Platform } from 'obsidian';

export class PlatformHelper {
  /**
   * Check if running on mobile platform
   */
  public static isMobile(): boolean {
    return Platform.isMobile;
  }

  /**
   * Check if running on desktop platform
   */
  public static isDesktop(): boolean {
    return !Platform.isMobile;
  }

  /**
   * Check if running on iOS
   */
  public static isIOS(): boolean {
    return Platform.isIosApp;
  }

  /**
   * Check if running on Android
   */
  public static isAndroid(): boolean {
    return Platform.isAndroidApp;
  }

  /**
   * Check if running on macOS
   */
  public static isMacOS(): boolean {
    return Platform.isMacOS;
  }

  /**
   * Check if running on Windows
   */
  public static isWindows(): boolean {
    return Platform.isWin;
  }

  /**
   * Check if running on Linux
   */
  public static isLinux(): boolean {
    return Platform.isLinux;
  }

  /**
   * Get platform name
   */
  public static getPlatformName(): string {
    if (Platform.isIosApp) return 'iOS';
    if (Platform.isAndroidApp) return 'Android';
    if (Platform.isMacOS) return 'macOS';
    if (Platform.isWin) return 'Windows';
    if (Platform.isLinux) return 'Linux';
    return 'Unknown';
  }

  /**
   * Check if touch-capable device
   */
  public static isTouchDevice(): boolean {
    return Platform.isMobile || 'ontouchstart' in window;
  }

  /**
   * Get recommended cache TTL based on platform
   * Mobile devices get longer TTL to save battery/network
   */
  public static getRecommendedCacheTTL(): number {
    if (Platform.isMobile) {
      return 10 * 60 * 1000; // 10 minutes for mobile
    }
    return 5 * 60 * 1000; // 5 minutes for desktop
  }

  /**
   * Check if platform supports heavy operations
   * Used to disable resource-intensive features on mobile
   */
  public static supportsHeavyOperations(): boolean {
    return !Platform.isMobile;
  }

  /**
   * Get recommended UI scale factor for touch interfaces
   */
  public static getTouchScaleFactor(): number {
    return Platform.isMobile ? 1.2 : 1.0;
  }
}
