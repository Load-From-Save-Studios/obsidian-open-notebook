// Authentication manager for Open Notebook API
import { logger } from '../utils/Logger';

export class AuthManager {
  private password: string;

  constructor(password: string) {
    this.password = password;
  }

  public setPassword(password: string): void {
    this.password = password;
  }

  public getAuthHeaders(): Record<string, string> {
    return {
      'x-api-password': this.password
    };
  }

  public isConfigured(): boolean {
    return this.password !== null && this.password !== undefined && this.password.length > 0;
  }

  public validatePassword(password: string): boolean {
    // Basic validation - Open Notebook doesn't have strict requirements
    return password.length > 0;
  }
}
