const {deployProxy, admin} = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');
const addresses = require('../configurations/Addresses.json');

const Pantry = artifacts.require('Pantry');

module.exports = async function (deployer) {
	/*
   =======================================================================
   ======================== Deploy contract ==============================
   =======================================================================
 */

	// ************************ Deploy Pantry *********************************
	console.log('deploying Pantry contract............');
	instance = await deployProxy(Pantry, [], {initializer: 'initialize'});

	// store proxy address in file
	const data = addresses[deployer.network_id.toString()];

	data['Pantry'] = instance.address.toString();
	addresses[deployer.network_id.toString()] = data;

	const addresssPath = await path.join('configurations', 'Addresses.json');

	await fs.writeFile(addresssPath, JSON.stringify(addresses), (err) => {
		if (err) throw err;
	});
};
