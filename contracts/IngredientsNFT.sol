// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './library/RecipeBase.sol';
import './BaseERC1155WithRoyalties.sol';

contract IngredientsNFT is BaseERC1155WithRoyalties {
	using Counters for Counters.Counter;

	/*
   =======================================================================
   ======================== Structures ===================================
   =======================================================================
 */
	struct Defs {
		uint256 ingredientId;
		string name;
		string svg;
	}

	struct Ingredient {
		uint256 id;
		string name;
		uint256 totalVariations;
		uint256 nutritionsHash;
		uint256[] defIds;
	}

	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */

	address[] public exceptedAddresses;
	address[] public exceptedFromAddresses;

	// ingredientId => Ingredient details
	mapping(uint256 => Ingredient) public ingredients;

	//defId => Defs details
	mapping(uint256 => Defs) public defs;

	/*
   =======================================================================
   ======================== Private Variables ============================
   =======================================================================
 */
	Counters.Counter private defsCounter;

	/*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

	function initialize(
		string memory _baseTokenURI,
		address _royaltyReceiver,
		uint8 _royaltyFee
	) public virtual initializer {
		initialize_BaseERC1155WithRoyalties(_baseTokenURI, _royaltyReceiver, _royaltyFee);
	}

	/*
   =======================================================================
   ======================== Events =======================================
   =======================================================================
 */
	event IngredientAdded(uint256 ingredientId);
	event IngredientVariationAdded(uint256 ingredientId, uint256 variationId);
	event IngredientUpdated(uint256 ingredientId);
	event IngredientVariationUpdated(uint256 defId);

	/*
   =======================================================================
   ======================== Modifiers ====================================
   =======================================================================
 */
	modifier onlyValidDefId(uint256 _defId) {
		require(_defId > 0 && _defId <= defsCounter.current(), 'IngredientsNFT: INVALID_DEF_ID');
		_;
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */

	/**
	 *  @notice This method allows admin to add the ingredient details for preparing a dish.
	 *  @param _name - indicates the name of the ingredient
	 *  @param _nutritionsHash - indicates the nutritions
	 *  @return ingredientId - new ingredient id
	 */
	function addIngredient(string memory _name, uint256 _nutritionsHash)
		external
		onlyAdmin
		returns (uint256 ingredientId)
	{
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_INGREDIENT_NAME');

		// generate ingredient Id
		tokenCounter.increment();
		ingredientId = tokenCounter.current();
		uint256[] memory defIds;

		// store ingredient details
		ingredients[ingredientId] = Ingredient(ingredientId, _name, 0, _nutritionsHash, defIds);

		emit IngredientAdded(ingredientId);
	}

	/**
	 * @notice This method allows admin to add the ingredient` variation.
	 * @param _ingredientId - indicates the id of the ingredient
	 * @param _name - indicates the name for ingredient variation
	 * @param _svg - indicates the svg for ingredient variation
	 * @return defsId - indicates the defId of the variation
	 */
	function addIngredientVariation(
		uint256 _ingredientId,
		string memory _name,
		string memory _svg
	) external onlyAdmin onlyValidNftId(_ingredientId) returns (uint256 defsId) {
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_NAME');
		require(bytes(_svg).length > 0, 'IngredientNFT: INVALID_SVG');

		// increment defs counter
		defsCounter.increment();

		defsId = defsCounter.current();
		defs[defsId] = Defs(_ingredientId, _name, _svg);

		// increse total variations
		ingredients[_ingredientId].totalVariations += 1;
		ingredients[_ingredientId].defIds.push(defsId);

		emit IngredientVariationAdded(_ingredientId, defsId);
	}

	/**
	 *	@notice This method allows admin to update the ingredient name.
	 *	@param _tokenId - indicates the token id of ingredient
	 *  @param _name - indicates the new name of the ingredient
	 */
	function updateIngredientName(uint256 _tokenId, string memory _name)
		external
		onlyAdmin
		onlyValidNftId(_tokenId)
	{
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_INGREDIENT_NAME');

		ingredients[_tokenId].name = _name;
		emit IngredientUpdated(_tokenId);
	}

	/**
	 *	@notice This method allows admin to update the ingredient svg only if no ingredients have minted.
	 *	@param _defId - indicates the def id of ingredient variation
	 *	@param _svg - indicates the svg of the ingredient
	 */
	function updateIngredientSvg(uint256 _defId, string memory _svg)
		external
		onlyAdmin
		onlyValidDefId(_defId)
	{
		require(_defId > 0, 'IngredientNFT: INVALID_DEF_ID');
		require(bytes(_svg).length > 0, 'IngredientNFT: INVALID_SVG');

		Defs storage ingrediendVariaion = defs[_defId];
		require(totalSupply(ingrediendVariaion.ingredientId) == 0, 'IngredientNFT: CANNOT_UPDATE_SVG');

		ingrediendVariaion.svg = _svg;
		emit IngredientVariationUpdated(_defId);
	}

	/**
	 * @notice This method allows admin to except the addresses to have multiple tokens of same NFT.
	 * @param _account indicates the address to add.
	 */
	function addExceptedAddress(address _account) external virtual onlyAdmin {
		RecipeBase.addAddressInList(exceptedAddresses, _account);
	}

	/**
	 * @notice This method allows admin to except the from addresses so that user can receive the multiple same nft tokens.
	 * @param _account indicates the address to add.
	 */
	function addExceptedFromAddress(address _account) external virtual onlyAdmin {
		RecipeBase.addAddressInList(exceptedFromAddresses, _account);
	}

	/**
	 * @notice This method allows admin to remove the excepted addresses from having multiple tokens of same NFT.
	 * @param _account indicates the address to remove.
	 */
	function removeExceptedAddress(address _account) external virtual onlyAdmin {
		RecipeBase.removeAddressFromList(exceptedAddresses, _account);
	}

	/**
	 * @notice This method allows admin to remove the excepted addresses .
	 * @param _account indicates the address to remove.
	 */
	function removeExceptedFromAddress(address _account) external virtual onlyAdmin {
		RecipeBase.removeAddressFromList(exceptedFromAddresses, _account);
	}

	/*
   =======================================================================
   ======================== Getter Methods ===============================
   =======================================================================
 */
 
	/**
	 * @notice This method returns the multiplier for the ingeredient. It calculates the multiplier based on the nutritions hash
	 * @param _ingredientId - indicates the ingredient id
	 * @return multiplier - indicates the multiplier calculated using nutritions
	 */
	function getMultiplier(uint256 _ingredientId)
		public
		view
		onlyValidNftId(_ingredientId)
		returns (uint256 multiplier)
	{
		uint256 nutritionsHash = ingredients[_ingredientId].nutritionsHash;

		uint256[] memory nutritionsList = new uint256[](8);

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 slotMultiplier;
		uint256 nutritionsValue;
		uint256 nutrition;

		// Iterate Ingredient hash and assemble SVGs
		for (uint8 slot = 0; slot < uint8(8); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			nutritionsValue = nutritionsHash & bitMask;

			if (nutritionsValue > 0) {
				nutrition = (slot > 0) // Extract nutrition from slotted value
					? nutritionsValue / slotMultiplier
					: nutritionsValue;

				// store nutrition
				nutritionsList[slot] = nutrition;
			}
		}

		// multiply first two nutritions
		multiplier = nutritionsList[0] * nutritionsList[1];

		// divide multiplier by next two nutritions
		multiplier /= nutritionsList[2] * nutritionsList[3];
	}

	function getVariationIdByIndex(uint256 _ingredientId, uint256 _index)
		external
		view
		onlyValidNftId(_ingredientId)
		returns (uint256 _defId)
	{
		Ingredient memory ingredient = ingredients[_ingredientId];

		require(ingredient.totalVariations > 0, 'IngredientsNFT: INSUFFICIENT_VARIATIONS');
		require(_index < ingredient.totalVariations, 'IngredientsNFT: INVALID_INDEX');

		return ingredient.defIds[_index];
	}

	/**
    @notice This method returns the current base ingredient Id
    */
	function getCurrentDefs() external view returns (uint256) {
		return defsCounter.current();
	}

	/*
   =======================================================================
   ======================== Internal Methods =============================
   =======================================================================
 */
	/**
	 * @dev See {IERC165-_beforeTokenTransfer}.
	 */
	function _beforeTokenTransfer(
		address operator,
		address from,
		address to,
		uint256[] memory ids,
		uint256[] memory amounts,
		bytes memory data
	) internal virtual override(BaseERC1155) {
		(bool isExceptedFrom, ) = RecipeBase.isAddressExists(exceptedFromAddresses, from);
		(bool isExcepted, ) = RecipeBase.isAddressExists(exceptedAddresses, to);

		if (!isExcepted && to != address(0)) {
			if (!isExceptedFrom) {
				for (uint256 i = 0; i < ids.length; i++) {
					require(balanceOf(to, ids[i]) == 0, 'ERC1155NFT: TOKEN_ALREADY_EXIST');
				}
			}

			for (uint256 i = 0; i < amounts.length; i++) {
				require(amounts[i] == 1, 'ERC1155NFT: USER_CAN_TRANSFER_ONLY_ONE_TOKEN');
			}
		}
		super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
	}

	uint256[50] private __gap;
}
