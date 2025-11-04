import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Conversation from './Conversation';

interface ConversationStateAttributes {
  id: number;
  conversation_id: number;
  current_step: string;
  collected_data?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ConversationStateCreationAttributes extends Optional<ConversationStateAttributes, 'id' | 'current_step' | 'collected_data'> {}

class ConversationState extends Model<ConversationStateAttributes, ConversationStateCreationAttributes> implements ConversationStateAttributes {
  public id!: number;
  public conversation_id!: number;
  public current_step!: string;
  public collected_data?: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ConversationState.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    conversation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'conversations',
        key: 'id',
      },
    },
    current_step: {
      type: DataTypes.STRING(50),
      defaultValue: 'greeting',
    },
    collected_data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'conversation_state',
    timestamps: true,
    underscored: true,
  }
);

ConversationState.belongsTo(Conversation, { foreignKey: 'conversation_id' });
Conversation.hasOne(ConversationState, { foreignKey: 'conversation_id' });

export default ConversationState;
