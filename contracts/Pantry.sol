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
		require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), 'ERC1155NFT: ONLY_ADMIN_CAN_CALL');
		_;
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */
	function addDish(string memory _name) external onlyAdmin returns (uint256 dishId) {
		require(bytes(_name).length > 0, 'Pantry: INVALID_DISH_NAME');

		dishCounter.increment();
		dishId = dishCounter.current();

		dish[dishId].name = _name;
	}

	function addBaseIngredientForDish(uint256 _dishId, string memory _name)
		external
		onlyAdmin
		returns (uint256 baseIngredientId)
	{
		require(_dishId > 0 && _dishId <= dishCounter.current(), 'Pantry: INVALID_DISH_ID');
		require(bytes(_name).length > 0, 'Pantry: INVALID_DISH_NAME');

		baseIngredientCounter.increment();
		baseIngredientId = baseIngredientCounter.current();

		baseIngredient[baseIngredientId].name = _name;

		dish[_dishId].totalBaseIngredients += 1;
		dish[_dishId].baseIngredientIds.push(baseIngredientId);
	}

	function addBaseIngredientVariation(
		uint256 _baseIngredientId,
		string memory _variationName,
		string memory _svg
	) external onlyAdmin returns (uint256 baseVariationId) {
		require(
			_baseIngredientId > 0 && _baseIngredientId <= baseIngredientCounter.current(),
			'Pantry: INVALID_BASE_INGREDIENT_ID'
		);
		require(bytes(_variationName).length > 0, 'Pantry: INVALID_VARIATION_NAME');
		require(bytes(_svg).length > 0, 'Pantry: INVALID_SVG');

		//increment variation Id
		baseVariationCounter.increment();
		baseVariationId = baseVariationCounter.current();

		baseVariation[baseVariationId] = BaseVariation(_variationName, _svg);

		baseIngredient[_baseIngredientId].totalVariations += 1;
		baseIngredient[_baseIngredientId].variationIds.push(baseVariationId);
	}

	function getBaseIngredientId(uint256 _dishId, uint256 _index) external view returns (uint256) {
		Dish memory _dish = dish[_dishId];
		require(_index < _dish.baseIngredientIds.length, 'Pantry: INVALID_BASE_INDEX');
		return _dish.baseIngredientIds[_index];
	}

	function getBaseVariationId(uint256 _baseIngredientId, uint256 _index)
		external
		view
		returns (uint256)
	{
		require(
			_baseIngredientId > 0 && _baseIngredientId <= baseIngredientCounter.current(),
			'Pantry: INVALID_BASE_INGREDIENT_ID'
		);

		BaseIngredient memory _baseIngredient = baseIngredient[_baseIngredientId];

		require(_index < _baseIngredient.totalVariations, 'Pantry: INVALID_BASE_INDEX');
		return _baseIngredient.variationIds[_index];
	}

	function getCurrentDishId() external view returns (uint256) {
		return dishCounter.current();
	}

	function getCurrentBaseIngredientId() external view returns (uint256) {
		return baseIngredientCounter.current();
	}

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
