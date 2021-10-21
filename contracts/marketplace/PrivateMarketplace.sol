// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './Marketplace.sol';
import '../interfaces/IVersionedContract.sol';
import '../interfaces/ITalien.sol';

contract PrivateMarketplace is Initializable, Marketplace, IVersionedContract {
	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */
	ITalien public talien;
	uint256 earlyAccessTime;

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
	) external virtual initializer {
		__Marketplace_init(_nftContractAddress);
		require(_talienAddress != address(0), 'PrivateMarketplace: INVALID_TALIEN_ADDRESS');
		talien = ITalien(_talienAddress);
		earlyAccessTime = _earlyAccessTime;
	}

	/*
   =======================================================================
   ======================== Modifiers ====================================
   =======================================================================
 */

	modifier onlyMinter() {
		require(hasRole(MINTER_ROLE, _msgSender()), 'PrivateMarketplace: MINTER_ROLE_REQUIRED');
		_;
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */

	/**
	 * @notice This method allows minter to create a new nfts and put them for sale. only minter can call this
	 * @param _nftPrice indicates the selling price for nft in given token address.
	 * @param _tokenAddress indicates the the ERC20/BEP20 token address in which nft seller/owner wants to get paid in
	 * @param _nftId indicates the ingredient id
	 * @param _amountOfCopies indicates the no. of copies to create for the nft id
	 * @return saleId - indicates saleId in which copies of new NFT are sold.
	 */
	function createAndSellNFT(
		uint256 _nftPrice,
		address _tokenAddress,
		uint256 _nftId,
		uint256 _amountOfCopies
	) external virtual onlyMinter nonReentrant returns (uint256 saleId) {
		require(_nftPrice > 0, 'PrivateMarketplace: INVALID_NFT_PRICE');
		require(
			_nftId > 0 && _nftId <= nftContract.getCurrentNftId(),
			'PrivateMarketplace: INVALID_INGREDIENT_ID'
		);
		require(_amountOfCopies > 0, 'PrivateMarketplace: INVALID_NUMBER_OF_COPIES');

		//mint nfts
		nftContract.mint(address(this), _nftId, _amountOfCopies, '');

		//create sale
		saleId = _sellNFT(_nftId, _nftPrice, _tokenAddress, _amountOfCopies);
	}

	/**
	 * @notice This method allows minter to create a new unique NFT and put it in auction. only minter can call this method
	 * @param _initialPrice indicates the startting price for the auction. all the bids should be greater than the initial price.
	 * @param _tokenAddress indicates the the ERC20/BEP20 token address in which nft seller/owner wants to get paid in
	 * @param _nftId indicates the ingredient id
	 * @param _duration indicates the duration after which auction will get closed.
	 * @return auctionId - indicates auctionId though which copy of new unique NFT are sold.
	 */
	function createAndAuctionNFT(
		uint256 _initialPrice,
		address _tokenAddress,
		uint256 _nftId,
		uint256 _duration
	) external virtual onlyMinter nonReentrant returns (uint256 auctionId) {
		require(_initialPrice > 0, 'PrivateMarketplace: INVALID_INITIAL_NFT_PRICE');
		require(
			_nftId > 0 && _nftId <= nftContract.getCurrentNftId(),
			'PrivateMarketplace: INVALID_INGREDIENT_ID'
		);

		//mint nfts
		nftContract.mint(address(this), _nftId, 1, '');

		//creating auction for one copy of nft.
		auctionId = _createAuction(_nftId, _initialPrice, _tokenAddress, _duration);
	}

	/**
    * @notice This method allows anyone with accepted tokens to purchase the NFT from the particular sale. user needs to approve his ERC20/BEP20 tokens to this contract.
              buyer cannot buy/hold more than one copy of same nft.
    * @param _saleId indicates the saleId in from which buyer buys required NFT at specified price.
   */
	function buyNFT(uint256 _saleId) external virtual {
		(, bool hasGenesisTalien) = isUserHasTalien();

		_buyNFT(_saleId, hasGenesisTalien, earlyAccessTime);
	}

	/**
	 * @notice This method allows minter to cancel the sale, burn the token and delete the sale data
	 * @param _saleId indicates the sale id
	 */
	function cancelSale(uint256 _saleId)
		external
		virtual
		onlyValidSaleId(_saleId)
		onlyMinter
		nonReentrant
	{
		SaleInfo memory _sale = sale[_saleId];
		require(isActiveSale(_saleId), 'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_SALE');
		require(_sale.totalCopies == _sale.remainingCopies, 'PrivateMarketplace: CANNOT_CANCEL_SALE');
		//burn the token
		nftContract.burn(address(this), _sale.nftId, _sale.remainingCopies);

		//delete sale data
		delete sale[_saleId];
	}

	/**
	 * @notice This method allows minter to cancel the auction, burn the token and delete the auction data
	 * @param _auctionId indicates the auction id
	 */
	function cancelAuction(uint256 _auctionId)
		external
		virtual
		onlyValidAuctionId(_auctionId)
		onlyMinter
		nonReentrant
	{
		AuctionInfo storage _auction = auction[_auctionId];

		require(isActiveAuction(_auctionId), 'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_AUCTION');
		require(_auction.bidIds.length == 0, 'PrivateMarketplace: CANNOT_CANCEL_AUCTION');

		//burn the token
		nftContract.burn(address(this), _auction.nftId, 1);

		//delete auction data
		delete auction[_auctionId];
	}

	/**
	 * @notice This method allows admin to update the early access time, so that user with genesis talien can get early access to ingredients.
	 * @param _newAccessTime - indicates the new access time
	 */
	function updateEarlyAccessTime(uint256 _newAccessTime) external onlyAdmin {
		require(earlyAccessTime != _newAccessTime, 'PrivateMarketplace: ALREADY_SET');
		earlyAccessTime = _newAccessTime;
	}

	/**
	 * @notice This method tells if user has any talien. also it tells if user has any genesis talien or not
	 * @return hasTalien - indicates if user have any talien
	 * @return isGenesis - indicates if the talien is genesis or not
	 */
	function isUserHasTalien() public virtual returns (bool hasTalien, bool isGenesis) {
		uint256 userTalienBal = talien.balanceOf(msg.sender);

		if (userTalienBal > 0) {
			hasTalien = true;
			for (uint256 index = 0; index < userTalienBal; index++) {
				uint256 talienId = talien.tokenOfOwnerByIndex(msg.sender, index);
				(, uint256 generation, , , ) = talien.taliens(talienId);

				// check if talien generation is genesis generation
				if (generation == 1) {
					isGenesis = true;
					break;
				}
			}
		}
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
