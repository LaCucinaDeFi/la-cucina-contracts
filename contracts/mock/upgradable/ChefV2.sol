// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../Chef.sol';

contract ChefV2 is Chef {
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

	/**
	 * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
	 */
	function initialize(address _ingredientNftAddress, address _dishesNftAddress)
		external
		virtual
		override
		initializer
	{
		require(_ingredientNftAddress != address(0), 'Chef: INVALID_INGREDIENT_ADDRESS');
		require(_dishesNftAddress != address(0), 'Chef: INVALID_DISHES_ADDRESS');

		__AccessControl_init();
		__ReentrancyGuard_init();

		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

		ingredientNft = IIngredientNFT(_ingredientNftAddress);
		dishesNft = IDishesNFT(_dishesNftAddress);
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */

	function addBurner(address _burner) public virtual {
		require(_burner != address(0), 'ChefV2: ZERO_ADDRESS_FOUND');
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
