// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './BaseERC1155.sol';
import './library/RecipeBase.sol';

contract IngredientsNFT is BaseERC1155 {
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

	function initialize(string memory uri) public virtual initializer {
		__BaseERC1155_init(uri);
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
   ======================== Public Methods ===============================
   =======================================================================
 */

	/**
	 *  @notice This method allows admin to add the ingredient details for preparing a dish.
	 *  @param _name - indicates the name of the ingredient
	 *  @return ingredientId - new ingredient id
	 */
	function addIngredient(string memory _name) external onlyAdmin returns (uint256 ingredientId) {
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_INGREDIENT_NAME');

		// generate ingredient Id
		tokenCounter.increment();
		ingredientId = tokenCounter.current();
		uint256[] memory defIds;

		// store ingredient details
		ingredients[ingredientId] = Ingredient(ingredientId, _name, 0, defIds);

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
		onlyValidNftId(_defId)
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
