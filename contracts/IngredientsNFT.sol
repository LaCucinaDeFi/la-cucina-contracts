// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './library/LaCucinaUtils.sol';
import './BaseERC1155WithRoyalties.sol';

contract IngredientsNFT is BaseERC1155WithRoyalties {
	using CountersUpgradeable for CountersUpgradeable.Counter;

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
		string[] keywords;
	}

	/*
   	=======================================================================
   	======================== Public Variables ============================
   	=======================================================================
 	*/

	// ingredientId => Ingredient details
	mapping(uint256 => Ingredient) public ingredients;

	// ingredientId => ipfs hash details
	mapping(uint256 => string) public ipfsHash;

	// defId => Defs details
	mapping(uint256 => Defs) public defs;

	// userAddress => isExcepted?
	mapping(address => bool) public exceptedAddresses;
	// userAddress => isExceptedFrom?
	mapping(address => bool) public exceptedFromAddresses;

	/*
   	=======================================================================
   	======================== Private Variables ============================
   	=======================================================================
 	*/
	CountersUpgradeable.Counter private defsCounter;

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
	 * 	@param _user - indicates the  user address to which the ingredients will be minted
	 *  @param _amount - indicates the amount of ingredients to mint
	 *  @param _name - indicates the name of the ingredient
	 *  @param _nutritionsHash - indicates the nutritions
	 *  @param _ipfsHash - indicates the ipfs hash for the ingredient
	 * 	@param _keywords - indicates the list of keywords for the dish name
	 *  @return ingredientId - new ingredient id
	 */
	function addIngredient(
		address _user,
		uint256 _amount,
		string memory _name,
		uint256 _nutritionsHash,
		string memory _ipfsHash,
		string[] memory _keywords
	) external virtual returns (uint256 ingredientId) {
		ingredientId = _addIngredient(_name, _nutritionsHash, _ipfsHash, _keywords, _amount, _user);
	}

	/**
	 *  @notice This method allows admin to add the ingredient details for preparing a dish.
	 * 	@param _user - indicates the  user address to which the ingredients will be minted
	 *  @param _amount - indicates the amount of ingredients to mint
	 *  @param _name - indicates the name of the ingredient
	 *  @param _nutritionsHash - indicates the nutritions
	 *  @param _ipfsHash - indicates the ipfs hash for the ingredient
	 * 	@param _keywords - indicates the list of keywords for the dish name
	 *  @param _svgs - indicates the different variation svgs of ingredients
	 *  @param _variationNames - indicates the list of names of variations
	 *  @return ingredientId - new ingredient id
	 */
	function addIngredientWithVariations(
		address _user,
		uint256 _amount,
		string memory _name,
		uint256 _nutritionsHash,
		string memory _ipfsHash,
		string[] memory _keywords,
		string[] memory _svgs,
		string[] memory _variationNames
	) external virtual returns (uint256 ingredientId) {
		uint256 totalVariations = _svgs.length;
		require(_svgs.length > 0, 'IngredientsNFT: INSUFFICIENT_VARIATIONS');
		require(_svgs.length == _variationNames.length, 'IngredientsNFT: INSUFFICIENT_VARIATION_NAMES');

		ingredientId = _addIngredient(_name, _nutritionsHash, _ipfsHash, _keywords, _amount, _user);

		// add variations
		for (uint256 i = 0; i < totalVariations; i++) {
			_addVariation(ingredientId, _variationNames[i], _svgs[i]);
		}
		// set total variations
		ingredients[ingredientId].totalVariations = totalVariations;
	}

	/**
	 * @notice This method allows admin to add the ingredient` variation.
	 * @param _ingredientId - indicates the id of the ingredient
	 * @param _name - indicates the name for ingredient variation
	 * @param _svg - indicates the svg for ingredient variation
	 * @return defsId - indicates the defId of the variation
	 */
	function addVariation(
		uint256 _ingredientId,
		string memory _name,
		string memory _svg
	) external virtual onlyOperator onlyValidNftId(_ingredientId) returns (uint256 defsId) {
		defsId = _addVariation(_ingredientId, _name, _svg);
		// increse total variations
		ingredients[_ingredientId].totalVariations += 1;
	}

	/**
	 *	@notice This method allows admin to update the ingredient name.
	 *	@param _tokenId - indicates the token id of ingredient
	 *  @param _name - indicates the new name of the ingredient
	 */
	function updateIngredientName(uint256 _tokenId, string memory _name)
		external
		virtual
		onlyOperator
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
	) external virtual onlyOperator onlyValidDefId(_defId) {
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
		onlyOperator
		onlyValidNftId(_tokenId)
	{
		require(bytes(_ipfsHash).length > 0, 'IngredientNFT: INVALID_IPFS_HASH');

		ipfsHash[_tokenId] = _ipfsHash;
	}

	/**
	 * @notice This method allows admin to except the addresses to have multiple tokens of same NFT.
	 * @param _account indicates the address to add.
	 */
	function addExceptedAddress(address _account) external virtual onlyOperator {
		require(!exceptedAddresses[_account], 'IngredientNFT: ALREADY_ADDED');
		exceptedAddresses[_account] = true;
	}

	/**
	 * @notice This method allows admin to remove the excepted addresses from having multiple tokens of same NFT.
	 * @param _account indicates the address to remove.
	 */
	function removeExceptedAddress(address _account) external virtual onlyOperator {
		require(exceptedAddresses[_account], 'IngredientNFT: ALREADY_REMOVED');
		exceptedAddresses[_account] = false;
	}

	/**
	 * @notice This method allows admin to except the from addresses so that user can receive the multiple same nft tokens.
	 * @param _account indicates the address to add.
	 */
	function addExceptedFromAddress(address _account) external virtual onlyOperator {
		require(!exceptedFromAddresses[_account], 'IngredientNFT: ALREADY_ADDED');
		exceptedFromAddresses[_account] = true;
	}

	/**
	 * @notice This method allows admin to remove the excepted addresses .
	 * @param _account indicates the address to remove.
	 */
	function removeExceptedFromAddress(address _account) external virtual onlyOperator {
		require(exceptedFromAddresses[_account], 'IngredientNFT: ALREADY_REMOVED');
		exceptedFromAddresses[_account] = false;
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
	function uri(uint256 _tokenId) public view virtual override returns (string memory tokenUri) {
		tokenUri = string(abi.encodePacked('https://ipfs.infura.io/ipfs/', ipfsHash[_tokenId]));
	}

	/**
	 * @notice This method allows us to create the nutritionsHash
	 */
	function getNutritionHash(uint256[] memory _nutritions)
		external
		pure
		returns (uint256 nutrionHash)
	{
		for (uint256 i = 0; i < _nutritions.length; i++) {
			nutrionHash += _nutritions[i] * 100000**i;
		}
	}

	/**
    @notice This method returns the current base ingredient Id
    */
	function getCurrentDefs() external view virtual returns (uint256) {
		return defsCounter.current();
	}

	/**
	 * @notice This method allows us to get the ingredient keyword with the index
	 * @param _ingredientId - ingredient id
	 * @param _index - index of the keyword
	 * @return keyword from the keyword list
	 */
	function getIngredientKeyword(uint256 _ingredientId, uint256 _index)
		external
		view
		virtual
		onlyValidNftId(_ingredientId)
		returns (string memory)
	{
		Ingredient memory ingredient = ingredients[_ingredientId];
		require(_index < ingredient.keywords.length, 'IngredientsNFT: INVALID_INDEX');
		return ingredient.keywords[_index];
	}

	/*
   	=======================================================================
   	======================== Internal Methods =============================
   	=======================================================================
 	*/

	function _addIngredient(
		string memory _name,
		uint256 _nutritionsHash,
		string memory _ipfsHash,
		string[] memory _keywords,
		uint256 _amount,
		address _user
	) internal virtual onlyMinter returns (uint256 ingredientId) {
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_INGREDIENT_NAME');
		require(bytes(_ipfsHash).length > 0, 'IngredientNFT: INVALID_IPFS_HASH');
		require(_keywords.length > 1, 'IngredientNFT: INSUFFICIENT_KEYWORDS');
		require(_amount > 0, 'IngredientNFT: INVALID_AMOUNT');
		require(_user != address(0), 'IngredientNFT: INVALID_USER');

		// generate ingredient Id
		tokenCounter.increment();
		ingredientId = tokenCounter.current();
		uint256[] memory defIds;

		// store ingredient details
		ingredients[ingredientId] = Ingredient(
			ingredientId,
			_name,
			0,
			_nutritionsHash,
			defIds,
			_keywords
		);
		ipfsHash[ingredientId] = _ipfsHash;

		// mint ingredients to account
		_mint(_user, ingredientId, _amount, '');

		emit IngredientAdded(ingredientId);
	}

	function _addVariation(
		uint256 _ingredientId,
		string memory _name,
		string memory _svg
	) internal virtual returns (uint256 defsId) {
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_NAME');
		require(bytes(_svg).length > 0, 'IngredientNFT: INVALID_SVG');

		// increment defs counter
		defsCounter.increment();

		defsId = defsCounter.current();
		defs[defsId] = Defs(_ingredientId, _name, _svg);

		ingredients[_ingredientId].defIds.push(defsId);

		emit IngredientVariationAdded(_ingredientId, defsId);
	}

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
		if (!exceptedAddresses[to] && to != address(0)) {
			if (!exceptedFromAddresses[from]) {
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
