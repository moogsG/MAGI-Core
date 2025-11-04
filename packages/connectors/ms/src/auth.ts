import { DeviceCodeCredential } from "@azure/identity";
import type { TokenStore } from "./types.js";
import type { HelperLogger } from "../../../server/dist/src/connections/types.js";

const SCOPES = ["Mail.Read", "Mail.Send", "Calendars.Read", "offline_access"];

export class MsAuthManager {
  private credential: DeviceCodeCredential | null = null;
  private tokenStore: TokenStore | null = null;
  private logger: HelperLogger;
  private clientId: string;
  private tenantId: string;

  constructor(logger: HelperLogger, clientId?: string, tenantId?: string) {
    this.logger = logger;
    this.clientId = clientId || process.env.MS_CLIENT_ID || "";
    this.tenantId = tenantId || process.env.MS_TENANT_ID || "common";

    if (!this.clientId) {
      throw new Error("MS_CLIENT_ID is required in environment or config");
    }
  }

  /**
   * Initiate device code flow and wait for user authentication
   */
  async authenticate(): Promise<void> {
    this.logger.info("ms.auth.start", { 
      clientId: this.clientId, 
      tenantId: this.tenantId 
    });

    this.credential = new DeviceCodeCredential({
      tenantId: this.tenantId,
      clientId: this.clientId,
      userPromptCallback: (info) => {
        // Display device code message to user
        console.log("\n" + "=".repeat(60));
        console.log("🔐 Microsoft Authentication Required");
        console.log("=".repeat(60));
        console.log(`\n📱 Please visit: ${info.verificationUri}`);
        console.log(`🔑 Enter code: ${info.userCode}`);
        console.log(`\n⏱️  Waiting for authentication...`);
        console.log("=".repeat(60) + "\n");

        this.logger.info("ms.auth.device-code", {
          verificationUri: info.verificationUri,
          userCode: info.userCode,
        });
      },
    });

    try {
      // Get initial token - this will wait for user to complete auth
      const tokenResponse = await this.credential.getToken(SCOPES);
      
      this.tokenStore = {
        access_token: tokenResponse.token,
        expires_at: tokenResponse.expiresOnTimestamp,
        scope: SCOPES.join(" "),
      };

      this.logger.info("ms.auth.success", {
        expiresAt: new Date(tokenResponse.expiresOnTimestamp).toISOString(),
      });

      console.log("\n✅ Authentication successful!\n");
    } catch (error: any) {
      this.logger.error("ms.auth.error", { error: error.message });
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    if (!this.credential) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      // DeviceCodeCredential handles token refresh automatically
      const tokenResponse = await this.credential.getToken(SCOPES);
      
      this.tokenStore = {
        access_token: tokenResponse.token,
        expires_at: tokenResponse.expiresOnTimestamp,
        scope: SCOPES.join(" "),
      };

      return tokenResponse.token;
    } catch (error: any) {
      this.logger.error("ms.auth.token-refresh-error", { error: error.message });
      throw new Error(`Failed to get access token: ${error.message}`);
    }
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.credential !== null && this.tokenStore !== null;
  }

  /**
   * Get the credential for use with Microsoft Graph client
   */
  getCredential(): DeviceCodeCredential {
    if (!this.credential) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }
    return this.credential;
  }

  /**
   * Get token info for debugging
   */
  getTokenInfo(): TokenStore | null {
    return this.tokenStore;
  }
}
