const {deployProxy, admin} = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');

const Kitchen = artifacts.require('Kitchen');

module.exports = async function (deployer) {
	/*
   	=======================================================================
   	======================== Deploy contract ==============================
   	=======================================================================
 	*/
	const addresses = require(`../configurations/${deployer.network_id.toString()}/Addresses.json`);
	// ************************ Deploy Kitchen *********************************
	console.log('deploying Kitchen contract............');
	instance = await deployProxy(Kitchen, [], {initializer: 'initialize'});
	const deployedInstance = await Kitchen.deployed();
	console.log('deployed Kitchen: ', deployedInstance.address);

	// store proxy address in file
	const data = addresses[deployer.network_id.toString()];

	data['Kitchen'] = instance.address.toString();
	addresses[deployer.network_id.toString()] = data;

	const addresssPath = await path.join(`configurations/${deployer.network_id.toString()}`, 'Addresses.json');

	await fs.writeFile(addresssPath, JSON.stringify(addresses), (err) => {
		if (err) throw err;
	});
};
