// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './BaseERC721.sol';
import './library/LaCucinaUtils.sol';
import './interfaces/IIngredientNFT.sol';
import './interfaces/IKitchen.sol';

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
		uint256 multiplier;
	}

	/*
   =======================================================================
   ======================== Constants ====================================
   =======================================================================
 */
	bytes32 public constant OVEN_ROLE = keccak256('OVEN_ROLE');

	/*
   =======================================================================
   ======================== Private Variables ============================
   =======================================================================
 */
	uint256 private nonce;

	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */

	uint256 public min;
	uint256 public max;

	IIngredientNFT public ingredientNft;
	IKitchen public kitchen;

	// dishID => dish
	mapping(uint256 => Dish) public dish;
	// dishID => dishName
	mapping(uint256 => string) public dishNames;
	// userAddress => isExcepted?
	mapping(address => bool) public exceptedAddresses;

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
		address _kitchenAddress
	) public virtual initializer {
		require(_ingredientAddress != address(0), 'DishesNFT: INVALID_INGREDIENT_ADDRESS');
		require(_kitchenAddress != address(0), 'DishesNFT: INVALID_KITCHEN_ADDRESS');

		__BaseERC721_init(_name, _symbol, baseTokenURI);

		ingredientNft = IIngredientNFT(_ingredientAddress);
		kitchen = IKitchen(_kitchenAddress);
		nonce = 1;
		min = 10;
		max = 50;
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
		require(_dishId > 0 && _dishId <= kitchen.getCurrentDishTypeId(), 'DishesNFT: INVALID_DISH_ID');
		require(_ingredientIds.length > 1, 'DishesNFT: INSUFFICIENT_INGREDIENTS');

		(string memory _dishName, uint256 totalBaseIngredients) = kitchen.dishType(_dishId);
		require(totalBaseIngredients > 0, 'DishesNFT: INSUFFICIENT_BASE_INGREDINETS');

		(uint256 ingrediendVariaionHash, uint256 baseVariationHash, uint256 multiplier) = _getHash(
			_dishId,
			totalBaseIngredients,
			_ingredientIds
		);

		string memory dishName = string(
			abi.encodePacked(
				ingredientNft.getIngredientKeyword(_ingredientIds[0], 0), // 1st keyword of 1st ingredient
				' ',
				ingredientNft.getIngredientKeyword(_ingredientIds[1], 1), // 2nd keyword of 2nd ingredient
				' ',
				_dishName
			)
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
			block.timestamp + _preparationTime,
			multiplier
		);

		dishNames[dishNFTId] = dishName;

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
		require(!exceptedAddresses[_account], 'DishesNFT: ALREADY_ADDED');
		exceptedAddresses[_account] = true;
	}

	/**
	 * @notice This method allows admin to remove the excepted addresses from having multiple tokens of same NFT.
	 * @param _account indicates the address to remove.
	 */
	function removeExceptedAddress(address _account) external virtual onlyAdmin {
		require(exceptedAddresses[_account], 'DishesNFT: ALREADY_REMOVED');
		exceptedAddresses[_account] = false;
	}

	/**
	 * @notice This method allows admin to update the min value
	 */
	function updateMin(uint256 _newMin) external virtual onlyAdmin {
		require(_newMin != min, 'DishesNFT: MIN_ALREADY_SET');
		min = _newMin;
	}

	/**
	 * @notice This method allows admin to update the max value
	 */
	function updateMax(uint256 _newMax) external virtual onlyAdmin {
		require(_newMax != max, 'DishesNFT: MAX_ALREADY_SET');
		max = _newMax;
	}

	/*
   	=======================================================================
   	======================== Getter Methods ===============================
   	=======================================================================
 	*/

	/**
	 * @notice This method returns the multiplier for the ingeredient. It calculates the multiplier based on the nutritions hash
	 * @param nutritionsHash - indicates the nutritionHash of ingredient
	 * @return plutamins - indicates the values of plutamin nutrition
	 * @return strongies - indicates the values of strongies nutrition
	 */
	function getMultiplier(uint256 nutritionsHash)
		public
		view
		virtual
		returns (uint256 plutamins, uint256 strongies)
	{
		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 slotMultiplier;
		uint256 nutritionsValue;
		uint256 nutrition;

		// Iterate Ingredient hash and assemble SVGs
		for (uint8 slot = 0; slot < uint8(7); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			nutritionsValue = nutritionsHash & bitMask;

			if (nutritionsValue > 0) {
				nutrition = (slot > 0) // Extract nutrition from slotted value
					? nutritionsValue / slotMultiplier
					: nutritionsValue;

				// store 2nd and last nutrition i.e plutamins and strongies
				if (slot == uint8(1)) {
					plutamins = nutrition;
				}

				if (slot == uint8(6)) {
					strongies = nutrition;
				}
			}
		}
	}

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
		uint256 slotMultiplier;
		uint256 variationIdValue;
		uint256 variationId;

		uint256[] memory variationIdList = new uint256[](dishToServe.totalIngredients);
		string[] memory defs = new string[](dishToServe.totalIngredients);

		// Iterate Ingredient hash and assemble SVGs
		for (uint8 slot = 0; slot < uint8(dishToServe.totalIngredients); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			variationIdValue = dishToServe.variationIdHash & bitMask;

			if (variationIdValue > 0) {
				variationId = (slot > 0) // Extract Ingredient variation ID from slotted value
					? variationIdValue / slotMultiplier
					: variationIdValue;

				require(
					variationId > 0 && variationId <= ingredientNft.getCurrentDefs(),
					'DishesNFT: INVALID_INGREDIENT_VARIATION_INDEX'
				);

				(, , string memory svg) = ingredientNft.defs(variationId);

				variationIdList[slot] = variationId;
				defs[slot] = svg;
			}
		}

		// get the placeholders for ingredients
		accumulator = LaCucinaUtils.strConcat(
			accumulator,
			_getPlaceHolder(dishToServe.dishId, variationIdList, defs)
		);
		accumulator = LaCucinaUtils.strConcat(accumulator, string('</svg>'));

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
		// add defs
		accumulator = LaCucinaUtils.strConcat(
			accumulator,
			string('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">')
		);

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 baseVariationValue;
		uint256 slotMultiplier;
		uint256 baseVariationId;

		for (uint8 slot = 0; slot < uint8(_totalBaseIngredients); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			baseVariationValue = _baseVariationHash & bitMask; // Extract slotted value from hash

			if (baseVariationValue > 0) {
				baseVariationId = (slot > 0) // Extract baseIngredient id from slotted value
					? baseVariationValue / slotMultiplier
					: baseVariationValue;

				require(
					baseVariationId > 0 && baseVariationId <= kitchen.getCurrentBaseVariationId(),
					'DishesNFT: INVALID_BASE_VARIATION_ID'
				);

				(, , string memory variationSvg) = kitchen.baseVariation(baseVariationId);

				// add base variation to defs
				accumulator = LaCucinaUtils.strConcat(accumulator, variationSvg);
			}
		}

		return accumulator;
	}

	function _getHash(
		uint256 _dishId,
		uint256 _totalBaseIngredients,
		uint256[] memory _ingredientIds
	)
		internal
		returns (
			uint256 variationIdHash,
			uint256 baseVariationHash,
			uint256 mScaled
		)
	{
		uint256 totalIngredients = _ingredientIds.length;
		uint256 plutamins;
		uint256 strongies;

		// get base Variation Hash
		for (uint256 baseIndex = 0; baseIndex < _totalBaseIngredients; baseIndex++) {
			uint256 baseIngredientId = kitchen.getBaseIngredientId(_dishId, baseIndex);
			(, uint256 baseVariationCount) = kitchen.baseIngredient(baseIngredientId);

			require(baseVariationCount > 0, 'DishesNFT: NO_BASE_VARIATIONS');

			uint256 randomVarionIndex = LaCucinaUtils.getRandomVariation(nonce, baseVariationCount);

			uint256 baseVariationId = kitchen.getBaseVariationId(baseIngredientId, randomVarionIndex);

			baseVariationHash += baseVariationId * 256**baseIndex;
			nonce++;
		}
		// get variationIdHash
		for (uint256 i = 0; i < totalIngredients; i++) {
			(, , uint256 totalVariations, uint256 nutritionsHash) = ingredientNft.ingredients(
				_ingredientIds[i]
			);

			require(totalVariations > 0, 'DishesNFT: INSUFFICIENT_INGREDIENT_VARIATIONS');

			// add plus one to avoid the 0 as random variation id
			uint256 variationIndex = LaCucinaUtils.getRandomVariation(nonce, totalVariations);

			uint256 variationId = ingredientNft.getVariationIdByIndex(_ingredientIds[i], variationIndex);

			(uint256 plutamin, uint256 strongie) = getMultiplier(nutritionsHash);

			if (i == 0) {
				plutamins = plutamin;
				strongies = strongie;
			} else {
				plutamins *= plutamin;
				strongies += strongie;
			}

			variationIdHash += variationId * 256**i;
			nonce++;
		}

		uint256 multiplier;
		if (strongies != 0) multiplier = plutamins / strongies;

		// normalize multiplier
		mScaled = 1 + (9 * (multiplier - min)) / (max - min);
	}

	function _getPlaceHolder(
		uint256 dishTypeId,
		uint256[] memory variationIdList,
		string[] memory defs
	) public view returns (string memory ingredientPlaceholders) {
		uint256 ingredientId;
		uint256 defId;

		for (uint256 position = 0; position < kitchen.totalCoordinates(); position++) {
			(uint256 _ingredientId, , ) = ingredientNft.defs(
				variationIdList[position % variationIdList.length]
			);
			ingredientId = _ingredientId;
			defId = position % variationIdList.length;

			uint256 x = kitchen.getXCoordinateAtIndex(dishTypeId, position);
			uint256 y = kitchen.getYCoordinateAtIndex(dishTypeId, position);
			string memory placeHolder = string(
				abi.encodePacked(
					'<svg xmlns="http://www.w3.org/2000/svg" x="',
					LaCucinaUtils.toString(x),
					'" y="',
					LaCucinaUtils.toString(y),
					'" width="50" height="50" xml:space="preserve">'
				)
			);
			placeHolder = string(abi.encodePacked(placeHolder, defs[defId]));
			placeHolder = string(abi.encodePacked(placeHolder, '</svg>'));
			ingredientPlaceholders = string(abi.encodePacked(ingredientPlaceholders, placeHolder));
		}
	}

	function _beforeTokenTransfer(
		address from,
		address to,
		uint256 tokenId
	) internal virtual override(BaseERC721) {
		// ensure dish is not transferable
		if (from != address(0) && to != address(0)) {
			require(exceptedAddresses[to], 'DishesNFT: CANNOT_TRANSFER_DISH');
		}

		super._beforeTokenTransfer(from, to, tokenId);
	}

	uint256[50] private __gap;
}
