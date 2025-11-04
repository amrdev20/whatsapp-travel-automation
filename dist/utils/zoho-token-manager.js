"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ZohoTokenManager {
    constructor() {
        this.tokenFile = path_1.default.join(__dirname, '../../.zoho-tokens.json');
        this.clientId = process.env.ZOHO_CLIENT_ID || '1000.D9KNJDXE7BF86WKY68BCCSIVCAP6OP';
        this.clientSecret = process.env.ZOHO_CLIENT_SECRET || 'b6cf1648e0282c1559ffd35412aa4f96e7e1b0429d';
        this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || '';
    }
    /**
     * Get valid access token (auto-refresh if expired)
     */
    async getAccessToken() {
        try {
            // Check if we have a saved token
            if (fs_1.default.existsSync(this.tokenFile)) {
                const tokenData = JSON.parse(fs_1.default.readFileSync(this.tokenFile, 'utf8'));
                // Check if token is still valid (with 5 min buffer)
                if (tokenData.expires_at > Date.now() + 300000) {
                    console.log('✅ Using cached access token');
                    return tokenData.access_token;
                }
            }
            // Token expired or doesn't exist, refresh it
            console.log('🔄 Refreshing access token...');
            return await this.refreshAccessToken();
        }
        catch (error) {
            console.error('Failed to get access token:', error.message);
            throw error;
        }
    }
    /**
     * Refresh the access token using refresh token
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('ZOHO_REFRESH_TOKEN not found in environment variables');
        }
        try {
            const response = await axios_1.default.post('https://accounts.zoho.com/oauth/v2/token', null, {
                params: {
                    grant_type: 'refresh_token',
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    refresh_token: this.refreshToken
                }
            });
            const { access_token, expires_in } = response.data;
            // Save token with expiry time
            const tokenData = {
                access_token,
                expires_at: Date.now() + (expires_in * 1000),
                refresh_token: this.refreshToken
            };
            fs_1.default.writeFileSync(this.tokenFile, JSON.stringify(tokenData, null, 2));
            console.log('✅ Access token refreshed and saved');
            return access_token;
        }
        catch (error) {
            console.error('Failed to refresh token:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Set refresh token (for initial setup)
     */
    setRefreshToken(refreshToken) {
        this.refreshToken = refreshToken;
        process.env.ZOHO_REFRESH_TOKEN = refreshToken;
        console.log('✅ Refresh token set');
    }
}
exports.default = new ZohoTokenManager();
