const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { supportedTokens } = require('../configurations/supportedTokens');

const ERC1155NFT = artifacts.require('ERC1155NFT');
const PrivateMarketplace = artifacts.require('PrivateMarketplace');

module.exports = async function (deployer) {
  console.log('deploying PrivateMarketplace contract ....................');
  const instance = await deployProxy(PrivateMarketplace, [process.env.ERC1155NFT_ADDRESS], {
    deployer,
    initializer: 'initialize',
  });

  const NftContract = await ERC1155NFT.at(process.env.ERC1155NFT_ADDRESS);
  const MINTER_ROLE = await NftContract.MINTER_ROLE();

  // add privateMarketplace as minter in ERC1155NFT contract
  await NftContract.grantRole(MINTER_ROLE, instance.address);

  // add privateMarketplace as excepted address in ERC1155 contract.
  await NftContract.addExceptedAddress(instance.address);

  // get network id
  const networkId = deployer.network_id;

  // add initially supported token
  for (let i = 0; i < supportedTokens[networkId].length; i++) {
    await instance.addSupportedToken(supportedTokens[networkId][i]);
  }
};
