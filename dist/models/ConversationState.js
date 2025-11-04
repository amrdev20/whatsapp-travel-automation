"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const Conversation_1 = __importDefault(require("./Conversation"));
class ConversationState extends sequelize_1.Model {
}
ConversationState.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    conversation_id: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
            model: 'conversations',
            key: 'id',
        },
    },
    current_step: {
        type: sequelize_1.DataTypes.STRING(50),
        defaultValue: 'greeting',
    },
    collected_data: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'conversation_state',
    timestamps: true,
    underscored: true,
});
ConversationState.belongsTo(Conversation_1.default, { foreignKey: 'conversation_id' });
Conversation_1.default.hasOne(ConversationState, { foreignKey: 'conversation_id' });
exports.default = ConversationState;
