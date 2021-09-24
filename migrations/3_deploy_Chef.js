const {deployProxy, admin} = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');

const addresses = require('../configurations/Addresses.json');

const IngredientsNFT = artifacts.require('IngredientsNFT');
const DishesNFT = artifacts.require('DishesNFT');
const Chef = artifacts.require('Chef');

module.exports = async function (deployer) {
	/*
   =======================================================================
   ======================== Deploy contract ==============================
   =======================================================================
 */
	console.log('deploying Chef contract............');
	const instance = await deployProxy(
		Chef,
		[
			addresses[deployer.network_id.toString()]['IngredientsNFT'],
			addresses[deployer.network_id.toString()]['DishesNFT'],
			addresses[deployer.network_id.toString()]['Pantry']
		],
		{
			initializer: 'initialize'
		}
	);

	// store proxy address in file
	const data = addresses[deployer.network_id.toString()];

	data['Chef'] = instance.address.toString();
	addresses[deployer.network_id.toString()] = data;

	const addresssPath = await path.join('configurations', 'Addresses.json');

	await fs.writeFile(addresssPath, JSON.stringify(addresses), (err) => {
		if (err) throw err;
	});

	/*
   =======================================================================
   ======================== Configure contracts ==========================
   =======================================================================
 */
	const IngredientNFT = await IngredientsNFT.at(
		addresses[deployer.network_id.toString()]['IngredientsNFT']
	);

	const DishNFT = await DishesNFT.at(addresses[deployer.network_id.toString()]['DishesNFT']);

	// add CHEF_ROLE to Chef contract in Dish NFT contract
	const CHEF_ROLE = await DishNFT.CHEF_ROLE();
	await DishNFT.grantRole(CHEF_ROLE, instance.address);

	// add Chef contract as exceptedFrom address in ingredient
	await IngredientNFT.addExceptedFromAddress(instance.address);

	// add Chef contract as excepted address in ingredient
	await IngredientNFT.addExceptedAddress(instance.address);
};
