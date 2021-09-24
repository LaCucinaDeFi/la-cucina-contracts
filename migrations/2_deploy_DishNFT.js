const {deployProxy, admin} = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');

const IngredientsNFT = artifacts.require('IngredientsNFT');
const DishesNFT = artifacts.require('DishesNFT');
const addresses = require('../configurations/Addresses.json');

const uri = 'https://token-cdn-domain/{id}.json';

module.exports = async function (deployer) {
	/*
   =======================================================================
   ======================== Deploy contract ==============================
   =======================================================================
 */
	console.log('deploying DishesNFT contract............');
	const instance = await deployProxy(
		DishesNFT,
		[
			uri,
			addresses[deployer.network_id.toString()]['IngredientsNFT'],
			addresses[deployer.network_id.toString()]['Pantry']
		],
		{
			initializer: 'initialize'
		}
	);

	// store proxy address in file
	const data = addresses[deployer.network_id.toString()];

	data['DishesNFT'] = instance.address.toString();
	addresses[deployer.network_id.toString()] = data;

	const addresssPath = await path.join('configurations', 'Addresses.json');

	await fs.writeFile(addresssPath, JSON.stringify(addresses), (err) => {
		if (err) throw err;
	});
};
