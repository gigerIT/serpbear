// Migration: add indexes for common keyword and domain lookups.

const tableExists = async (queryInterface, tableName, transaction) => {
  const [results] = await queryInterface.sequelize.query(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
    { transaction }
  );

  return Array.isArray(results) && results.length > 0;
};

const addIndexIfMissing = async (
  queryInterface,
  tableName,
  fields,
  name,
  transaction
) => {
  const indexes = await queryInterface.showIndex(tableName, { transaction });
  if (indexes.some((index) => index.name === name)) {
    return;
  }

  await queryInterface.addIndex(tableName, fields, {
    name,
    transaction,
  });
};

const removeIndexIfPresent = async (
  queryInterface,
  tableName,
  name,
  transaction
) => {
  const indexes = await queryInterface.showIndex(tableName, { transaction });
  if (!indexes.some((index) => index.name === name)) {
    return;
  }

  await queryInterface.removeIndex(tableName, name, { transaction });
};

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      if (await tableExists(queryInterface, "keyword", transaction)) {
        await addIndexIfMissing(
          queryInterface,
          "keyword",
          ["domain"],
          "keyword_domain_idx",
          transaction
        );
        await addIndexIfMissing(
          queryInterface,
          "keyword",
          ["keyword", "domain", "device", "country"],
          "keyword_lookup_idx",
          transaction
        );
        await addIndexIfMissing(
          queryInterface,
          "keyword",
          ["lastUpdated"],
          "keyword_last_updated_idx",
          transaction
        );
      }

      if (await tableExists(queryInterface, "domain", transaction)) {
        await addIndexIfMissing(
          queryInterface,
          "domain",
          ["slug"],
          "domain_slug_idx",
          transaction
        );
      }
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      if (await tableExists(queryInterface, "keyword", transaction)) {
        await removeIndexIfPresent(
          queryInterface,
          "keyword",
          "keyword_domain_idx",
          transaction
        );
        await removeIndexIfPresent(
          queryInterface,
          "keyword",
          "keyword_lookup_idx",
          transaction
        );
        await removeIndexIfPresent(
          queryInterface,
          "keyword",
          "keyword_last_updated_idx",
          transaction
        );
      }

      if (await tableExists(queryInterface, "domain", transaction)) {
        await removeIndexIfPresent(
          queryInterface,
          "domain",
          "domain_slug_idx",
          transaction
        );
      }
    });
  },
};
