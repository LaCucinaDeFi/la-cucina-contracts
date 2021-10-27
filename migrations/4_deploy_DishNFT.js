const {deployProxy, admin} = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');

const DishesNFT = artifacts.require('DishesNFT');

const uri = 'https://token-cdn-domain/{id}.json';

module.exports = async function (deployer) {
	/*
   	=======================================================================
   	======================== Deploy contract ==============================
   	=======================================================================
 	*/	
	const addresses = require(`../configurations/${deployer.network_id.toString()}/Addresses.json`);
	
	console.log('deploying DishesNFT contract............');
	const instance = await deployProxy(
		DishesNFT,
		[
			'DishesNFT',
			'DISH',
			uri,
			addresses[deployer.network_id.toString()]['IngredientsNFT'],
			addresses[deployer.network_id.toString()]['Kitchen']
		],
		{
			initializer: 'initialize'
		}
	);
	const deployedInstance = await DishesNFT.deployed();
	console.log('deployed Dish: ', deployedInstance.address);

	// store proxy address in file
	const data = addresses[deployer.network_id.toString()];

	data['DishesNFT'] = instance.address.toString();
	addresses[deployer.network_id.toString()] = data;

	const addresssPath = await path.join(`configurations/${deployer.network_id.toString()}`, 'Addresses.json');

	await fs.writeFile(addresssPath, JSON.stringify(addresses), (err) => {
		if (err) throw err;
	});
};
