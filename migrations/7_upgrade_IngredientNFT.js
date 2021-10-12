const {upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const addresses = require('../configurations/Addresses.json');

const IngredientsNFTV2 = artifacts.require('IngredientsNFTV2');

module.exports = async function (deployer) {
	// console.log('upgrading IngredientsNFT contract............');

	// // upgrade contract
	// await upgradeProxy(addresses[deployer.network_id.toString()]['IngredientsNFT'], IngredientsNFTV2);
};
