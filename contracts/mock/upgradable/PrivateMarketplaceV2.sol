// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../marketplace/PrivateMarketplace.sol';

contract PrivateMarketplaceV2 is PrivateMarketplace {
	/*
   =======================================================================
   ======================== Public Variables =============================
   =======================================================================
 */

	uint256 public maxDuration;

	/*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

	/**
	 * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
	 * @param _nftContractAddress - indicates the ERC1155 NFT contract address
	 * @param _talienAddress - indicates the talien contract address
	 * @param _earlyAccessTime - indicates the early access duration for the vip members(users with genesis Taliens)
	 */
	function initialize(
		address _nftContractAddress,
		address _talienAddress,
		uint256 _earlyAccessTime
	) external virtual override initializer {
		__Marketplace_init(_nftContractAddress);
		require(_talienAddress != address(0), 'PrivateMarketplace: INVALID_TALIEN_ADDRESS');
		talien = ITalien(_talienAddress);
		earlyAccessTime = _earlyAccessTime;
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */

	function updateMaxDuration(uint256 _duration) external virtual onlyAdmin {
		require(_duration > 0 && _duration != maxDuration, 'PrivateMarketplace: INVALID_MAX_DURATION');
		maxDuration = _duration;
	}

	/**
	 * @notice Returns the storage, major, minor, and patch version of the contract.
	 * @return The storage, major, minor, and patch version of the contract.
	 */
	function getVersionNumber()
		external
		pure
		override
		returns (
			uint256,
			uint256,
			uint256
		)
	{
		return (2, 0, 0);
	}
}
