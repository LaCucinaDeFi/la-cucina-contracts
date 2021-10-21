pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import './interfaces/IVersionedContract.sol';

contract Pantry is AccessControlUpgradeable, ReentrancyGuardUpgradeable, IVersionedContract {
	using Counters for Counters.Counter;

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

	struct Dish {
		string name;
		uint256 totalBaseIngredients;
		uint256[] baseIngredientIds;
	}

	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */

	// dishId => Dish
	mapping(uint256 => Dish) public dish;

	// basIngredientId => BaseIngredient
	mapping(uint256 => BaseIngredient) public baseIngredient;

	// variationId => variation svg
	mapping(uint256 => BaseVariation) public baseVariation;

	/*
   =======================================================================
   ======================== Private Variables ============================
   =======================================================================
 */
	Counters.Counter private baseIngredientCounter;
	Counters.Counter private dishCounter;
	Counters.Counter private baseVariationCounter;

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
	}

	/*
   =======================================================================
   ======================== Modifiers ====================================
   =======================================================================
 */

	modifier onlyAdmin() {
		require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), 'Pantry: ONLY_ADMIN_CAN_CALL');
		_;
	}

	modifier onlyValidDishId(uint256 _dishId) {
		require(_dishId > 0 && _dishId <= dishCounter.current(), 'Pantry: INVALID_DISH_ID');
		_;
	}

	modifier onlyValidBaseIngredientId(uint256 _baseIngredientId) {
		require(
			_baseIngredientId > 0 && _baseIngredientId <= baseIngredientCounter.current(),
			'Pantry: INVALID_BASE_INGREDIENT_ID'
		);
		_;
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */
	/**
	 * @notice This method allows admin to add the dish name in which baseIngredients will be added
	 * @param _name - indicates the namce of the dish
	 * @return dishId - indicates the generated id of the dish
	 */
	function addDish(string memory _name) external onlyAdmin returns (uint256 dishId) {
		require(bytes(_name).length > 0, 'Pantry: INVALID_DISH_NAME');

		dishCounter.increment();
		dishId = dishCounter.current();

		dish[dishId].name = _name;
	}

	/**
	 * @notice This method allows admin to add the baseIngredients for the dish.
	 * @param _dishId - indicates the dish id for adding the base ingredient
	 * @param _name - indicates the name of the base ingredient
	 * @return baseIngredientId - indicates the name of the baseIngredient.
	 */
	function addBaseIngredientForDish(uint256 _dishId, string memory _name)
		external
		onlyAdmin
		onlyValidDishId(_dishId)
		returns (uint256 baseIngredientId)
	{
		require(bytes(_name).length > 0, 'Pantry: INVALID_BASE_INGREDIENT_NAME');

		baseIngredientCounter.increment();
		baseIngredientId = baseIngredientCounter.current();

		baseIngredient[baseIngredientId].name = _name;

		dish[_dishId].totalBaseIngredients += 1;
		dish[_dishId].baseIngredientIds.push(baseIngredientId);
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
		onlyAdmin
		onlyValidBaseIngredientId(_baseIngredientId)
		returns (uint256 baseVariationId)
	{
		require(bytes(_variationName).length > 0, 'Pantry: INVALID_VARIATION_NAME');
		require(bytes(_svg).length > 0, 'Pantry: INVALID_SVG');

		//increment variation Id
		baseVariationCounter.increment();
		baseVariationId = baseVariationCounter.current();

		baseVariation[baseVariationId] = BaseVariation(_baseIngredientId, _variationName, _svg);

		baseIngredient[_baseIngredientId].totalVariations += 1;
		baseIngredient[_baseIngredientId].variationIds.push(baseVariationId);
	}

	/*
   =======================================================================
   ======================== Getter Methods ===============================
   =======================================================================
 */

	/**
	 * @notice This method returns the baseIngredient id from the base ingredients list of given dish at given index.
	 * @param _dishId - indicates the dish id
	 * @param _index - indicates the index for the base ingredient list
	 * @return returns the base ingredient id
	 */
	function getBaseIngredientId(uint256 _dishId, uint256 _index)
		external
		view
		onlyValidDishId(_dishId)
		returns (uint256)
	{
		Dish memory _dish = dish[_dishId];
		require(_index < _dish.baseIngredientIds.length, 'Pantry: INVALID_BASE_INDEX');
		return _dish.baseIngredientIds[_index];
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

		require(_index < _baseIngredient.totalVariations, 'Pantry: INVALID_VARIATION_INDEX');
		return _baseIngredient.variationIds[_index];
	}

	/**
	 * @notice This method returns the current dish id
	 */
	function getCurrentDishId() external view returns (uint256) {
		return dishCounter.current();
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
