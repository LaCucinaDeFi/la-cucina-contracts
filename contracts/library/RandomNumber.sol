//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

library RandomNumber {
	function getRandomVariation(uint256 _seed, uint256 _max)
		internal
		view
		returns (uint256 randomVariation)
	{
		randomVariation = random(_seed, _max);
		assert(randomVariation < _max);
	}

	function random(uint256 _seed, uint256 _max) internal view returns (uint256) {
		require(_max > 0, 'LaCucinaUtils: INVALID_MAX');
		uint256 randomnumber = uint256(
			keccak256(
				abi.encodePacked(block.timestamp, block.difficulty, block.number, msg.sender, _seed)
			)
		) % _max;

		return randomnumber;
	}
}
