const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { supportedTokens } = require('../configurations/supportedTokens');

const fs = require('fs');
const path = require('path');

const addresses = require('../configurations/Addresses.json');

const ERC1155NFT = artifacts.require('ERC1155NFT');
const PublicMarketplace = artifacts.require('PublicMarketplace');

module.exports = async function (deployer) {
  /*
   =======================================================================
   ======================== Deploy contract ==============================
   =======================================================================
 */
  console.log('deploying PublicMarketplace contract ....................');

  const instance = await deployProxy(PublicMarketplace, [addresses[deployer.network_id.toString()]['ERC1155NFT']], {
    deployer,
    initializer: 'initialize',
  });

  // store proxy address in file
  const data = addresses[deployer.network_id.toString()];

  data['PublicMarketplace'] = instance.address.toString();
  addresses[deployer.network_id.toString()] = data;

  const addresssPath = await path.join('configurations', 'Addresses.json');

  await fs.writeFile(addresssPath, JSON.stringify(addresses), err => {
    if (err) throw err;
  });

  /*
   =======================================================================
   ======================== Configure contracts ==========================
   =======================================================================
 */

  const NftContract = await ERC1155NFT.at(addresses[deployer.network_id.toString()]['ERC1155NFT']);

  // add privateMarketplace as excepted address in ERC1155 contract.
  await NftContract.addExceptedAddress(instance.address);

  // get network id
  const networkId = deployer.network_id;

  // add initially supported token
  for (let i = 0; i < supportedTokens[networkId].length; i++) {
    await instance.addSupportedToken(supportedTokens[networkId][i]);
  }
};
