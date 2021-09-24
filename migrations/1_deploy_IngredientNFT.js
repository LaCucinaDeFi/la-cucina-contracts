const {deployProxy, admin} = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');

const IngredientNFT = artifacts.require('IngredientsNFT');
const Pantry = artifacts.require('Pantry');

const uri = 'https://token-cdn-domain/{id}.json';

module.exports = async function (deployer) {
	/*
   =======================================================================
   ======================== Deploy contract ==============================
   =======================================================================
 */
	console.log('deploying IngredientNFT contract............');
	let instance = await deployProxy(IngredientNFT, [uri], {initializer: 'initialize'});
	const fileData = {};

	const data = {};

	data['IngredientsNFT'] = instance.address.toString();
	fileData[deployer.network_id.toString()] = data;

	// ************************ Deploy Pantry *********************************
	console.log('deploying Pantry contract............');
	instance = await deployProxy(Pantry, [], {initializer: 'initialize'});

	data['Pantry'] = instance.address.toString();
	fileData[deployer.network_id.toString()] = data;

	const addresssPath = await path.join('configurations', 'Addresses.json');

	await fs.writeFile(addresssPath, JSON.stringify(fileData), (err) => {
		if (err) throw err;
	});
};
