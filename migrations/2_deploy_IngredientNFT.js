const {deployProxy, admin} = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');

const IngredientNFT = artifacts.require('IngredientsNFT');

const uri = 'https://token-cdn-domain/{id}.json';
const {royaltyReciever, royaltyFee} = require('../configurations/config');

module.exports = async function (deployer) {
	/*
   =======================================================================
   ======================== Deploy contract ==============================
   =======================================================================
 */
	console.log('deploying IngredientNFT contract............');
	let instance = await deployProxy(IngredientNFT, [uri, royaltyReciever[deployer.network_id.toString()], royaltyFee], {
		initializer: 'initialize'
	});

	const deployedInstance = await IngredientNFT.deployed();
	console.log('deployed Ingredient: ',deployedInstance.address);
	
	const fileData = {};

	const data = {};

	data['IngredientsNFT'] = instance.address.toString();
	fileData[deployer.network_id.toString()] = data;

	const addresssPath = await path.join(`configurations/${deployer.network_id.toString()}`, 'Addresses.json');

	await fs.writeFile(addresssPath, JSON.stringify(fileData), (err) => {
		if (err) throw err;
	});
};
