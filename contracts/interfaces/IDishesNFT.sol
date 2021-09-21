// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './INFT.sol';

interface IDishesNFT is INFT {
	function dish(uint256 dishId)
		external
		returns (
			address dishOwner,
			bool cooked,
			uint256 baseIngredientId,
			uint256 fats,
			uint256 _totalBaseIngredients,
			uint256 totalIngredients,
			uint256 ingredientsHash,
			uint256 variationsHash
		);

	function prepareDish(
		address _user,
		uint256 _dishId,
		uint256 _fats,
		uint256 _totalBaseIngredients,
		uint256 _totalIngredients,
		uint256 _ingredientsHash,
		uint256 _ingredientVariationHash,
		uint256 _baseVariationHash
	) external returns (uint256 dishId);

	function serveDish(uint256 _dishId) external view returns (string memory svg);

	function uncookDish(uint256 _dishId) external;
}
