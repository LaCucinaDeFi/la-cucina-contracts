const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');

const Chef = artifacts.require('Chef');

module.exports = async function (deployer) {
  console.log('deploying Chef contract............');
  const instance = await deployProxy(Chef, [], { deployer, initializer: 'initialize' });
  const fileData = {};

  const data = {};

  data['Chef'] = instance.address.toString();
  fileData[deployer.network_id.toString()] = data;

  const addresssPath = await path.join('configurations', 'Addresses.json');

  await fs.writeFile(addresssPath, JSON.stringify(fileData), err => {
    if (err) throw err;
  });
};
