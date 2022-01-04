//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

library LaCucinaUtils {
	/**
	 * @dev Converts a `uint256` to its ASCII `string` decimal representation.
	 */
	function toString(uint256 value) internal pure returns (string memory) {
		// Inspired by OraclizeAPI's implementation - MIT licence
		// https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

		if (value == 0) {
			return '0';
		}
		uint256 temp = value;
		uint256 digits;
		while (temp != 0) {
			digits++;
			temp /= 10;
		}
		bytes memory buffer = new bytes(digits);
		while (value != 0) {
			digits -= 1;
			buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
			value /= 10;
		}
		return string(buffer);
	}

	/**
	 * @notice Concatenate two strings
	 * @param _a the first string
	 * @param _b the second string
	 * @return result the concatenation of `_a` and `_b`
	 */
	function strConcat(string memory _a, string memory _b)
		internal
		pure
		returns (string memory result)
	{
		result = string(abi.encodePacked(bytes(_a), bytes(_b)));
	}

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

	// Utility function to find ceiling of r in arr[l..h]
	function findCeil(
		uint256[] memory arr,
		uint256 r,
		uint256 l,
		uint256 h
	) internal pure returns (uint256) {
		uint256 mid;
		while (l < h) {
			mid = l + ((h - l) >> 1); // Same as mid = (l+h)/2
			(r > arr[mid]) ? (l = mid + 1) : (h = mid);
		}
		return (arr[l] >= r) ? l : type(uint256).max;
	}
}
