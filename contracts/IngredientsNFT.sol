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

		Defs storage ingredientVariaion = defs[_defId];

		ingredientVariaion.name = _name;
		ingredientVariaion.svg = _svg;

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
	function getIngredientHash(
		uint256[] memory _ingredientIds,
		string memory _dishTypeName,
		uint256 _nonce
	)
		external
		view
		returns (
			uint256 variationIdHash,
			uint256 variationIndexHash,
			string memory dishName,
			uint256 plutamins,
			uint256 strongies
		)
	{
		// get siHash
		for (uint256 i = 0; i < _ingredientIds.length; i++) {
			Ingredient memory ingredient = ingredients[_ingredientIds[i]];
			uint256 totalVariations = ingredient.totalVariations;

			require(totalVariations > 0, 'IngredientNFT: INSUFFICIENT_INGREDIENT_VARIATIONS');

			uint256 variationIndex = LaCucinaUtils.getRandomVariation(_nonce, totalVariations);
			uint256 variationId = ingredient.defIds[variationIndex];

			(uint256 plutamin, uint256 strongie) = getMultiplier(ingredient.nutritionsHash);

			if (i == 0) {
				plutamins = plutamin;
				strongies = strongie;
			} else {
				plutamins *= plutamin;
				strongies += strongie;
			}

			variationIdHash += variationId * 256**i;
			variationIndexHash += variationIndex * 256**i;
		}

		dishName = _getDishName(_ingredientIds, _dishTypeName, _nonce);
	}

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
		virtual
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
	/**
	 * @notice This method returns the multiplier for the ingeredient. It calculates the multiplier based on the nutritions hash
	 * @param nutritionsHash - indicates the nutritionHash of ingredient
	 * @return plutamins - indicates the values of plutamin nutrition
	 * @return strongies - indicates the values of strongies nutrition
	 */
	function getMultiplier(uint256 nutritionsHash)
		internal
		pure
		returns (uint256 plutamins, uint256 strongies)
	{
		uint256 slotConst = 100000;
		uint256 slotMultiplier;
		uint256 nutrition;

		// Iterate Ingredient hash and assemble SVGs
		for (uint8 slot = 7; slot > uint8(0); slot--) {
			slotMultiplier = uint256(slotConst**(slot - 1)); // Create slot multiplier
			nutrition = (slot > 0) // Extract nutrition from slotted value
				? nutritionsHash / slotMultiplier
				: nutritionsHash;
			// store 2nd and last nutrition i.e plutamins and strongies
			if (slot == uint8(2)) {
				plutamins = nutrition;
			}

			if (slot == uint8(7)) {
				strongies = nutrition;
			}
			nutritionsHash -= nutrition * slotMultiplier;
		}
	}

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

	function _getRandomKeyword(uint256 _nonce, uint256[] memory _ingredientIds)
		internal
		view
		returns (string memory keyword)
	{
		uint256 randomIndex = LaCucinaUtils.getRandomVariation(_nonce, _ingredientIds.length);
		Ingredient memory ingredient = ingredients[_ingredientIds[randomIndex]];

		require(ingredient.keywords.length > 0, 'IngredientsNFT: INSUFFICIENT_KEYWORDS');

		if (ingredient.keywords.length == 1) {
			keyword = ingredient.keywords[0];
		} else {
			_nonce++;
			randomIndex = LaCucinaUtils.getRandomVariation(_nonce, ingredient.keywords.length);
			keyword = ingredient.keywords[randomIndex];
		}
	}

	function _getDishName(
		uint256[] memory _ingredientIds,
		string memory _dishTypeName,
		uint256 _nonce
	) internal view returns (string memory dishName) {
		require(_ingredientIds.length > 1, 'IngredientsNFT: INSUFFICIENT_INGREDIENTS');

		_nonce++;
		string memory keyword1 = _getRandomKeyword(_nonce, _ingredientIds);

		_nonce++;
		string memory keyword2 = _getRandomKeyword(_nonce, _ingredientIds);

		if (_ingredientIds.length > 2) {
			_nonce++;
			string memory keyword3 = _getRandomKeyword(_nonce, _ingredientIds);

			dishName = string(
				abi.encodePacked(
					keyword1, // randomly selected keyword of randomly selected SI1
					' ',
					keyword2, // randomly selected keyword of randomly selected SI2
					' ',
					keyword3, // randomly selected keyword of randomly selected SI3
					' ',
					_dishTypeName
				)
			);
		} else {
			dishName = string(
				abi.encodePacked(
					keyword1, // randomly selected keyword of randomly selected SI1
					' ',
					keyword2, // randomly selected keyword of randomly selected SI2
					' ',
					_dishTypeName // dish type name
				)
			);
		}
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
