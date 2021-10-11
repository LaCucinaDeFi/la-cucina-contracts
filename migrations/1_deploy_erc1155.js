const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');
const fs = require('fs');
const path = require('path');

const ERC1155NFT = artifacts.require('ERC1155NFT');
const uri = 'https://token-cdn-domain/{id}.json';

module.exports = async function (deployer) {
  console.log('deploying ERC1155 nft contract............');
  const instance = await deployProxy(ERC1155NFT, [uri], { deployer, initializer: 'initialize' });
  const fileData = {};

  const data = {};

  data['ERC1155NFT'] = instance.address.toString();
  fileData[deployer.network_id.toString()] = data;

  const addresssPath = await path.join('configurations', 'Addresses.json');

  await fs.writeFile(addresssPath, JSON.stringify(fileData), err => {
    if (err) throw err;
  });
};
