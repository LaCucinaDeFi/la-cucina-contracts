const {upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const addresses = require('../configurations/Addresses.json');

const PantryV2 = artifacts.require('PantryV2');

module.exports = async function (deployer) {
	console.log('upgrading Pantry contract............');

	// upgrade contract
	await upgradeProxy(addresses[deployer.network_id.toString()]['Pantry'], PantryV2);
};
