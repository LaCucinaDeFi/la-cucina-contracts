const {upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const addresses = require('../configurations/Addresses.json');

const ChefV2 = artifacts.require('ChefV2');

module.exports = async function (deployer) {
	console.log('upgrading Chef contract............');

	// upgrade contract
	await upgradeProxy(addresses[deployer.network_id.toString()]['Chef'], ChefV2);
};
