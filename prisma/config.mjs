module.exports = {
    datasources: {
      db: {
        provider: 'mysql',
        url: 'mysql://cleartrackings:Pk123321@localhost:3306/cleartrackings',
        // Or use separate fields if preferred:
        // host: 'localhost',
        // port: 3306,
        // database: 'cleartracking_db',
        // username: 'root',
        // password: 'your_password',
      },
    },
    secret: 'your-prisma-secret-key', // Required for encryption
    models: ['User', 'DesignerPermission', 'Case', 'Message', 'Revision'], // Match your schema.prisma models
  };