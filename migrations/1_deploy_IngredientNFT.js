const {deployProxy, admin} = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');

const IngredientNFT = artifacts.require('IngredientsNFT');

const uri = 'https://token-cdn-domain/{id}.json';
const royaltyReciever = '0x1593B3d9955bB76B96C7bb9238496f933e2e46Ff';
const royaltyFee = '100'; //10%

module.exports = async function (deployer) {
	/*
   =======================================================================
   ======================== Deploy contract ==============================
   =======================================================================
 */
	console.log('deploying IngredientNFT contract............');
	let instance = await deployProxy(IngredientNFT, [uri, royaltyReciever, royaltyFee], {
		initializer: 'initialize'
	});

	const deployedInstance = await IngredientNFT.deployed();
	console.log('deployed Ingredient: ',deployedInstance.address);
	
	const fileData = {};

	const data = {};

	data['IngredientsNFT'] = instance.address.toString();
	fileData[deployer.network_id.toString()] = data;

	const addresssPath = await path.join('configurations', 'Addresses.json');

	await fs.writeFile(addresssPath, JSON.stringify(fileData), (err) => {
		if (err) throw err;
	});
};
