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

	// ingredientId => ipfs hash details
	mapping(uint256 => string) public ipfsHash;

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
	 *  @param _ipfsHash - indicates the ipfs hash for the ingredient
	 *  @return ingredientId - new ingredient id
	 */
	function addIngredient(
		string memory _name,
		uint256 _nutritionsHash,
		string memory _ipfsHash
	) external virtual onlyAdmin returns (uint256 ingredientId) {
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_INGREDIENT_NAME');
		require(bytes(_ipfsHash).length > 0, 'IngredientNFT: INVALID_IPFS_HASH');

		// generate ingredient Id
		tokenCounter.increment();
		ingredientId = tokenCounter.current();
		uint256[] memory defIds;

		// store ingredient details
		ingredients[ingredientId] = Ingredient(ingredientId, _name, 0, _nutritionsHash, defIds);
		ipfsHash[ingredientId] = _ipfsHash;

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
	) external virtual onlyAdmin onlyValidNftId(_ingredientId) returns (uint256 defsId) {
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
		virtual
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
	 *	@param _name - indicates the name of the ingredient
	 *	@param _svg - indicates the svg of the ingredient
	 */
	function updateIngredientVariation(
		uint256 _defId,
		string memory _name,
		string memory _svg
	) external virtual onlyAdmin onlyValidDefId(_defId) {
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_NAME');
		require(bytes(_svg).length > 0, 'IngredientNFT: INVALID_SVG');

		Defs storage ingrediendVariaion = defs[_defId];

		ingrediendVariaion.name = _name;
		ingrediendVariaion.svg = _svg;

		emit IngredientVariationUpdated(_defId);
	}

	/**
	 *	@notice This method allows admin to update the ingredient name.
	 *	@param _tokenId - indicates the token id of ingredient
	 *  @param _ipfsHash - indicates the new ipfs hash
	 */
	function updateIpfsHash(uint256 _tokenId, string memory _ipfsHash)
		external
		virtual
		onlyAdmin
		onlyValidNftId(_tokenId)
	{
		require(bytes(_ipfsHash).length > 0, 'IngredientNFT: INVALID_IPFS_HASH');

		ipfsHash[_tokenId] = _ipfsHash;
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
	 * @notice This method allows us to get the ingredient variation id from the list of variations.
	 * @param _ingredientId - indicates ingredient id
	 * @param _index - indicates the variation index
	 */
	function getVariationIdByIndex(uint256 _ingredientId, uint256 _index)
		external
		view
		virtual
		onlyValidNftId(_ingredientId)
		returns (uint256 _defId)
	{
		Ingredient memory ingredient = ingredients[_ingredientId];

		require(ingredient.totalVariations > 0, 'IngredientsNFT: INSUFFICIENT_VARIATIONS');
		require(_index < ingredient.totalVariations, 'IngredientsNFT: INVALID_INDEX');

		return ingredient.defIds[_index];
	}

	/**
	 * @notice This method returns the token uri based on the chain id
	 * @param _tokenId - indicates the token id
	 */
	function getTokenUri(uint256 _tokenId) public view virtual returns (string memory tokenUri) {
		tokenUri = string(
			abi.encodePacked(
				uri(_tokenId),
				ipfsHash[_tokenId],
				'.ipfs.infura-ipfs.io/lacucina_secret_ingredients/',
				RecipeBase.toString(block.chainid),
				'/',
				RecipeBase.toString(_tokenId)
			)
		);
	}

	/**
    @notice This method returns the current base ingredient Id
    */
	function getCurrentDefs() external view virtual returns (uint256) {
		return defsCounter.current();
	}

	/**
	 * @notice This method tells whether the given address is allowed to hold multiple nfts or not.
	 */
	function isExceptedAddress(address _account) external view virtual returns (bool) {
		(bool isExcepted, ) = RecipeBase.isAddressExists(exceptedAddresses, _account);
		return isExcepted;
	}

	/**
	 * @notice This method tells whether the given address is allowed to hold multiple nfts from excepted address or not.
	 */
	function isExceptedFromAddress(address _account) external view virtual returns (bool) {
		(bool isExcepted, ) = RecipeBase.isAddressExists(exceptedFromAddresses, _account);
		return isExcepted;
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
