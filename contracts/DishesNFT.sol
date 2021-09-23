// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './ERC1155NFT.sol';
import './RecipeBase.sol';
import './interfaces/IIngredientNFT.sol';
import './interfaces/IPantry.sol';

contract DishesNFT is ERC1155NFT {
	using Counters for Counters.Counter;

	/*
   =======================================================================
   ======================== Structures ===================================
   =======================================================================
 */

	struct Dish {
		address dishOwner;
		bool cooked;
		uint256 dishId;
		uint256 fats;
		uint256 totalBaseIngredients;
		uint256 totalIngredients;
		uint256 ingredientsHash;
		uint256 ingredientVariationHash; // indicates hash of the indexes of ingredient variations
		uint256 baseVariationHash;
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
	IPantry public pantry;

	// dishID => dish
	mapping(uint256 => Dish) public dish;

	/*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

	function initialize(
		string memory url,
		address _ingredientAddress,
		address _pantryAddress
	) public virtual initializer {
		require(_ingredientAddress != address(0), 'DishesNFT: INVALID_INGREDIENT_ADDRESS');
		require(_pantryAddress != address(0), 'DishesNFT: INVALID_PANTRY_ADDRESS');

		__ERC1155PresetMinterPauser_init(url);

		ingredientNft = IIngredientNFT(_ingredientAddress);
		pantry = IPantry(_pantryAddress);
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
	 * @param _dishId - indicates the id of the  dish
	 * @param _fats - indicates the total fats of dish
	 * @param _totalIngredients - indicates the total ingredients included in dish
	 * @param _ingredientsHash - indicates the ingredientHash for a dish
	 * @return dishId - indicates the new dish id
	 */
	function prepareDish(
		address _user,
		uint256 _dishId,
		uint256 _fats,
		uint256 _totalBaseIngredients,
		uint256 _totalIngredients,
		uint256 _ingredientsHash,
		uint256 _ingredientVariationHash,
		uint256 _baseVariationHash
	) external onlyChef returns (uint256 dishId) {
		require(_user != address(0), 'DishesNFT: INVALID_USER_ADDRESS');
		require(_fats > 0, 'DishesNFT: INVALID_FATS');

		// increament dishId
		tokenCounter.increment();
		dishId = tokenCounter.current();

		dish[dishId] = Dish(
			_user,
			true,
			_dishId,
			_fats,
			_totalBaseIngredients,
			_totalIngredients,
			_ingredientsHash,
			_ingredientVariationHash,
			_baseVariationHash
		);

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
		@return accumulator - svg code of dish
    */
	function serveDish(uint256 _dishId)
		external
		view
		onlyValidDishId(_dishId)
		returns (string memory accumulator)
	{
		Dish memory dishToServe = dish[_dishId];
		require(dishToServe.cooked, 'DishesNFT: CANNOT_SERVE_UNCOOKED_DISH');

		accumulator = _prepareDefs(dishToServe.totalBaseIngredients, dishToServe.baseVariationHash);

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 ingredientSlottedValue;
		uint256 ingredientVariationValue;
		uint256 slotMultiplier;
		uint256 ingredientId;
		uint256 ingredientVariationIndex;

		// Iterate Ingredient hash and assemble SVGs
		for (uint8 slot = 0; slot <= uint8(dishToServe.totalIngredients); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			ingredientSlottedValue = dishToServe.ingredientsHash & bitMask; // Extract slotted value from hash
			ingredientVariationValue = dishToServe.ingredientVariationHash & bitMask;

			if (ingredientSlottedValue > 0) {
				ingredientId = (slot > 0) // Extract IngredientID from slotted value
					? ingredientSlottedValue / slotMultiplier
					: ingredientSlottedValue;

				ingredientVariationIndex = (slot > 0) // Extract variation from slotted value
					? ingredientVariationValue / slotMultiplier
					: ingredientVariationValue;

				require(
					ingredientId > 0 && ingredientId <= ingredientNft.getCurrentNftId(),
					'DishesNFT: INVALID_INGREDIENT_ID'
				);
				require(ingredientVariationIndex > 0, 'DishesNFT: INVALID_INGREDIENT_VARIATION_INDEX_ID');

				(, string memory name, , ) = ingredientNft.ingredients(ingredientId);

				string memory placeHolder = _getPlaceHolder(name, ingredientVariationIndex);
				
				accumulator = string(abi.encodePacked(accumulator, placeHolder));
			}
		}

		accumulator = RecipeBase.strConcat(accumulator, string('</svg>'));
		return accumulator;
	}

	function _prepareDefs(uint256 _totalBaseIngredients, uint256 _baseVariationHash)
		internal
		view
		returns (string memory)
	{
		string
			memory accumulator = '<svg xmlns="http://www.w3.org/2000/svg" width="268.5" height="184.3">';

		//get base variations

		//add defs
		accumulator = RecipeBase.strConcat(accumulator, '<defs>');

		// add ingredient defs
		accumulator = RecipeBase.strConcat(accumulator, getDefs());

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 baseVariationValue;
		uint256 slotMultiplier;
		uint256 baseVariationId;
		string memory basePlaceHolders;

		for (uint8 slot = 0; slot <= uint8(_totalBaseIngredients); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			baseVariationValue = _baseVariationHash & bitMask; // Extract slotted value from hash

			if (baseVariationValue > 0) {
				baseVariationId = (slot > 0) // Extract baseIngredient id from slotted value
					? baseVariationValue / slotMultiplier
					: baseVariationValue;

				require(
					baseVariationId > 0 && baseVariationId <= pantry.getCurrentBaseVariationId(),
					'DishesNFT: INVALID_BASE_VARIATION_ID'
				);

				(string memory name, string memory variationSvg) = pantry.baseVariation(baseVariationId);

				// add base variation to defs
				accumulator = RecipeBase.strConcat(accumulator, variationSvg);

				basePlaceHolders = RecipeBase.strConcat(
					basePlaceHolders,
					_getPlaceHolder(name, baseVariationId)
				);
			}
		}
		accumulator = RecipeBase.strConcat(accumulator, '</defs>');
		accumulator = RecipeBase.strConcat(accumulator, basePlaceHolders);

		return accumulator;
	}

	function _getPlaceHolder(string memory name, uint256 variation)
		public
		pure
		returns (string memory)
	{
		return
			string(
				abi.encodePacked(
					'<svg preserveAspectRatio="xMidYMid meet" x="0" y="0" viewBox="0 0 300 300" width="100%"  height="100%"><use href="#',
					name,
					'_',
					RecipeBase.toString(variation),
					'"/></svg>'
				)
			);
	}

	function getDefs() public view returns (string memory defs) {
		for (uint256 i = 1; i <= ingredientNft.getCurrentDefs(); i++) {
			defs = RecipeBase.strConcat(defs, ingredientNft.defs(i));
		}
	}
}
