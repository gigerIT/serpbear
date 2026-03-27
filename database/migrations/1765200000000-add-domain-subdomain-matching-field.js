// Migration: add subdomain_matching column for domain-level SERP matching overrides.

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
      if (!domainTableDefinition.subdomain_matching) {
        await queryInterface.addColumn(
          "domain",
          "subdomain_matching",
          {
            type: Sequelize.DataTypes.STRING,
            allowNull: true,
            defaultValue: "",
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
      if (domainTableDefinition.subdomain_matching) {
        await queryInterface.removeColumn("domain", "subdomain_matching", {
          transaction,
        });
      }
    });
  },
};
