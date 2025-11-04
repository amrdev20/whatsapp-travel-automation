"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const User_1 = __importDefault(require("./User"));
class Conversation extends sequelize_1.Model {
}
Conversation.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    session_id: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('active', 'completed', 'cancelled'),
        defaultValue: 'active',
    },
}, {
    sequelize: database_1.default,
    tableName: 'conversations',
    timestamps: true,
    underscored: true,
});
Conversation.belongsTo(User_1.default, { foreignKey: 'user_id' });
User_1.default.hasMany(Conversation, { foreignKey: 'user_id' });
exports.default = Conversation;
