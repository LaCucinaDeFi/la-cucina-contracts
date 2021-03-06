// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../IngredientsNFT.sol';

contract IngredientsNFTV2 is IngredientsNFT {
	/*
   =======================================================================
   ======================== Public Variables =============================
   =======================================================================
 */
	address[] public burners;

	/*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

	function initialize(string memory url) public virtual initializer {
		__BaseERC1155_init(url);
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */

	function addBurner(address _burner) public virtual onlyOperator {
		require(_burner != address(0), 'ERC1155: ZERO_ADDRESS_FOUND');
		burners.push(_burner);
	}

	/*
   =======================================================================
   ======================== Getter Methods ===============================
   =======================================================================
 */

	/**
	 * @notice Returns the storage, major, minor, and patch version of the contract.
	 * @return The storage, major, minor, and patch version of the contract.
	 */
	function getVersionNumber()
		external
		pure
		override
		returns (
			uint256,
			uint256,
			uint256
		)
	{
		return (2, 0, 0);
	}
}
