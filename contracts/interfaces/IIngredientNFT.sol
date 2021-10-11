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
			uint256 totalVariations,
			uint256 nutritionsHash
		);

	function getVariationIdByIndex(uint256 _ingredientId, uint256 _index)
		external
		view
		returns (uint256 _defId);

	function defs(uint256 defId)
		external
		view
		returns (
			uint256 ingredientId,
			string memory name,
			string memory svg
		);

	function getCurrentDefs() external view returns (uint256);

	function royaltyInfo(uint256, uint256 _salePrice) external view returns (address, uint256);
}
