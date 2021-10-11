const {upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const addresses = require('../configurations/Addresses.json');

const OvenV2 = artifacts.require('OvenV2');

module.exports = async function (deployer) {
	console.log('upgrading Oven contract............');

	// upgrade contract
	await upgradeProxy(addresses[deployer.network_id.toString()]['Oven'], OvenV2);
};
