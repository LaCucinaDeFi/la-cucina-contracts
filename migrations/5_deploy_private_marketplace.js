const {deployProxy, getProxyImplementation} = require('@openzeppelin/truffle-upgrades');
const {supportedTokens} = require('../configurations/supportedTokens');

const fs = require('fs');
const path = require('path');

const addresses = require('../configurations/Addresses.json');

const IngredientNFT = artifacts.require('IngredientsNFT');
const PrivateMarketplace = artifacts.require('PrivateMarketplace');

module.exports = async function (deployer) {
	/*
   =======================================================================
   ======================== Deploy contract ==============================
   =======================================================================
 */
	console.log('deploying PrivateMarketplace contract ....................');

	const instance = await deployProxy(
		PrivateMarketplace,
		[addresses[deployer.network_id.toString()]['IngredientsNFT']],
		{
			deployer,
			initializer: 'initialize'
		}
	);

	// store proxy address in file
	const data = addresses[deployer.network_id.toString()];

	data['PrivateMarketplace'] = instance.address.toString();
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
