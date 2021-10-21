// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../DishesNFT.sol';

contract DishesNFTV2 is DishesNFT {
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

	function initialize(
		string memory _name,
		string memory _symbol,
		string memory baseTokenURI,
		address _ingredientAddress,
		address _pantryAddress
	) public virtual override initializer {
		require(_ingredientAddress != address(0), 'DishesNFT: INVALID_INGREDIENT_ADDRESS');
		require(_pantryAddress != address(0), 'DishesNFT: INVALID_PANTRY_ADDRESS');

		__BaseERC721_init(_name, _symbol, baseTokenURI);

		ingredientNft = IIngredientNFT(_ingredientAddress);
		pantry = IPantry(_pantryAddress);
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */

	function addBurner(address _burner) public virtual onlyAdmin {
		require(_burner != address(0), 'DishesNFTV2: ZERO_ADDRESS_FOUND');
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
