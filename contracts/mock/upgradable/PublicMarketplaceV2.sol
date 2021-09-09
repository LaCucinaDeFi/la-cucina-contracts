// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../marketplace/PublicMarketplace.sol";

contract PublicMarketplaceV2 is PublicMarketplace {
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
     * @param _nftContractAddress indicates the ERC1155 NFT contract address
     */
    function initialize(address _nftContractAddress)
        external
        virtual
        override
        initializer
    {
        __AccessControl_init();
        __ReentrancyGuard_init();

        require(
            _nftContractAddress != address(0),
            "Market: INVALID_NFT_CONTRACT"
        );

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(MINTER_ROLE, _msgSender());

        nftContract = IIngredientNFT(_nftContractAddress);
        minDuration = 1 days;
    }

    /*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */

    function updateMaxDuration(uint256 _duration) external virtual onlyAdmin {
        require(
            _duration > 0 && _duration != maxDuration,
            "PublicMarket: INVALID_MAX_DURATION"
        );
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
