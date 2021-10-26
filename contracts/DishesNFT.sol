// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './BaseERC721.sol';
import './library/RecipeBase.sol';
import './interfaces/IIngredientNFT.sol';
import './interfaces/IPantry.sol';

contract DishesNFT is BaseERC721 {
	/*
   =======================================================================
   ======================== Structures ===================================
   =======================================================================
 */

	struct Dish {
		address dishOwner;
		bool cooked;
		uint256 dishId;
		uint256 totalIngredients;
		uint256 variationIdHash; // indicates hash of the indexes of ingredient variations
		uint256 totalBaseIngredients;
		uint256 baseVariationHash;
		uint256 flameType;
		uint256 creationTime;
		uint256 completionTime;
	}

	/*
   =======================================================================
   ======================== Constants ====================================
   =======================================================================
 */
	bytes32 public constant OVEN_ROLE = keccak256('OVEN_ROLE');

	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */
	uint256 private nonce;

	IIngredientNFT public ingredientNft;
	IPantry public pantry;

	address[] public exceptedAddresses;

	// dishID => dish
	mapping(uint256 => Dish) public dish;

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
	) public virtual initializer {
		require(_ingredientAddress != address(0), 'DishesNFT: INVALID_INGREDIENT_ADDRESS');
		require(_pantryAddress != address(0), 'DishesNFT: INVALID_PANTRY_ADDRESS');

		__BaseERC721_init(_name, _symbol, baseTokenURI);

		ingredientNft = IIngredientNFT(_ingredientAddress);
		pantry = IPantry(_pantryAddress);
		nonce = 1;
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
	modifier OnlyOven() {
		require(hasRole(OVEN_ROLE, msg.sender), 'DishesNFT: ONLY_OVEN_CAN_CALL');
		_;
	}

	modifier onlyValidDishId(uint256 _dishId) {
		require(_dishId > 0 && _dishId <= getCurrentTokenId(), 'DishesNFT: INVALID_DISH_ID');
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
	 * @param _preparationTime - indicates the preparation time for dish after which dish will be ready use
	 * @param _ingredientIds - indicates the list of ingredients that you want to include in dish
	 * @return dishNFTId - indicates the new dish id
	 */
	function prepareDish(
		address _user,
		uint256 _dishId,
		uint256 _flameId,
		uint256 _preparationTime,
		uint256[] memory _ingredientIds
	) external OnlyOven returns (uint256 dishNFTId) {
		require(_user != address(0), 'DishesNFT: INVALID_USER_ADDRESS');
		require(_dishId > 0 && _dishId <= pantry.getCurrentDishId(), 'Oven: INVALID_DISH_ID');
		require(_ingredientIds.length > 1, 'Oven: INSUFFICIENT_INGREDIENTS');

		(, uint256 totalBaseIngredients) = pantry.dish(_dishId);
		require(totalBaseIngredients > 0, 'Oven: INSUFFICIENT_BASE_INGREDINETS');

		(uint256 ingrediendVariaionHash, uint256 baseVariationHash) = _getHash(
			_dishId,
			totalBaseIngredients,
			_ingredientIds
		);

		// mint dish nft to user
		dishNFTId = mint(_user);

		dish[dishNFTId] = Dish(
			_user,
			true,
			_dishId,
			_ingredientIds.length,
			ingrediendVariaionHash,
			totalBaseIngredients,
			baseVariationHash,
			_flameId,
			block.timestamp,
			block.timestamp + _preparationTime
		);

		nonce++;

		emit DishPrepared(dishNFTId);
	}

	/**
	 * @notice This method alloes chef contract to uncook the dish.
	 * @param _dishId - indicates the dishId to be uncooked.
	 */
	function uncookDish(uint256 _dishId) external OnlyOven onlyValidDishId(_dishId) {
		Dish storage dishToUncook = dish[_dishId];
		require(dishToUncook.cooked, 'DishesNFT: ALREADY_UNCOOKED_DISH');

		// uncook dish
		dishToUncook.cooked = false;

		emit DishUncooked(_dishId);
	}

	/**
	 * @notice This method update the preparation time for given dish. only oven can call this method
	 */
	function updatePrepartionTime(
		uint256 _dishId,
		uint256 _flameId,
		uint256 _preparationTime
	) external OnlyOven {
		// update flame type
		dish[_dishId].flameType = _flameId;
		// update dish preparationTime
		dish[_dishId].completionTime = dish[_dishId].creationTime + _preparationTime;
	}

	/**
	 * @notice This method allows admin to except the addresses to have multiple tokens of same NFT.
	 * @param _account indicates the address to add.
	 */
	function addExceptedAddress(address _account) external virtual onlyAdmin {
		RecipeBase.addAddressInList(exceptedAddresses, _account);
	}

	/**
	 * @notice This method allows admin to remove the excepted addresses from having multiple tokens of same NFT.
	 * @param _account indicates the address to remove.
	 */
	function removeExceptedAddress(address _account) external virtual onlyAdmin {
		RecipeBase.removeAddressFromList(exceptedAddresses, _account);
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

		string memory ingredientPlaceholders;
		string memory defs;
		defs = RecipeBase.strConcat(defs, string('<defs>'));

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 slotMultiplier;
		uint256 variationIdValue;
		uint256 variationId;

		// Iterate Ingredient hash and assemble SVGs
		for (uint8 slot = 0; slot < uint8(dishToServe.totalIngredients); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			variationIdValue = dishToServe.variationIdHash & bitMask;

			if (variationIdValue > 0) {
				variationId = (slot > 0) // Extract IngredientID from slotted value
					? variationIdValue / slotMultiplier
					: variationIdValue;

				require(
					variationId > 0 && variationId <= ingredientNft.getCurrentDefs(),
					'DishesNFT: INVALID_INGREDIENT_VARIATION_INDEX'
				);

				(, , string memory svg) = ingredientNft.defs(variationId);
				defs = RecipeBase.strConcat(defs, svg);

				(uint256 ingredientId, string memory variationName, ) = ingredientNft.defs(variationId);

				(, string memory ingredientName, , ) = ingredientNft.ingredients(ingredientId);

				string memory placeHolder = _getPlaceHolder(ingredientName, variationName);

				ingredientPlaceholders = string(abi.encodePacked(ingredientPlaceholders, placeHolder));
			}
		}

		defs = RecipeBase.strConcat(defs, string('</defs>'));

		// get ingredient variation defs
		accumulator = RecipeBase.strConcat(accumulator, defs);
		// get the placeholders for ingredients
		accumulator = RecipeBase.strConcat(accumulator, ingredientPlaceholders);
		accumulator = RecipeBase.strConcat(accumulator, string('</svg>'));

		return accumulator;
	}

	/*
   =======================================================================
   ======================== Internal Methods =============================
   =======================================================================
 */
	function _prepareDefs(uint256 _totalBaseIngredients, uint256 _baseVariationHash)
		internal
		view
		returns (string memory accumulator)
	{
		//add defs
		accumulator = RecipeBase.strConcat(
			accumulator,
			string('<svg xmlns="http://www.w3.org/2000/svg" width="268.5" height="184.3"><defs>')
		);

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 baseVariationValue;
		uint256 slotMultiplier;
		uint256 baseVariationId;
		string memory basePlaceHolders;

		for (uint8 slot = 0; slot < uint8(_totalBaseIngredients); slot++) {
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

				(uint256 baseId, string memory baseVariationName, string memory variationSvg) = pantry
					.baseVariation(baseVariationId);

				(string memory baseName, ) = pantry.baseIngredient(baseId);

				// add base variation to defs
				accumulator = RecipeBase.strConcat(accumulator, variationSvg);

				basePlaceHolders = RecipeBase.strConcat(
					basePlaceHolders,
					_getPlaceHolder(baseName, baseVariationName)
				);
			}
		}
		accumulator = RecipeBase.strConcat(accumulator, string('</defs>'));
		accumulator = RecipeBase.strConcat(accumulator, basePlaceHolders);

		return accumulator;
	}

	function _getHash(
		uint256 _dishId,
		uint256 _totalBaseIngredients,
		uint256[] memory _ingredientIds
	) internal view returns (uint256 variationIdHash, uint256 baseVariationHash) {
		// get base Variation Hash
		for (uint256 baseIndex = 0; baseIndex < _totalBaseIngredients; baseIndex++) {
			uint256 baseIngredientId = pantry.getBaseIngredientId(_dishId, baseIndex);
			(, uint256 baseVariationCount) = pantry.baseIngredient(baseIngredientId);

			require(baseVariationCount > 0, 'Oven: NO_BASE_VARIATIONS');

			uint256 randomVarionIndex = RecipeBase.getRandomVariation(nonce, baseVariationCount);

			uint256 baseVariationId = pantry.getBaseVariationId(baseIngredientId, randomVarionIndex);

			baseVariationHash += baseVariationId * 256**baseIndex;
		}

		// get variationIdHash
		for (uint256 i = 0; i < _ingredientIds.length; i++) {
			(, , uint256 totalVariations, ) = ingredientNft.ingredients(_ingredientIds[i]);
			require(totalVariations > 0, 'Oven: INSUFFICIENT_INGREDIENT_VARIATIONS');

			// add plus one to avoid the 0 as random variation id
			uint256 variationIndex = RecipeBase.getRandomVariation(nonce, totalVariations);
			uint256 variationId = ingredientNft.getVariationIdByIndex(_ingredientIds[i], variationIndex);

			variationIdHash += variationId * 256**i;
		}
	}

	function _getPlaceHolder(string memory _IngredientName, string memory _variationName)
		public
		pure
		returns (string memory)
	{
		return
			string(
				abi.encodePacked(
					'<svg preserveAspectRatio="xMidYMid meet" x="0" y="0" viewBox="0 0 300 300" width="100%"  height="100%"><use href="#',
					_IngredientName,
					'_',
					_variationName,
					'"/></svg>'
				)
			);
	}

	function _beforeTokenTransfer(
		address from,
		address to,
		uint256 tokenId
	) internal virtual override(BaseERC721) {
		// ensure dish is not transferable
		if (from != address(0) && to != address(0)) {
			(bool isToExcepted, ) = RecipeBase.isAddressExists(exceptedAddresses, to);

			require(isToExcepted, 'DishesNFT: CANNOT_TRANSFER_DISH');
		}

		super._beforeTokenTransfer(from, to, tokenId);
	}

	uint256[50] private __gap;
}
