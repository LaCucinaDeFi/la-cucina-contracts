// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol';

interface IDishesNFT is IERC721Upgradeable {
	function getCurrentTokenId() external view returns (uint256);

	function dish(uint256 _dishId)
		external
		view
		returns (
			address dishOwner,
			bool cooked,
			uint256 dishId,
			uint256 _flameId,
			uint256 totalIngredients,
			uint256 ingredientVariationHash, // indicates hash of the indexes of ingredient variations
			uint256 totalBaseIngredients,
			uint256 baseVariationHash,
			uint256 creationTime,
			uint256 completionTime
		);

	function prepareDish(
		address _user,
		uint256 _dishId,
		uint256 _flameId,
		uint256 preparationTime,
		uint256[] memory ingredientIds
	) external returns (uint256 dishId);

	function serveDish(uint256 _dishId) external view returns (string memory svg);

	function uncookDish(uint256 _dishId) external;

	function updatePrepartionTime(
		uint256 _dishId,
		uint256 _flameId,
		uint256 _preparationTime
	) external;
}
