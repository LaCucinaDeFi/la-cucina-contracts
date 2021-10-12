const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const addresses = require('../configurations/Addresses.json');

const ERC1155NFTV2 = artifacts.require('ERC1155NFTV2');

module.exports = async function (deployer) {
  // console.log('upgrading ERC1155 nft contract............');

  // // upgrade contract
  // await upgradeProxy(addresses[deployer.network_id.toString()]['ERC1155NFT'], ERC1155NFTV2);
};
