const { Sequelize } = require("sequelize");
const SequelizePackage = require("sequelize");
const { Umzug, SequelizeStorage } = require("umzug");
const sqliteDialect = require("./sqlite-dialect");

async function runMigrations() {
  const sequelize = new Sequelize({
    dialect: "sqlite",
    dialectModule: sqliteDialect,
    storage: "./data/database.sqlite",
    logging: false,
  });

  try {
    const umzug = new Umzug({
      migrations: {
        glob: "database/migrations/*.js",
        resolve: ({ name, path: migrationPath, context }) => {
          const migration = require(migrationPath);

          return {
            name,
            up: async () => migration.up(context, SequelizePackage),
            down: async () => migration.down(context, SequelizePackage),
          };
        },
      },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: undefined,
    });

    const pendingMigrations = await umzug.pending();
    const executedMigrations = await umzug.up();

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations.");
      return;
    }

    console.log(
      `Applied ${executedMigrations.length} migration${
        executedMigrations.length === 1 ? "" : "s"
      }.`
    );
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  runMigrations().catch((error) => {
    console.error("Database migration failed:", error);
    process.exit(1);
  });
}

module.exports = runMigrations;
