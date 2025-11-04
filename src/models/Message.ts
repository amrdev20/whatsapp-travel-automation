import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Conversation from './Conversation';

interface MessageAttributes {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  createdAt?: Date;
}

interface MessageCreationAttributes extends Optional<MessageAttributes, 'id' | 'metadata'> {}

class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  public id!: number;
  public conversation_id!: number;
  public role!: 'user' | 'assistant' | 'system';
  public content!: string;
  public metadata?: any;
  public readonly createdAt!: Date;
}

Message.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    conversation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'conversations',
        key: 'id',
      },
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant', 'system'),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'messages',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

Message.belongsTo(Conversation, { foreignKey: 'conversation_id' });
Conversation.hasMany(Message, { foreignKey: 'conversation_id' });

export default Message;
