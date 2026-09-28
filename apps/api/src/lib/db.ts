import prisma, { checkDatabaseConnection, connectDatabase, disconnectDatabase } from './prisma';

export {
  prisma,
  connectDatabase,
  disconnectDatabase,
  disconnectDatabase as closeDb,
  checkDatabaseConnection,
};
