const {deployProxy, admin} = require('@openzeppelin/truffle-upgrades');
const {ether} = require('@openzeppelin/test-helpers');

const fs = require('fs');
const path = require('path');

const {supportedTokens} = require('../configurations/config');
const IngredientsNFT = artifacts.require('IngredientsNFT');
const DishesNFT = artifacts.require('DishesNFT');
const Oven = artifacts.require('Oven');
const SampleToken = artifacts.require('SampleToken');

const TalienAddress = '0x7C8a9A5f1053f8E8f02DCC9e4a6C980112FE483F';
const maxIngredients = 5;
const additionalIngredients = 2;
const uncookingFee = ether('5');

module.exports = async function (deployer) {
	/*
   	=======================================================================
   	======================== Deploy contract ==============================
   	=======================================================================
 	*/
	const addresses = require(`../configurations/${deployer.network_id.toString()}/Addresses.json`);
	console.log('deploying Oven contract............');
	// store proxy address in file
	const data = addresses[deployer.network_id.toString()];

	let instance;

	if (deployer.network_id != 1111) {
		instance = await deployProxy(
			Oven,
			[
				addresses[deployer.network_id.toString()]['IngredientsNFT'],
				addresses[deployer.network_id.toString()]['DishesNFT'],
				supportedTokens[deployer.network_id][0],
				TalienAddress,
				uncookingFee,
				maxIngredients,
				additionalIngredients
			],
			{
				initializer: 'initialize'
			}
		);
	} else {
		const sampleToken = await SampleToken.new();
		data['SampleToken'] = sampleToken.address.toString();

		instance = await deployProxy(
			Oven,
			[
				addresses[deployer.network_id.toString()]['IngredientsNFT'],
				addresses[deployer.network_id.toString()]['DishesNFT'],
				sampleToken.address,
				TalienAddress,
				uncookingFee,
				maxIngredients,
				additionalIngredients
			],
			{
				initializer: 'initialize'
			}
		);
	}
	const deployedInstance = await Oven.deployed();
	console.log('deployed Oven: ', deployedInstance.address);

	data['Oven'] = instance.address.toString();
	addresses[deployer.network_id.toString()] = data;

	const addresssPath = await path.join(`configurations/${deployer.network_id.toString()}`, 'Addresses.json');

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

	// add OVEN_ROLE to Oven contract in Dish NFT contract
	const OVEN_ROLE = await DishNFT.OVEN_ROLE();
	await DishNFT.grantRole(OVEN_ROLE, instance.address);

	// add Oven contract as excepted address in ingredient
	await IngredientNFT.addExceptedAddress(instance.address);

	// add Oven contract as excepted address in dishesNft
	await DishNFT.addExceptedAddress(instance.address);

	// add Oven contract as exceptedFrom address in ingredient
	await IngredientNFT.addExceptedFromAddress(instance.address);

	//*****************************Add flames in ovens*********************************** */

	// add normal flame. preparation time = 15 mins , LAC charge = 0
	await instance.addFlame('Normal', 60 * 15, ether('0'));

	// add High flame. preparation time = 5 mins , LAC charge = 5
	await instance.addFlame('High', 60 * 5, ether('5'));

	// add Radiation flame. preparation time = 1 mins , LAC charge = 10
	await instance.addFlame('Radiation', 60, ether('10'));

	// add Radiation flame. preparation time = 1 mins , LAC charge = 50
	await instance.addFlame('laser', 3, ether('50'));
};
