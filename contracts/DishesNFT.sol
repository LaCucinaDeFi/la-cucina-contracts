// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './ERC1155NFT.sol';
import './interfaces/IIngredientNFT.sol';
import './RecipeBase.sol';

contract DishesNFT is ERC1155NFT, RecipeBase {
	using Counters for Counters.Counter;

	/*
   =======================================================================
   ======================== Structures ===================================
   =======================================================================
 */

	struct Dish {
		address dishOwner;
		bool cooked;
		uint256 baseIngredientId;
		uint256 fats;
		uint256 totalIngredients;
		uint256 ingredientsHash;
	}

	/*
   =======================================================================
   ======================== Constants ====================================
   =======================================================================
 */
	bytes32 public constant CHEF_ROLE = keccak256('CHEF_ROLE');
	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */
	IIngredientNFT public ingredientNft;

	// dishID => dish
	mapping(uint256 => Dish) public dish;

	/*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

	function initialize(string memory url, address _ingredientAddress) public virtual initializer {
		require(_ingredientAddress != address(0), 'DishesNFT: INVALID_INGREDIENT_ADDRESS');
		__ERC1155PresetMinterPauser_init(url);

		ingredientNft = IIngredientNFT(_ingredientAddress);
	}

	/*
   =======================================================================
   ======================== Events =======================================
   =======================================================================
 */
	event DishPrepared(uint256 dishId);
	event DishUncooked(uint256 dishId);

	/*
   =======================================================================
   ======================== Modifiers ====================================
   =======================================================================
 */
	modifier onlyChef() {
		require(hasRole(CHEF_ROLE, msg.sender), 'DishesNFT: ONLY_CHEF_CAN_CALL');
		_;
	}

	modifier onlyValidDishId(uint256 _dishId) {
		require(_dishId > 0 && _dishId <= tokenCounter.current(), 'DishesNFT: INVALID_DISH_ID');
		_;
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */
	/**
	 * @notice This method allows chef contract to prepare the dish and mint dish nft to specified user
	 * @param _user - indicates the user address to whom dish nft to allocate
	 * @param _baseIngredientId - indicates the id of the baseIngredient for a dish
	 * @param _fats - indicates the total fats of dish
	 * @param _totalIngredients - indicates the total ingredients included in dish
	 * @param _ingredientsHash - indicates the ingredientHash for a dish
	 * @return dishId - indicates the new dish id
	 */
	function prepareDish(
		address _user,
		uint256 _baseIngredientId,
		uint256 _fats,
		uint256 _totalIngredients,
		uint256 _ingredientsHash
	) external onlyChef returns (uint256 dishId) {
		require(_user != address(0), 'DishesNFT: INVALID_USER_ADDRESS');
		require(_fats > 0, 'DishesNFT: INVALID_FATS');
		require(_ingredientsHash > 0, 'DishesNFT: INVALID_INGREDIENT_HASH');

		// increament dishId
		tokenCounter.increment();
		dishId = tokenCounter.current();

		dish[dishId] = Dish(_user, true, _baseIngredientId, _fats, _totalIngredients, _ingredientsHash);

		_mint(_user, dishId, 1, '');

		emit DishPrepared(dishId);
	}

	/**
	 * @notice This method alloes chef contract to uncook the dish.
	 * @param _dishId - indicates the dishId to be uncooked.
	 */
	function uncookDish(uint256 _dishId) external onlyChef onlyValidDishId(_dishId) {
		Dish storage dishToUncook = dish[_dishId];
		require(dishToUncook.cooked, 'DishesNFT: ALREADY_UNCOOKED_DISH');

		// uncook dish
		dishToUncook.cooked = false;

		emit DishUncooked(_dishId);
	}

	/*
   =======================================================================
   ======================== Getter Methods ===============================
   =======================================================================
 */

	/**
		@notice This method allows users to get the svg of their dish
		@param _dishId - indicates the dishId for which you want to get the svg
		@return svg - svg code of dish
    */
	function serveDish(uint256 _dishId)
		public
		view
		onlyValidDishId(_dishId)
		returns (string memory svg)
	{
		Dish memory dishToServe = dish[_dishId];
		require(dishToServe.cooked, 'DishesNFT: CANNOT_SERVE_UNCOOKED_DISH');

		string
			memory accumulator = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="0" width="1000" height="1000" viewBox="0, 0, 1616, 1216">';

		(, , string memory baseIngredientsSvg) = ingredientNft.baseIngredients(
			dishToServe.baseIngredientId
		);

		// add base ingredient
		accumulator = strConcat(accumulator, baseIngredientsSvg);

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 slottedValue;
		uint256 slotMultiplier;
		uint256 variation;
		string memory ingredientSvg;

		// Iterate Ingredient hash by Gene and assemble SVG sandwich
		for (uint8 slot = 0; slot <= uint8(dishToServe.totalIngredients); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			slottedValue = dishToServe.ingredientsHash & bitMask; // Extract slotted value from hash

			if (slottedValue > 0) {
				variation = (slot > 0) // Extract IngredientID from slotted value
					? slottedValue / slotMultiplier
					: slottedValue;

				require(
					variation > 0 && variation <= ingredientNft.getCurrentNftId(),
					'DishesNFT: INVALID_INGREDIENT_VARIATION'
				);

				(, , , ,ingredientSvg) = ingredientNft.ingredients(variation);
				accumulator = strConcat(accumulator, ingredientSvg);
			}
		}

		return strConcat(accumulator, '</svg>');
	}
}
