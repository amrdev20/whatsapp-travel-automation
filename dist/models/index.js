"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationState = exports.Message = exports.Conversation = exports.User = exports.sequelize = exports.initDatabase = void 0;
const database_1 = __importDefault(require("../config/database"));
exports.sequelize = database_1.default;
const User_1 = __importDefault(require("./User"));
exports.User = User_1.default;
const Conversation_1 = __importDefault(require("./Conversation"));
exports.Conversation = Conversation_1.default;
const Message_1 = __importDefault(require("./Message"));
exports.Message = Message_1.default;
const ConversationState_1 = __importDefault(require("./ConversationState"));
exports.ConversationState = ConversationState_1.default;
// Initialize database and sync models
const initDatabase = async () => {
    try {
        await database_1.default.authenticate();
        console.log('✓ Database connection established successfully');
        // Sync database (recreate tables to fix key issue)
        await database_1.default.sync({ force: true });
        console.log('✓ Database models synchronized');
    }
    catch (error) {
        console.error('✗ Unable to connect to database:', error);
        throw error;
    }
};
exports.initDatabase = initDatabase;
