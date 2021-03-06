// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './BaseMarketplace.sol';
import '../interfaces/IVersionedContract.sol';
import '../interfaces/ITalien.sol';

contract PrivateMarketplace is Initializable, BaseMarketplace, IVersionedContract {
	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */
	ITalien public talien;
	uint256 public earlyAccessTime;
	address public fundReceiver;

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
	 * @param _fundReceiver - indiacates the fund receiver address who will receives the payment for the SIs.
	 */
	function initialize(
		address _nftContractAddress,
		address _talienAddress,
		uint256 _earlyAccessTime,
		address _fundReceiver
	) external virtual initializer {
		__Marketplace_init(_nftContractAddress);
		require(_talienAddress != address(0), 'PrivateMarketplace: INVALID_TALIEN_ADDRESS');
		talien = ITalien(_talienAddress);
		earlyAccessTime = _earlyAccessTime;
		fundReceiver = _fundReceiver;
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
	 * 	@notice This method allows minter to create a new nfts and put them for sale. only minter can call this
	 * 	@param _nftPrice indicates the selling price for nft in given token address.
	 * 	@param _tokenAddress indicates the the ERC20/BEP20 token address in which nft seller/owner wants to get paid in
	 * 	@param _amountOfCopies indicates the no. of copies to create for the nft id
	 *  @param _ingredientName - indicates the name of the ingredient
	 *  @param _nutritionsHash - indicates the nutritions
	 *  @param _ipfsHash - indicates the ipfs hash for the ingredient
	 * 	@param _keywords - indicates the list of keywords for the dish name
	 *  @param _svgs - indicates the svgs for the ingredient variations
	 *	@param _variationNames - indicates the variation names
	 * 	@return nftId - indicates id of nft created in sale.
	 * 	@return saleId - indicates saleId in which copies of new NFT are sold.
	 */
	function createAndSellNFT(
		uint256 _nftPrice,
		address _tokenAddress,
		uint256 _amountOfCopies,
		string memory _ingredientName,
		uint256 _nutritionsHash,
		string memory _ipfsHash,
		string[] memory _keywords,
		string[] memory _svgs,
		string[] memory _variationNames
	) external virtual onlyMinter nonReentrant returns (uint256 nftId, uint256 saleId) {
		require(_nftPrice > 0, 'PrivateMarketplace: INVALID_NFT_PRICE');

		require(_amountOfCopies > 0, 'PrivateMarketplace: INVALID_NUMBER_OF_COPIES');

		//mint nfts
		nftId = nftContract.addIngredientWithVariations(
			address(this),
			_amountOfCopies,
			_ingredientName,
			_nutritionsHash,
			_ipfsHash,
			_keywords,
			_svgs,
			_variationNames
		);

		//create sale
		saleId = _sellNFT(nftId, _nftPrice, _tokenAddress, _amountOfCopies, msg.sender);
	}

	/**
	 * 	@notice This method allows minter to create a new unique NFT and put it in auction. only minter can call this method
	 * 	@param _initialPrice indicates the startting price for the auction. all the bids should be greater than the initial price.
	 * 	@param _tokenAddress indicates the the ERC20/BEP20 token address in which nft seller/owner wants to get paid in
	 * 	@param _duration indicates the duration after which auction will get closed.
	 * 	@param _isVipAuction indicates whether this new auction will be only for vip memmbers or not
	 *  @param _ingredientName - indicates the name of the ingredient
	 *  @param _nutritionsHash - indicates the nutritions
	 *  @param _ipfsHash - indicates the ipfs hash for the ingredient
	 * 	@param _keywords - indicates the list of keywords for the dish name
	 *  @param _svgs - indicates the svgs for the ingredient variations
	 *	@param _variationNames - indicates the variation names
	 * 	@return nftId - indicates id of nft created in sale.
	 * 	@return auctionId - indicates auctionId though which copy of new unique NFT are sold.
	 */
	function createAndAuctionNFT(
		uint256 _initialPrice,
		address _tokenAddress,
		uint256 _duration,
		bool _isVipAuction,
		string memory _ingredientName,
		uint256 _nutritionsHash,
		string memory _ipfsHash,
		string[] memory _keywords,
		string[] memory _svgs,
		string[] memory _variationNames
	) external virtual onlyMinter nonReentrant returns (uint256 nftId, uint256 auctionId) {
		require(_initialPrice > 0, 'PrivateMarketplace: INVALID_INITIAL_NFT_PRICE');

		//mint nft
		nftId = nftContract.addIngredientWithVariations(
			address(this),
			1,
			_ingredientName,
			_nutritionsHash,
			_ipfsHash,
			_keywords,
			_svgs,
			_variationNames
		);

		//creating auction for one copy of nft.
		auctionId = _createAuction(
			nftId,
			_initialPrice,
			_tokenAddress,
			_duration,
			_isVipAuction,
			msg.sender
		);
	}

	/**
    * @notice This method allows anyone with accepted tokens to purchase the NFT from the particular sale. user needs to approve his ERC20/BEP20 tokens to this contract.
              buyer cannot buy/hold more than one copy of same nft.
    * @param _saleId indicates the saleId in from which buyer buys required NFT at specified price.
   */
	function buyNFT(uint256 _saleId) external virtual override onlyValidSaleId(_saleId) nonReentrant {
		require(isActiveSale(_saleId), 'Market: CANNOT_BUY_FROM_INACTIVE_SALE');
		SaleInfo storage _sale = sale[_saleId];

		(, bool hasGenesisTalien) = doesUserHasTalien(msg.sender);

		//give early access to vip members only
		if (!hasGenesisTalien) {
			require(
				block.timestamp >= (_sale.saleCreationTime + earlyAccessTime),
				'Market: EARLY_ACCESS_REQUIRED'
			);
		}

		//transfer tokens to the fund receiver
		require(
			IBEP20(_sale.currency).transferFrom(msg.sender, fundReceiver, _sale.sellingPrice),
			'Market: TRANSFER_FROM_FAILED'
		);

		//transfer one nft to buyer
		nftContract.safeTransferFrom(address(this), msg.sender, _sale.nftId, 1, '');

		_sale.buyer = msg.sender;
		_sale.remainingCopies = _sale.remainingCopies - 1;

		//check if all copies of sale is sold
		if (_sale.remainingCopies == 0) {
			_sale.sellTimeStamp = block.timestamp;
		}

		emit BuySaleNFT(msg.sender, _sale.nftId, _saleId, block.timestamp);
	}

	/**
	 * @notice This method allows anyone with accepted token to place the bid on auction to buy NFT. bidder need to approve his accepted tokens.
	 * @param _auctionId indicates the auctionId for which user wants place bid.
	 * @param _bidAmount indicates the bidAmount which must be greater than the existing winning bid amount or startingPrice in case of first bid.
	 */
	function placeBid(uint256 _auctionId, uint256 _bidAmount)
		external
		virtual
		override
		onlyValidAuctionId(_auctionId)
		nonReentrant
		returns (uint256 bidId)
	{
		if (auction[_auctionId].isVipAuction) {
			(, bool hasGenesisTalien) = doesUserHasTalien(msg.sender);
			require(hasGenesisTalien, 'PrivateMarketplace: ONLY_VIP_MEMBERS_CAN_BID');
		}

		bidId = _placeBid(_auctionId, _bidAmount, msg.sender);
	}

	/**
	 * @notice This method finds the winner of the Auction and transfer the nft to winning bidder and accepted tokens to the fund receiver
	 * @param _auctionId indicates the auctionId which is to be resolve
	 */
	function resolveAuction(uint256 _auctionId)
		external
		virtual
		override
		onlyValidAuctionId(_auctionId)
		nonReentrant
	{
		AuctionInfo storage _auction = auction[_auctionId];
		require(isActiveAuction(_auctionId), 'Market: CANNOT_RESOLVE_INACTIVE_AUCTION');
		require(
			block.timestamp > (_auction.startBlock + _auction.duration),
			'Market: CANNOT_RESOLVE_DURING_AUCTION'
		);
		require(
			_auction.winningBidId != 0 && _auction.bidIds.length > 0,
			'Market: CANNOT_RESOLVE_AUCTION_WITH_NO_BIDS'
		);

		// transfer the tokens to the fundReceiver
		require(
			IBEP20(_auction.currency).transfer(fundReceiver, bid[_auction.winningBidId].bidAmount),
			'Market: TRANSFER_FAILED'
		);

		nftContract.safeTransferFrom(
			address(this),
			bid[_auction.winningBidId].bidderAddress,
			_auction.nftId,
			1,
			''
		);

		//close auction
		_auction.status = 0;
		_auction.buyTimestamp = block.timestamp;

		emit BuyAuctionNFT(bid[_auction.winningBidId].bidderAddress, _auction.nftId, _auctionId);
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
	 * @notice This method allows operator to update the early access time, so that user with genesis talien can get early access to ingredients.
	 * @param _newAccessTime - indicates the new access time
	 */
	function updateEarlyAccessTime(uint256 _newAccessTime) external virtual onlyOperator {
		require(earlyAccessTime != _newAccessTime, 'PrivateMarketplace: ALREADY_SET');
		earlyAccessTime = _newAccessTime;
	}

	/**
	 * @notice This method allows operator to update the fund receivers address
	 * @param _newFundReceiver - indicates the address of new fund receiver
	 */
	function updateFundReceiver(address _newFundReceiver) external virtual onlyOperator {
		require(
			_newFundReceiver != fundReceiver && _newFundReceiver != address(0),
			'PrivateMarketplace: INVALID_ADDRESS'
		);
		fundReceiver = _newFundReceiver;
	}

	/**
	 * @notice This method tells if user has any talien. also it tells if user has any genesis talien or not
	 * @return hasTalien - indicates if user have any talien
	 * @return isGenesis - indicates if the talien is genesis or not
	 */
	function doesUserHasTalien(address _user)
		public
		view
		virtual
		returns (bool hasTalien, bool isGenesis)
	{
		uint256 userTalienBal = talien.balanceOf(_user);

		if (userTalienBal > 0) {
			hasTalien = true;
			for (uint256 index = 0; index < userTalienBal; index++) {
				uint256 talienId = talien.tokenOfOwnerByIndex(_user, index);

				(uint256 itemId, uint256 seriesId, , , , ) = talien.items(talienId);

				// check if talien series is genesis series
				if (itemId == 1 && seriesId == 1) {
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
