// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';

interface INFT is IERC1155 {
	function getCurrentNftId() external view returns (uint256);

	function getIpfsHash(uint256 _tokenID) external view returns (string memory);
}
