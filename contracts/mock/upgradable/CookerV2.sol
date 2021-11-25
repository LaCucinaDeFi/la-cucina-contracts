// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../Cooker.sol';

contract CookerV2 is Cooker {
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
	function initialize(
		address _ingredientNft,
		address _dishesNft,
		address _lacToken,
		address _talien,
		uint256 _uncookingFee,
		uint256 _maxIngredients,
		uint256 _additionalIngredients
	) external virtual override initializer {
		require(_ingredientNft != address(0), 'Cooker: INVALID_INGREDIENT_ADDRESS');
		require(_dishesNft != address(0), 'Cooker: INVALID_DISHES_ADDRESS');
		require(_lacToken != address(0), 'Cooker: INVALID_LAC_ADDRESS');
		require(_talien != address(0), 'Cooker: INVALID_TALIEN_ADDRESS');
		require(_maxIngredients > 1, 'Cooker: INSUFFICIENT_INGREDIENTS');

		__AccessControl_init();
		__ReentrancyGuard_init();

		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

		ingredientNft = IIngredientNFT(_ingredientNft);
		dishesNft = IDishesNFT(_dishesNft);
		lacToken = IBEP20(_lacToken);
		talien = ITalien(_talien);
		uncookingFee = _uncookingFee;
		maxIngredients = _maxIngredients;
		additionalIngredients = _additionalIngredients;
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
