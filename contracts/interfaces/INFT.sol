// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';

interface INFT is IERC1155 {
  function mint(
    address _account,
    string memory _tokenuri,
    uint256 _amountOfCopies
  ) external returns (uint256 _tokenId);

  function burn(
    address _account,
    uint256 _tokenId,
    uint256 _amountOfCopies
  ) external;

  function setURI(uint256 _nftId, string memory _uri) external;

  function getURI(uint256 _nftId) external view returns (string memory);
}
