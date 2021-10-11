const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const addresses = require('../configurations/Addresses.json');

const PrivateMarketplaceV2 = artifacts.require('PrivateMarketplaceV2');

module.exports = async function (deployer) {
  console.log('deploying PrivateMarketplaceV2 contract ....................');

  // upgrade contract
  await upgradeProxy(addresses[deployer.network_id.toString()]['PrivateMarketplace'], PrivateMarketplaceV2);
};
