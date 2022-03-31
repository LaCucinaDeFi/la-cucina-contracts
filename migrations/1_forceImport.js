const fs = require('fs');
const path = require('path');
const {upgradeProxy, forceImport} = require('@openzeppelin/truffle-upgrades');

const PublicMarketplace = artifacts.require('PublicMarketplace');
const PrivateMarketplace = artifacts.require('PrivateMarketplace');
const IngredientsNFT = artifacts.require('IngredientsNFT');
const DishesNFT = artifacts.require('DishesNFT');
const Kitchen = artifacts.require('Kitchen');
const Cooker = artifacts.require('Cooker');

module.exports = async function (deployer) {
	const network_id = deployer.network_id.toString();
	const addresses = require(`../configurations/${network_id}/Addresses.json`);

	const contracts = [
		IngredientsNFT,
		Kitchen,
		DishesNFT,
		Cooker,
		PrivateMarketplace,
		PublicMarketplace
	];

	for (let contractInstance of contracts) {
		const instance = await forceImport(
			addresses[network_id][contractInstance.contractName],
			contractInstance,
			{kind: 'transparent'}
		);

		const addresssPath = await path.join(
			'.openzeppelin/',
			contractInstance.contractName,
			'_',
			network_id,
			'.json'
		);

		await fs.writeFile(addresssPath, instance, (err) => {
			if (err) throw err;
		});
	}
};
