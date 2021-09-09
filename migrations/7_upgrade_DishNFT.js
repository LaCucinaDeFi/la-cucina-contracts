const {upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const addresses = require('../configurations/Addresses.json');

const DishesNFTV2 = artifacts.require('DishesNFTV2');

module.exports = async function (deployer) {
	console.log('upgrading DishesNFT contract............');

	// upgrade contract
	await upgradeProxy(addresses[deployer.network_id.toString()]['DishesNFT'], DishesNFTV2);
};
