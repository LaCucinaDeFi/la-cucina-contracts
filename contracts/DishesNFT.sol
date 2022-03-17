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
		bool cooked;
		uint256 dishId;
		uint256 totalIngredients;
		uint256 variationIdHash; // indicates hash of the indexes of ingredient variations
		uint256 totalBaseIngredients;
		uint256 baseVariationHash;
		uint256 flameType;
		uint256 creationTime;
		uint256 completionTime;
		int256 multiplier;
	}

	/*
   =======================================================================
   ======================== Constants ====================================
   =======================================================================
 */
	bytes32 public constant COOKER_ROLE = keccak256('COOKER_ROLE');

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

	int256 public min;
	int256 public max;

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
		min = -2638;
		max = 74531;
	}

	/*
   	=======================================================================
   	======================== Events =======================================
   	=======================================================================
 	*/
	event Cook(uint256 dishId);
	event Uncook(uint256 dishId);

	/*
   	=======================================================================
   	======================== Modifiers ====================================
   	=======================================================================
 	*/
	modifier OnlyCooker() {
		require(hasRole(COOKER_ROLE, msg.sender), 'DishesNFT: ONLY_COOKER_CAN_CALL');
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
	function cookDish(
		address _user,
		uint256 _dishId,
		uint256 _flameId,
		uint256 _preparationTime,
		uint256[] memory _ingredientIds
	) external virtual OnlyCooker returns (uint256 dishNFTId) {
		require(_user != address(0), 'DishesNFT: INVALID_USER_ADDRESS');
		require(_ingredientIds.length > 1, 'DishesNFT: INSUFFICIENT_INGREDIENTS');

		(uint256 baseVariationHash, string memory _dishTypeName, uint256 totalBaseIngredients) = kitchen
			.getBaseVariationHash(_dishId, nonce);

		nonce++;

		(
			uint256 ingredientVariaionHash,
			string memory dishName,
			uint256 plutamins,
			uint256 strongies
		) = ingredientNft.getIngredientHash(_ingredientIds, _dishTypeName, nonce);

		int256 multiplier = _getHash(plutamins, strongies, _ingredientIds.length);

		// mint dish nft to user
		dishNFTId = mint(_user);

		dish[dishNFTId] = Dish(
			true,
			_dishId,
			_ingredientIds.length,
			ingredientVariaionHash,
			totalBaseIngredients,
			baseVariationHash,
			_flameId,
			block.timestamp,
			block.timestamp + _preparationTime,
			multiplier
		);

		dishNames[dishNFTId] = dishName;
		nonce++;

		emit Cook(dishNFTId);
	}

	/**
	 * @notice This method alloes chef contract to uncook the dish.
	 * @param _dishId - indicates the dishId to be uncooked.
	 */
	function uncookDish(uint256 _dishId) external virtual OnlyCooker onlyValidDishId(_dishId) {
		Dish storage dishToUncook = dish[_dishId];
		require(dishToUncook.cooked, 'DishesNFT: ALREADY_UNCOOKED_DISH');

		// uncook dish
		dishToUncook.cooked = false;

		emit Uncook(_dishId);
	}

	/**
	 * @notice This method update the preparation time for given dish. only cooker can call this method
	 */
	function updatePreparationTime(
		uint256 _dishId,
		uint256 _flameId,
		uint256 _preparationTime
	) external virtual OnlyCooker {
		// update flame type
		dish[_dishId].flameType = _flameId;
		// update dish preparationTime
		dish[_dishId].completionTime = dish[_dishId].creationTime + _preparationTime;
	}

	/**
	 * @notice This method allows admin to except the addresses to have multiple tokens of same NFT.
	 * @param _account indicates the address to add.
	 */
	function addExceptedAddress(address _account) external virtual onlyOperator {
		require(!exceptedAddresses[_account], 'DishesNFT: ALREADY_ADDED');
		exceptedAddresses[_account] = true;
	}

	/**
	 * @notice This method allows admin to remove the excepted addresses from having multiple tokens of same NFT.
	 * @param _account indicates the address to remove.
	 */
	function removeExceptedAddress(address _account) external virtual onlyOperator {
		require(exceptedAddresses[_account], 'DishesNFT: ALREADY_REMOVED');
		exceptedAddresses[_account] = false;
	}

	/**
	 * @notice This method allows admin to update the min value
	 * @param _newMin - new min value. it MUST be multiplied with 10000
	 */
	function updateMin(int256 _newMin) external virtual onlyOperator {
		require(_newMin != min, 'DishesNFT: MIN_ALREADY_SET');
		min = _newMin;
	}

	/**
	 * @notice This method allows admin to update the max value
	 * @param _newMax - new max value. it MUST be multiplied with 10000
	 */
	function updateMax(int256 _newMax) external virtual onlyOperator {
		require(_newMax != max, 'DishesNFT: MAX_ALREADY_SET');
		max = _newMax;
	}

	function updateDishThreshold(uint256 _newThreshold) external virtual onlyOperator {
		require(_newThreshold != dishIdThreshold, 'DishesNFT: ALREADY_SET');
		dishIdThreshold = _newThreshold;
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
		virtual
		onlyValidDishId(_dishId)
		returns (string memory accumulator)
	{
		Dish memory dishToServe = dish[_dishId];
		require(dishToServe.cooked, 'DishesNFT: CANNOT_SERVE_UNCOOKED_DISH');

		accumulator = _prepareDefs(dishToServe.totalBaseIngredients, dishToServe.baseVariationHash);

		string memory svg;

		if (_dishId < dishIdThreshold) {
			svg = _serveDish256(dishToServe, accumulator);
		} else {
			svg = _serveDish1M(dishToServe, accumulator);
		}

		accumulator = LaCucinaUtils.strConcat(accumulator, svg);

		return accumulator;
	}

	/*
   	=======================================================================
   	======================== Internal Methods =============================
   	=======================================================================
	*/

	function _serveDish256(Dish memory dishToServe, string memory accumulator)
		internal
		view
		returns (string memory IngredientsSvg)
	{
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
		IngredientsSvg = LaCucinaUtils.strConcat(accumulator, string('</svg>'));
	}

	function _serveDish1M(Dish memory dishToServe, string memory accumulator)
		internal
		view
		returns (string memory IngredientsSvg)
	{
		uint256 slotConst = 1000000;
		uint256 slotMultiplier;
		uint256 variationIdHash = dishToServe.variationIdHash;
		uint256 variationId;

		uint256[] memory variationIdList = new uint256[](dishToServe.totalIngredients);
		string[] memory defs = new string[](dishToServe.totalIngredients);

		for (uint8 slot = uint8(dishToServe.totalIngredients); slot > uint8(0); slot--) {
			slotMultiplier = uint256(slotConst**(slot - 1)); // Create slot multiplier
			variationId = (slot > 0) // Extract variation from slotted value
				? variationIdHash / slotMultiplier
				: variationIdHash;

			require(
				variationId > 0 && variationId <= ingredientNft.getCurrentDefs(),
				'DishesNFT: INVALID_INGREDIENT_VARIATION_INDEX'
			);

			(, , string memory svg) = ingredientNft.defs(variationId);

			variationIdList[slot - 1] = variationId;
			defs[slot - 1] = svg;

			variationIdHash -= variationId * slotMultiplier;
		}

		// get the placeholders for ingredients
		accumulator = LaCucinaUtils.strConcat(
			accumulator,
			_getPlaceHolder(dishToServe.dishId, variationIdList, defs)
		);

		IngredientsSvg = LaCucinaUtils.strConcat(accumulator, string('</svg>'));
	}

	function _prepareDefs(uint256 _totalBaseIngredients, uint256 _baseVariationHash)
		internal
		view
		returns (string memory accumulator)
	{
		// add defs
		accumulator = LaCucinaUtils.strConcat(
			accumulator,
			string('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">')
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

	/**
	 * @notice This method returns the normalized multiplier for the dish
	 */
	function _getHash(
		uint256 plutamins,
		uint256 strongies,
		uint256 totalIngredients
	) internal view returns (int256 mScaled) {
		int256 multiplier;
		if (strongies != 0) multiplier = 1 ether * (int256(plutamins) / int256(strongies));
		// 10000 ---> Decimal Fixer
		int256 scaledMax = max * 1 ether * int256(10000)**(totalIngredients - 2);
		int256 scaledMin = min * 1 ether * int256(10000)**(totalIngredients - 2);
		if (multiplier > scaledMax) multiplier = scaledMax;
		if (multiplier < scaledMin) multiplier = scaledMin;

		int256 multiplier_minus_min = multiplier - (scaledMin);
		int256 dived_by_diff = multiplier_minus_min / (max - min);
		int256 mutliply_by_nine = 9 * dived_by_diff;
		int256 add_to_one = (1 * int256(10000)**(totalIngredients - 2) * 1 ether) + mutliply_by_nine;
		// will always return value which needs to be devided by 10e18 (decimals of 1 ether)
		// 1 + 9 * (multiplier - min / max - min)
		mScaled = add_to_one / int256(10000)**(totalIngredients - 2);
	}

	/**
	 * @notice This method returns the placeholders for the ingredients
	 */
	function _getPlaceHolder(
		uint256 dishTypeId,
		uint256[] memory variationIdList,
		string[] memory defs
	) internal view returns (string memory ingredientPlaceholders) {
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

	uint256 public dishIdThreshold;
}
