"use strict";
/**
 * Simple in-memory session store
 * Keeps conversation context in memory (RAM) until conversation is complete
 */
Object.defineProperty(exports, "__esModule", { value: true });
class SessionService {
    constructor() {
        this.sessions = new Map();
    }
    /**
     * Get or create session for a phone number
     */
    getSession(phone) {
        if (!this.sessions.has(phone)) {
            this.sessions.set(phone, {
                context: {},
                messages: [],
                lastActivity: new Date()
            });
        }
        const session = this.sessions.get(phone);
        session.lastActivity = new Date();
        return session;
    }
    /**
     * Update context for a session
     */
    updateContext(phone, newContext) {
        const session = this.getSession(phone);
        session.context = { ...session.context, ...newContext };
        console.log(`💾 Session updated for ${phone}:`, session.context);
    }
    /**
     * Add message to session history
     */
    addMessage(phone, role, content) {
        const session = this.getSession(phone);
        session.messages.push({ role, content });
        // Keep only last 10 messages to save memory
        if (session.messages.length > 10) {
            session.messages = session.messages.slice(-10);
        }
    }
    /**
     * Reset session
     */
    resetSession(phone) {
        this.sessions.delete(phone);
        console.log(`🗑️ Session reset for ${phone}`);
    }
    /**
     * Get session context
     */
    getContext(phone) {
        return this.getSession(phone).context;
    }
    /**
     * Get session messages
     */
    getMessages(phone) {
        return this.getSession(phone).messages;
    }
    /**
     * Clean up old sessions (older than 1 hour)
     */
    cleanupOldSessions() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        for (const [phone, session] of this.sessions.entries()) {
            if (session.lastActivity < oneHourAgo) {
                this.sessions.delete(phone);
                console.log(`🧹 Cleaned up old session for ${phone}`);
            }
        }
    }
}
// Create singleton instance
const sessionServiceInstance = new SessionService();
// Clean up old sessions every 15 minutes
setInterval(() => {
    sessionServiceInstance.cleanupOldSessions();
}, 15 * 60 * 1000);
exports.default = sessionServiceInstance;
