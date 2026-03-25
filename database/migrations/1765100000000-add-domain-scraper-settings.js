// Migration: add scraper_settings column for per-domain scraper overrides.

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='domain'`,
        { transaction }
      );

      if (!Array.isArray(results) || results.length === 0) {
        return;
      }

      const domainTableDefinition = await queryInterface.describeTable(
        "domain"
      );
      if (!domainTableDefinition.scraper_settings) {
        await queryInterface.addColumn(
          "domain",
          "scraper_settings",
          {
            type: Sequelize.DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
          },
          { transaction }
        );
      }
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const [results] = await queryInterface.sequelize.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='domain'`,
        { transaction }
      );

      if (!Array.isArray(results) || results.length === 0) {
        return;
      }

      const domainTableDefinition = await queryInterface.describeTable(
        "domain"
      );
      if (domainTableDefinition.scraper_settings) {
        await queryInterface.removeColumn("domain", "scraper_settings", {
          transaction,
        });
      }
    });
  },
};
