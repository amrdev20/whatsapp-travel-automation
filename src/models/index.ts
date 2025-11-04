import sequelize from '../config/database';
import User from './User';
import Conversation from './Conversation';
import Message from './Message';
import ConversationState from './ConversationState';

// Initialize database and sync models
export const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully');

    // Sync database (recreate tables to fix key issue)
    await sequelize.sync({ force: true });
    console.log('✓ Database models synchronized');
  } catch (error) {
    console.error('✗ Unable to connect to database:', error);
    throw error;
  }
};

export {
  sequelize,
  User,
  Conversation,
  Message,
  ConversationState
};
