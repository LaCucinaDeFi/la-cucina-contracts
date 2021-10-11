const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const addresses = require('../configurations/Addresses.json');

const PublicMarketplaceV2 = artifacts.require('PublicMarketplaceV2');

module.exports = async function (deployer) {
  console.log('deploying PublicMarketplaceV2 contract ....................');

  // upgrade contract
  await upgradeProxy(addresses[deployer.network_id.toString()]['PublicMarketplace'], PublicMarketplaceV2);
};
