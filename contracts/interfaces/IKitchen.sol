// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IKitchen {
	function dishType(uint256 _dishId)
		external
		returns (string memory name, uint256 totalBaseIngredients);

	function baseIngredient(uint256 _baseIngredientId)
		external
		view
		returns (string memory name, uint256 totalVariations);

	function baseVariation(uint256 _variationId)
		external
		view
		returns (
			uint256 baseId,
			string memory variationName,
			string memory variationSvg
		);

	function addDishType(string memory _name) external returns (uint256 dishId);

	function addBaseIngredientForDishType(uint256 _dishId, string memory _name)
		external
		returns (uint256 baseIngredientId);

	function addBaseIngredientVariation(
		uint256 _baseIngredientId,
		string memory _variationName,
		string memory _svg
	) external returns (uint256 baseVariationId);

	function getCurrentDishTypeId() external view returns (uint256);

	function getCurrentBaseIngredientId() external view returns (uint256);

	function getCurrentBaseVariationId() external view returns (uint256);

	function getBaseIngredientId(uint256 _dishId, uint256 _index) external view returns (uint256);

	function getBaseVariationId(uint256 _baseIngredientId, uint256 _index)
		external
		view
		returns (uint256);

	function getXCoordinateAtIndex(uint256 _dishTypeId, uint256 _index)
		external
		view
		returns (uint256);

	function getYCoordinateAtIndex(uint256 _dishTypeId, uint256 _index)
		external
		view
		returns (uint256);

	function totalCoordinates() external view returns (uint256);
}
