const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const ERC1155NFT = artifacts.require('ERC1155NFT');
const uri = 'https://token-cdn-domain/{id}.json';

module.exports = async function (deployer) {
  console.log('deploying ERC1155 nft contract............');
  const instance = await deployProxy(ERC1155NFT, [uri], { deployer, initializer: 'initialize' });
  process.env.ERC1155NFT_ADDRESS = instance.address;
};
