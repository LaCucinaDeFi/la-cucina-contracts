// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import './interfaces/IVersionedContract.sol';
import './library/RandomNumber.sol';

contract Kitchen is AccessControlUpgradeable, ReentrancyGuardUpgradeable, IVersionedContract {
	using CountersUpgradeable for CountersUpgradeable.Counter;

	struct BaseIngredient {
		string name;
		uint256 totalVariations;
		uint256[] variationIds;
	}

	struct BaseVariation {
		uint256 baseId;
		string name;
		string svg;
	}

	struct DishType {
		string name;
		uint256 totalBaseIngredients;
		uint256[] baseIngredientIds;
		uint256[] x;
		uint256[] y;
	}

	/*
  	=======================================================================
   	======================== Public Variables ============================
   	=======================================================================
 	*/
	uint256 public totalCoordinates;

	// dishTypeId => DishType
	mapping(uint256 => DishType) public dishType;
	// basIngredientId => BaseIngredient
	mapping(uint256 => BaseIngredient) public baseIngredient;
	// variationId => variation svg
	mapping(uint256 => BaseVariation) public baseVariation;

	/*
   	=======================================================================
   	======================== Private Variables ============================
   	=======================================================================
 	*/
	bytes32 public constant OPERATOR_ROLE = keccak256('OPERATOR_ROLE');

	CountersUpgradeable.Counter private dishTypeCounter;
	CountersUpgradeable.Counter private baseIngredientCounter;
	CountersUpgradeable.Counter private baseVariationCounter;

	/*
   	=======================================================================
   	======================== Constructor/Initializer ======================
   	=======================================================================
 	*/

	/**
	 * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
	 */
	function initialize() external virtual initializer {
		__AccessControl_init();
		__ReentrancyGuard_init();

		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

		totalCoordinates = 7;
	}

	/*
   	=======================================================================
   	======================== Modifiers ====================================
   	=======================================================================
 	*/
	modifier onlyOperator() {
		require(hasRole(OPERATOR_ROLE, _msgSender()), 'Kitchen: ONLY_OPERATOR_CAN_CALL');
		_;
	}

	modifier onlyValidDishTypeId(uint256 _dishTypeId) {
		require(
			_dishTypeId > 0 && _dishTypeId <= dishTypeCounter.current(),
			'Kitchen: INVALID_DISH_ID'
		);
		_;
	}

	modifier onlyValidBaseIngredientId(uint256 _baseIngredientId) {
		require(
			_baseIngredientId > 0 && _baseIngredientId <= baseIngredientCounter.current(),
			'Kitchen: INVALID_BASE_INGREDIENT_ID'
		);
		_;
	}

	/*
  	=======================================================================
   	======================== Public Methods ===============================
   	=======================================================================
 	*/
	/**
	 * @notice This method allows admin to add the dishType name in which baseIngredients will be added
	 * @param _name - indicates the name of the dishType
	 * @param _x - indicates the list of x coordinates for positioning the ingredient
	 * @param _y - indicates the list of y coordinates for positioning the ingredient
	 * @return dishTypeId - indicates the generated id of the dishType
	 */
	function addDishType(
		string memory _name,
		uint256[] memory _x,
		uint256[] memory _y
	) external onlyOperator returns (uint256 dishTypeId) {
		require(bytes(_name).length > 0, 'Kitchen: INVALID_DISH_NAME');
		require(
			_x.length == totalCoordinates && _x.length == _y.length,
			'Kitchen: INVALID_COORDINATES'
		);

		dishTypeCounter.increment();
		dishTypeId = dishTypeCounter.current();

		dishType[dishTypeId].name = _name;
		dishType[dishTypeId].x = _x;
		dishType[dishTypeId].y = _y;
	}

	/**
	 * @notice This method allows admin to add the baseIngredients for the dishType.
	 * @param _dishTypeId - indicates the dishType id for adding the base ingredient
	 * @param _name - indicates the name of the base ingredient
	 * @return baseIngredientId - indicates the name of the baseIngredient.
	 */
	function addBaseIngredientForDishType(uint256 _dishTypeId, string memory _name)
		external
		onlyOperator
		onlyValidDishTypeId(_dishTypeId)
		returns (uint256 baseIngredientId)
	{
		require(bytes(_name).length > 0, 'Kitchen: INVALID_BASE_INGREDIENT_NAME');

		baseIngredientCounter.increment();
		baseIngredientId = baseIngredientCounter.current();

		baseIngredient[baseIngredientId].name = _name;

		dishType[_dishTypeId].totalBaseIngredients += 1;
		dishType[_dishTypeId].baseIngredientIds.push(baseIngredientId);
	}

	/**
	 * @notice This method allows admin to add the different variations for the base ingredient
	 * @param _baseIngredientId - indicates the base ingredient id
	 * @param _variationName - indicates the variation name
	 * @param _svg - indicates the svg string of the base ingredient svg
	 * @param baseVariationId - indicates the newly generated variation id
	 */
	function addBaseIngredientVariation(
		uint256 _baseIngredientId,
		string memory _variationName,
		string memory _svg
	)
		external
		onlyOperator
		onlyValidBaseIngredientId(_baseIngredientId)
		returns (uint256 baseVariationId)
	{
		require(bytes(_variationName).length > 0, 'Kitchen: INVALID_VARIATION_NAME');
		require(bytes(_svg).length > 0, 'Kitchen: INVALID_SVG');

		// increment variation Id
		baseVariationCounter.increment();
		baseVariationId = baseVariationCounter.current();

		baseVariation[baseVariationId] = BaseVariation(_baseIngredientId, _variationName, _svg);

		baseIngredient[_baseIngredientId].totalVariations += 1;
		baseIngredient[_baseIngredientId].variationIds.push(baseVariationId);
	}

	/**
	 * @notice This method allows admin to update the total number of coordinates
	 */
	function updateTotalCoordinates(uint256 _newTotal) external onlyOperator {
		require(_newTotal != totalCoordinates && _newTotal > 0, 'Kitchen: INVALID_COORDINATES');
		totalCoordinates = _newTotal;
	}

	/*
   	=======================================================================
   	======================== Getter Methods ===============================
   	=======================================================================
 	*/
	function getBaseVariationHash(uint256 _dishTypeId, uint256 nonce)
		external
		view
		onlyValidDishTypeId(_dishTypeId)
		returns (
			uint256 baseVariationHash,
			string memory dishName,
			uint256 totalBaseIngredients
		)
	{
		totalBaseIngredients = dishType[_dishTypeId].totalBaseIngredients;
		require(totalBaseIngredients > 0, 'Kitchen: INSUFFICIENT_BASE_INGREDINETS');

		// get base Variation Hash
		for (uint256 baseIndex = 0; baseIndex < totalBaseIngredients; baseIndex++) {
			uint256 baseIngredientId = dishType[_dishTypeId].baseIngredientIds[baseIndex];
			uint256 baseVariationCount = baseIngredient[baseIngredientId].totalVariations;

			require(baseVariationCount > 0, 'Kitchen: NO_BASE_VARIATIONS');

			uint256 randomVarionIndex = RandomNumber.getRandomVariation(nonce, baseVariationCount);
			uint256 baseVariationId = baseIngredient[baseIngredientId].variationIds[randomVarionIndex];

			baseVariationHash += baseVariationId * 256**baseIndex;
		}
		dishName = dishType[_dishTypeId].name;
	}

	/**
	 * @notice This method returns the baseIngredient id from the base ingredients list of given dishType at given index.
	 * @param _dishTypeId - indicates the dishType id
	 * @param _index - indicates the index for the base ingredient list
	 * @return returns the base ingredient id
	 */
	function getBaseIngredientId(uint256 _dishTypeId, uint256 _index)
		external
		view
		onlyValidDishTypeId(_dishTypeId)
		returns (uint256)
	{
		DishType memory _dishType = dishType[_dishTypeId];
		require(_index < _dishType.baseIngredientIds.length, 'Kitchen: INVALID_BASE_INDEX');
		return _dishType.baseIngredientIds[_index];
	}

	/**
	 * @notice This method returns the variation id from the variation list of given base ingredient at given index.
	 * @param _baseIngredientId - indicates the base ingredient id
	 * @param _index - indicates the index for the variation list
	 * @return returns the variation id
	 */
	function getBaseVariationId(uint256 _baseIngredientId, uint256 _index)
		external
		view
		onlyValidBaseIngredientId(_baseIngredientId)
		returns (uint256)
	{
		BaseIngredient memory _baseIngredient = baseIngredient[_baseIngredientId];

		require(_index < _baseIngredient.totalVariations, 'Kitchen: INVALID_VARIATION_INDEX');
		return _baseIngredient.variationIds[_index];
	}

	/**
	 * @notice This method returns the current dishType id
	 */
	function getCurrentDishTypeId() external view returns (uint256) {
		return dishTypeCounter.current();
	}

	/**
	 * @notice This method returns the current base ingredient id
	 */
	function getCurrentBaseIngredientId() external view returns (uint256) {
		return baseIngredientCounter.current();
	}

	/**
	 * @notice This method returns the current base variation id
	 */
	function getCurrentBaseVariationId() external view returns (uint256) {
		return baseVariationCounter.current();
	}

	/**
	 * @notice This method returns the x coordinate located at index for ingredient
	 */
	function getXCoordinateAtIndex(uint256 _dishTypeId, uint256 _index)
		external
		view
		onlyValidDishTypeId(_dishTypeId)
		returns (uint256)
	{
		require(_index < dishType[_dishTypeId].x.length, 'Kitchen: INVALID_INDEX');
		return dishType[_dishTypeId].x[_index];
	}

	/**
	 * @notice This method returns the y coordinate located at index for ingredient
	 */
	function getYCoordinateAtIndex(uint256 _dishTypeId, uint256 _index)
		external
		view
		onlyValidDishTypeId(_dishTypeId)
		returns (uint256)
	{
		require(_index < dishType[_dishTypeId].y.length, 'Kitchen: INVALID_INDEX');
		return dishType[_dishTypeId].y[_index];
	}

	/**
	 * @notice Returns the storage, major, minor, and patch version of the contract.
	 * @return The storage, major, minor, and patch version of the contract.
	 */
	function getVersionNumber()
		external
		pure
		virtual
		override
		returns (
			uint256,
			uint256,
			uint256
		)
	{
		return (1, 0, 0);
	}
}
