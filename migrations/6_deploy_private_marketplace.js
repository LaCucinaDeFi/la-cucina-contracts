const {deployProxy, getProxyImplementation} = require('@openzeppelin/truffle-upgrades');
const {time} = require('@openzeppelin/test-helpers');

const fs = require('fs');
const path = require('path');

const {supportedTokens} = require('../configurations/config');

const IngredientNFT = artifacts.require('IngredientsNFT');
const PrivateMarketplace = artifacts.require('PrivateMarketplace');
const TalienAddress = '0x7C8a9A5f1053f8E8f02DCC9e4a6C980112FE483F';

module.exports = async function (deployer) {
	/*
   =======================================================================
   ======================== Deploy contract ==============================
   =======================================================================
 */
	console.log('deploying PrivateMarketplace contract ....................');
	const addresses = require(`../configurations/${deployer.network_id.toString()}/Addresses.json`);

	const instance = await deployProxy(
		PrivateMarketplace,
		[
			addresses[deployer.network_id.toString()]['IngredientsNFT'],
			TalienAddress,
			time.duration.days(1)
		],
		{
			deployer,
			initializer: 'initialize'
		}
	);

	const deployedInstance = await PrivateMarketplace.deployed();
	console.log('deployed PrivateMarketplace: ', deployedInstance.address);

	// store proxy address in file
	const data = addresses[deployer.network_id.toString()];

	data['PrivateMarketplace'] = instance.address.toString();
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

	const IngredientsNFT = await IngredientNFT.at(
		addresses[deployer.network_id.toString()]['IngredientsNFT']
	);

	// add privateMarketplace as minter in ERC1155NFT contract
	const MINTER_ROLE = await IngredientsNFT.MINTER_ROLE();
	await IngredientsNFT.grantRole(MINTER_ROLE, instance.address);

	// add privateMarketplace as excepted address in ERC1155 contract.
	await IngredientsNFT.addExceptedAddress(instance.address);

	// add initially supported token
	for (let i = 0; i < supportedTokens[deployer.network_id].length; i++) {
		await instance.addSupportedToken(supportedTokens[deployer.network_id][i]);
	}
};
