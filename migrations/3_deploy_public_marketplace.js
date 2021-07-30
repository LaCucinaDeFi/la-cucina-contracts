const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const ERC1155NFT = artifacts.require('ERC1155NFT');
const PublicMarketplace = artifacts.require('PublicMarketplace');
const { supportedTokens } = require('../configurations/supportedTokens');

module.exports = async function (deployer) {
  console.log('deploying PublicMarketplace contract ....................');
  const instance = await deployProxy(PublicMarketplace, [process.env.ERC1155NFT_ADDRESS], {
    deployer,
    initializer: 'initialize',
  });

  const NftContract = await ERC1155NFT.at(process.env.ERC1155NFT_ADDRESS);

  // add privateMarketplace as excepted address in ERC1155 contract.
  await NftContract.addExceptedAddress(instance.address);

  // get network id
  const networkId = deployer.network_id;

  // add initially supported token
  for (let i = 0; i < supportedTokens[networkId].length; i++) {
    await instance.addSupportedToken(supportedTokens[networkId][i]);
  }
};
