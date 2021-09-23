// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './INFT.sol';

interface IIngredientNFT is INFT {
	function mint(
		address _account,
		uint256 _nftId,
		uint256 _amountOfCopies
	) external;

	function burn(
		address _account,
		uint256 _nftId,
		uint256 _amountOfCopies
	) external;

	function ingredients(uint256 _ingredientId)
		external
		view
		returns (
			uint256 id,
			string memory name,
			uint256 fat,
			uint256 totalVariations
		);

	function defs(uint256 defId) external view returns (string memory);

	function getCurrentDefs() external view returns (uint256);

	function ingredientVariation(uint256 ingredinetId, uint256 variationIndex)
		external
		view
		returns (uint256);
}
