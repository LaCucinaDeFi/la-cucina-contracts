// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './ERC1155NFT.sol';

contract IngredientsNFT is ERC1155NFT {
	using Counters for Counters.Counter;

	/*
   =======================================================================
   ======================== Structures ===================================
   =======================================================================
 */
	struct BaseIngredient {
		uint256 id;
		string name;
		string svg;
	}

	struct Ingredient {
		uint256 id;
		string name;
		uint256 fat;
		uint256 baseIngredientId;
		string svg;
	}

	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */

	// baseIngredientId => BaseIngredient
	mapping(uint256 => BaseIngredient) public baseIngredients;

	// ingredientId => Ingredient
	mapping(uint256 => Ingredient) public ingredients;

	/*
   =======================================================================
   ======================== Private Variables ============================
   =======================================================================
 */
	Counters.Counter private baseIngredientCounter;

	/*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

	function initialize(string memory url) public virtual initializer {
		__ERC1155PresetMinterPauser_init(url);
	}

	/*
   =======================================================================
   ======================== Modifiers ====================================
   =======================================================================
 */

	modifier onlyValidBaseIngredient(uint256 _baseIngredientId) {
		require(
			_baseIngredientId > 0 && _baseIngredientId <= baseIngredientCounter.current(),
			'IngredientNFT: INVALID_BASE_INGREDIENT_ID'
		);
		_;
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */
	/**
	 * @notice This function allows minter to mint the ingredient nft tokens
	 * @param _account indicates the user address to which tokens to mint
	 * @param _ingredientId indicates the ingredient id to mint
	 * @param _amountOfCopies indicates the amount of copies of nft type to mint
	 */
	function mint(
		address _account,
		uint256 _ingredientId,
		uint256 _amountOfCopies
	) external virtual onlyMinter onlyValidNftId(_ingredientId) {
		totalSupply[_ingredientId] += _amountOfCopies;
		_mint(_account, _ingredientId, _amountOfCopies, '');
	}

	/**
	 * @notice This function allows minter to burn the tokens
	 * @param _account indicates the user address from which tokens to removed
	 * @param _ingredientId indicates the ingredient id to burn
	 * @param _amountOfCopies indicates the amount of copies of nft type to burn
	 */
	function burn(
		address _account,
		uint256 _ingredientId,
		uint256 _amountOfCopies
	) external virtual onlyMinter onlyValidNftId(_ingredientId) {
		totalSupply[_ingredientId] -= _amountOfCopies;
		_burn(_account, _ingredientId, _amountOfCopies);
	}

	/**
			@notice This method allows admin to add the base ingredient details for a dish.
			@param _name - indicates the name of the ingredient
			@param _svg - indicates the svg of the ingredient
			@return baseIngredientId - new base ingredient id
		 */
	function addBaseIngredient(string memory _name, string memory _svg)
		external
		onlyAdmin
		returns (uint256 baseIngredientId)
	{
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_BASE_INGREDIENT_NAME');
		require(bytes(_svg).length > 0, 'IngredientNFT: INVALID_SVG');

		// generate traitId
		baseIngredientCounter.increment();
		baseIngredientId = baseIngredientCounter.current();

		baseIngredients[baseIngredientId] = BaseIngredient(baseIngredientId, _name, _svg);
	}

	/**
	 *  @notice This method allows admin to add the ingredient details for preparing a dish.
	 *  @param _name - indicates the name of the ingredient
	 *  @param _ipfsHash - indicates the ipfs hash for ingredient
	 *  @param _fat - indicates the fats of the ingredient
	 *  @param _baseIngredientId - indicates the baseIngredient Id to which this ingredient belogs to
	 *  @param _svg - indicates the svg of the ingredient
	 *  @return ingredientId - new ingredient id
	 */
	function addIngredient(
		string memory _name,
		string memory _ipfsHash,
		uint256 _fat,
		uint256 _baseIngredientId,
		string memory _svg
	) external onlyAdmin onlyValidBaseIngredient(_baseIngredientId) returns (uint256 ingredientId) {
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_INGREDIENT_NAME');
		require(bytes(_ipfsHash).length > 0, 'IngredientNFT: INVALID_IPFS_HASH');
		require(_fat > 0, 'IngredientNFT: INVALID_FAT');
		require(bytes(_svg).length > 0, 'IngredientNFT: INVALID_SVG');

		// generate ingredient Id
		tokenCounter.increment();
		ingredientId = tokenCounter.current();

		ipfsHash[ingredientId] = _ipfsHash;
		ingredients[ingredientId] = Ingredient(ingredientId, _name, _fat, _baseIngredientId, _svg);
	}

	/**
	 *	@notice This method allows admin to update the ingredient details for preparing a dish only if no ingredients have minted.
	 *	@param _tokenId - indicates the token id of ingredient
	 *  @param _name - indicates the name of the ingredient
	 *  @param _ipfsHash - indicates the ipfs hash for ingredient
	 *	@param _fat - indicates the fats of the ingredient
	 *	@param _svg - indicates the svg of the ingredient
	 */
	function updateIngredient(
		uint256 _tokenId,
		string memory _name,
		string memory _ipfsHash,
		uint256 _fat,
		string memory _svg
	) external onlyAdmin onlyValidNftId(_tokenId) {
		require(bytes(_name).length > 0, 'IngredientNFT: INVALID_INGREDIENT_NAME');
		require(bytes(_ipfsHash).length > 0, 'IngredientNFT: INVALID_IPFS_HASH');
		require(_fat > 0, 'IngredientNFT: INVALID_FAT');
		require(bytes(_svg).length > 0, 'IngredientNFT: INVALID_SVG');

		require(totalSupply[_tokenId] == 0, 'IngredientNFT: CANNOT_UPDATE_INGREDIENT');

		Ingredient storage ingredient = ingredients[_tokenId];
		ingredient.name = _name;
		ipfsHash[_tokenId] = _ipfsHash;
		ingredient.fat = _fat;
		ingredient.svg = _svg;
	}

	/*
   =======================================================================
   ======================== Getter Methods ===============================
   =======================================================================
 */

	/**
    @notice This method returns the current base ingredient Id
    */
	function getCurrentBaseIngredientId() external view returns (uint256) {
		return baseIngredientCounter.current();
	}
}
