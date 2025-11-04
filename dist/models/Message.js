"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const Conversation_1 = __importDefault(require("./Conversation"));
class Message extends sequelize_1.Model {
}
Message.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    conversation_id: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'conversations',
            key: 'id',
        },
    },
    role: {
        type: sequelize_1.DataTypes.ENUM('user', 'assistant', 'system'),
        allowNull: false,
    },
    content: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    metadata: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'messages',
    timestamps: true,
    updatedAt: false,
    underscored: true,
});
Message.belongsTo(Conversation_1.default, { foreignKey: 'conversation_id' });
Conversation_1.default.hasMany(Message, { foreignKey: 'conversation_id' });
exports.default = Message;
