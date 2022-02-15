// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155ReceiverUpgradeable.sol';
import '@openzeppelin/contracts/utils/Counters.sol';

import '../interfaces/IIngredientNFT.sol';
import '../interfaces/IBEP20.sol';

contract BaseMarketplace is
	AccessControlUpgradeable,
	ReentrancyGuardUpgradeable,
	ERC1155ReceiverUpgradeable
{
	using Counters for Counters.Counter;

	/*
   =======================================================================
   ======================== Structures ===================================
   =======================================================================
 */

	struct SaleInfo {
		address seller;
		address buyer;
		uint256 nftId;
		uint256 totalCopies;
		uint256 remainingCopies;
		uint256 sellingPrice;
		address currency; // Token address in which seller will get paid
		uint256 saleCreationTime;
		uint256 sellTimeStamp; // here, if sellTimeStamp is zero it means nft is available to purchase
		uint256 cancelTimeStamp;
	}

	struct AuctionInfo {
		uint256 nftId;
		bool isVipAuction;
		address sellerAddress;
		uint256 initialPrice; //base price for bid
		address currency;
		uint256 startBlock;
		uint256 duration;
		uint256 status; //Active = 1, Closed = 0, Canceled = 2
		uint256 winningBidId;
		uint256[] bidIds;
		uint256 cancelTimeStamp;
		uint256 buyTimestamp;
	}

	struct Bid {
		uint256 auctionId;
		address bidderAddress;
		uint256 bidAmount;
	}

	/*
   =======================================================================
   ======================== Constants ====================================
   =======================================================================
 */
	bytes32 public constant MINTER_ROLE = keccak256('MINTER_ROLE');
	bytes32 public constant OPERATOR_ROLE = keccak256('OPERATOR_ROLE');

	/*
   =======================================================================
   ======================== Private Variables ============================
   =======================================================================
 */
	Counters.Counter private saleIdCounter;
	Counters.Counter private auctionIdCounter;
	Counters.Counter private bidIdCounter;

	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */

	/// @notice ERC1155 NFT contract
	IIngredientNFT public nftContract;

	/// @notice minimum duration in seconds for auction period
	uint256 public minDuration;

	/// @notice saleId -> saleInfo
	mapping(uint256 => SaleInfo) public sale;

	/// @notice userAddress -> user`s sale ids
	mapping(address => uint256[]) public userSaleIds;

	/// @notice auctionId -> auctionInfo
	mapping(uint256 => AuctionInfo) public auction;

	/// @notice sellerAddress -> user`s auction ids
	mapping(address => uint256[]) public userAuctionIds;

	/// @notice sellerAddress -> user`s total auctions
	mapping(address => uint256) public userTotalAuctions;

	/// @notice sellerAddress -> user`s total sales
	mapping(address => uint256) public userTotalSales;

	/// @notice bidId -> Bid
	mapping(uint256 => Bid) public bid;

	/// @notice BidderAddress -> bidIds
	mapping(address => uint256[]) public userBidIds;

	/// @notice tokenAddress => supported or not
	mapping(address => bool) public supportedTokens;

	/// @notice sellerAddress -> user`s total bids
	mapping(address => uint256) public userTotalBids;

	/*
   =======================================================================
   ======================== Events =======================================
   =======================================================================
 */
	event NewNFTListing(address indexed seller, uint256 indexed saleId);
	event NFTAuction(address indexed seller, uint256 indexed auctionId);
	event BuySaleNFT(address indexed buyer, uint256 indexed nftId, uint256 saleId, uint256 date);
	event BuyAuctionNFT(address indexed buyer, uint256 indexed nftId, uint256 auctionId);
	event PlaceBid(
		uint256 indexed auctionId,
		uint256 indexed bidId,
		address indexed bidderAddress,
		uint256 bidAmount,
		uint256 time
	);

	/**
	 * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
	 * @param _nftContractAddress indicates the ERC1155 NFT contract address
	 */
	function __Marketplace_init(address _nftContractAddress) internal virtual initializer {
		__AccessControl_init();
		__ReentrancyGuard_init();
		__ERC1155Receiver_init();

		require(_nftContractAddress != address(0), 'Market: INVALID_NFT_CONTRACT');

		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
		_setupRole(MINTER_ROLE, _msgSender());

		nftContract = IIngredientNFT(_nftContractAddress);
		minDuration = 1 days;
	}

	/*
   =======================================================================
   ======================== Modifiers ====================================
   =======================================================================
 */
	modifier onlyOperator() {
		require(hasRole(OPERATOR_ROLE, _msgSender()), 'Market: ONLY_OPERATOR_CAN_CALL');
		_;
	}

	modifier onlySupportedTokens(address _tokenAddress) {
		require(supportedTokens[_tokenAddress], 'Market: UNSUPPORTED_TOKEN');
		_;
	}

	modifier onlyValidNftId(uint256 _nftId) {
		require(_nftId > 0 && _nftId <= nftContract.getCurrentNftId(), 'Market:INVALID_NFT_ID');
		_;
	}

	modifier onlyValidAuctionId(uint256 _auctionId) {
		require(
			_auctionId > 0 && _auctionId <= auctionIdCounter.current(),
			'Market: INVALID_AUCTION_ID'
		);

		_;
	}

	modifier onlyValidSaleId(uint256 _saleId) {
		require(_saleId > 0 && _saleId <= saleIdCounter.current(), 'Market: INVALID_SALE_ID');
		_;
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */

	/**
	 * @notice This method allows auction creator to update the auction starting price and extend the auction only if auction is ended with no bids.
	 * @param _auctionId indicates the id of auction whose details needs to update
	 * @param _newPrice indicates the new starting price for the auction.
	 * @param _timeExtension indicates the extended time for the auction. it can be zero if user only wants to update the auction price.
	 */
	function updateAuction(
		uint256 _auctionId,
		uint256 _newPrice,
		uint256 _timeExtension
	) external virtual onlyValidAuctionId(_auctionId) {
		AuctionInfo storage _auction = auction[_auctionId];
		require(msg.sender == _auction.sellerAddress, 'Market:ONLY_SELLER_CAN_UPDATE');
		require(_newPrice > 0 && _newPrice != _auction.initialPrice, 'Market: INVALID_INITIAL_PRICE');
		require(_auction.status == 1, 'Market: CANNOT_UPDATE_INACTIVE_AUCTION');
		require(_auction.bidIds.length == 0, 'Market: CANNOT_UPDATE_AUCTION_WITH_NON_ZERO_BIDS');

		_auction.duration = _auction.duration + _timeExtension;
		_auction.initialPrice = _newPrice;
	}

	/**
	 * @notice This method allows sale creator to update the sale starting price and extend the auction only if auction is ended with no bids.
	 * @param _saleId indicates the id of sale whose details needs to update
	 * @param _newPrice indicates the new starting price for the auction.
	 */
	function updateSale(uint256 _saleId, uint256 _newPrice)
		external
		virtual
		onlyValidSaleId(_saleId)
	{
		SaleInfo storage _sale = sale[_saleId];
		require(msg.sender == _sale.seller, 'Market:ONLY_SELLER_CAN_UPDATE');
		require(_sale.sellTimeStamp == 0, 'Market: SALE_ALREADY_ENDED');
		require(_newPrice > 0 && _newPrice != _sale.sellingPrice, 'Market: INVALID_SELLING_PRICE');
		_sale.sellingPrice = _newPrice;
	}

	/**
	 * @notice This method allows auction creator to move his NFT in sale only if auction is ended with zero bids.
	 * @param _auctionId indicates the auction id
	 * @param _sellingPrice indicates the fix selling price for the nft
	 * @return saleId - indicates the sale id in which nft will be available for sale.
	 */
	function moveNftInSale(uint256 _auctionId, uint256 _sellingPrice)
		external
		virtual
		onlyValidAuctionId(_auctionId)
		nonReentrant
		returns (uint256 saleId)
	{
		require(isActiveAuction(_auctionId), 'Market: CANNOT_MOVE_NFT_FROM_INACTIVE_AUCTION');
		require(_sellingPrice > 0, 'Market: INVALID_SELLING_PRICE');

		AuctionInfo storage _auction = auction[_auctionId];
		require(msg.sender == _auction.sellerAddress, 'Market: CALLER_NOT_THE_AUCTION_CREATOR');
		require(_auction.bidIds.length == 0, 'Market: CANNOT_UPDATE_AUCTION');

		//cancel the auction
		_auction.status = 2;

		//create sale
		saleId = _sellNFT(_auction.nftId, _sellingPrice, _auction.currency, 1, msg.sender);
	}

	/**
    * @notice This method allows anyone with accepted tokens to purchase the NFT from the particular sale. user needs to approve his ERC20/BEP20 tokens to this contract.
              buyer cannot buy/hold more than one copy of same nft.
    * @param _saleId indicates the saleId in from which buyer buys required NFT at specified price.
   */
	function buyNFT(uint256 _saleId) external virtual onlyValidSaleId(_saleId) nonReentrant {
		require(isActiveSale(_saleId), 'Market: CANNOT_BUY_FROM_INACTIVE_SALE');
		SaleInfo storage _sale = sale[_saleId];

		//transfer tokens to the seller
		require(
			IBEP20(_sale.currency).transferFrom(msg.sender, _sale.seller, _sale.sellingPrice),
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
		onlyValidAuctionId(_auctionId)
		nonReentrant
		returns (uint256 bidId)
	{
		bidId = _placeBid(_auctionId, _bidAmount, msg.sender);
	}

	/**
	 * @notice This method finds the winner of the Auction and transfer the nft to winning bidder and accepted tokens to the nft seller/owner
	 * @param _auctionId indicates the auctionId which is to be resolve
	 */
	function resolveAuction(uint256 _auctionId)
		external
		virtual
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

		// transfer the tokens to the auction creator
		require(
			IBEP20(_auction.currency).transfer(
				_auction.sellerAddress,
				bid[_auction.winningBidId].bidAmount
			),
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
	 * @notice This method allows operator to add the ERC20/BEP20 token which will be acceted for purchasing/selling NFT.
	 * @param _tokenAddress indicates the ERC20/BEP20 token address
	 */
	function addSupportedToken(address _tokenAddress) external virtual onlyOperator {
		require(!supportedTokens[_tokenAddress], 'Market: TOKEN_ALREADY_ADDED');
		supportedTokens[_tokenAddress] = true;
	}

	/**
	 * @notice This method allows operator to remove the ERC20/BEP20 token from the accepted token list.
	 * @param _tokenAddress indicates the ERC20/BEP20 token address
	 */
	function removeSupportedToken(address _tokenAddress) external virtual onlyOperator {
		require(supportedTokens[_tokenAddress], 'Market: TOKEN_DOES_NOT_EXISTS');
		supportedTokens[_tokenAddress] = false;
	}

	/**
	 * @notice This method allows operator to update minimum duration for the auction period.
	 * @param _newDuration indicates the new mint limit
	 */
	function updateMinimumDuration(uint256 _newDuration) external virtual onlyOperator {
		require(
			_newDuration > 0 && _newDuration != minDuration,
			'MintingStatoin: INVALID_MINIMUM_DURATION'
		);
		minDuration = _newDuration;
	}

	/*
   =======================================================================
   ======================== Getter Methods ===============================
   =======================================================================
 */

	/**
	 * @notice This method allows user to get the winning bid of the particular auction.
	 * @param _auctionId indicates the id of auction.
	 * @return returns the details of winning bid.
	 */
	function getAuctionWinningBid(uint256 _auctionId) external view virtual returns (Bid memory) {
		return bid[auction[_auctionId].winningBidId];
	}

	/**
	 * @notice This method returns the current sale Id
	 */
	function getCurrentSaleId() external view virtual returns (uint256) {
		return saleIdCounter.current();
	}

	/**
	 * @notice This method returns the current Auction Id
	 */
	function getCurrentAuctionId() external view virtual returns (uint256) {
		return auctionIdCounter.current();
	}

	/**
	 * @notice This method returns the current bid Id
	 */
	function getCurrentBidId() external view virtual returns (uint256) {
		return bidIdCounter.current();
	}

	/**
	 * @notice This method allows user to check if particular auction is acive or not.
	 * @param _auctionId indicates the auction id.
	 * @return isActive - returns true if auction is active false otherwise.
	 */
	function isActiveAuction(uint256 _auctionId) public view virtual returns (bool isActive) {
		return auction[_auctionId].status == 1;
	}

	/**
	 * @notice This method allows user to check if particular sale is acive or not.
	 * @param _saleId indicates the sale id.
	 * @return isActive - returns true if sale is active false otherwise.
	 */
	function isActiveSale(uint256 _saleId) public view virtual returns (bool isActive) {
		return
			sale[_saleId].sellTimeStamp == 0 &&
			sale[_saleId].remainingCopies > 0 &&
			sale[_saleId].cancelTimeStamp == 0;
	}

	/**
	 * @notice This method allows user to get the total bids placed on particular auction
	 * @param _auctionId - indicates the auction id
	 */
	function getTotalBidsOfAuction(uint256 _auctionId) external view virtual returns (uint256) {
		return auction[_auctionId].bidIds.length;
	}

	/*
   =======================================================================
   ======================== Internal Methods ===============================
   =======================================================================
 */

	function _sellNFT(
		uint256 _nftId,
		uint256 _nftPrice,
		address _tokenAddress,
		uint256 _amountOfCopies,
		address _user
	) internal virtual onlySupportedTokens(_tokenAddress) returns (uint256 saleId) {
		//create sale
		saleIdCounter.increment();

		saleId = saleIdCounter.current();

		sale[saleId] = SaleInfo(
			_user,
			address(0),
			_nftId,
			_amountOfCopies,
			_amountOfCopies,
			_nftPrice,
			_tokenAddress,
			block.timestamp,
			0,
			0
		);

		userSaleIds[_user].push(saleId);
		userTotalSales[_user] += 1;

		emit NewNFTListing(_user, saleId);
	}

	function _createAuction(
		uint256 _nftId,
		uint256 _initialPrice,
		address _tokenAddress,
		uint256 _duration,
		bool _isVipAuction,
		address _user
	) internal virtual onlySupportedTokens(_tokenAddress) returns (uint256 auctionId) {
		require(_duration >= minDuration, 'Market: INVALID_DURATION');

		//create Auction
		auctionIdCounter.increment();
		auctionId = auctionIdCounter.current();

		uint256[] memory bidIds;

		auction[auctionId] = AuctionInfo(
			_nftId,
			_isVipAuction,
			_user,
			_initialPrice,
			_tokenAddress,
			block.timestamp,
			_duration,
			1,
			0,
			bidIds,
			0,
			0
		);

		userAuctionIds[_user].push(auctionId);
		userTotalAuctions[_user] += 1;

		emit NFTAuction(_user, auctionId);
	}

	function _placeBid(
		uint256 _auctionId,
		uint256 _bidAmount,
		address _user
	) internal virtual returns (uint256 bidId) {
		require(isActiveAuction(_auctionId), 'Market: CANNOT_BID_ON_INACTIVE_AUCTION');
		require(tx.origin == _user, 'Market: ONLY_VALID_USERS');

		AuctionInfo storage _auction = auction[_auctionId];
		require(_auction.sellerAddress != _user, 'Market: OWNER_CANNOT_PLACE_BID');
		require(block.timestamp >= _auction.startBlock, 'Market: CANNOT_BID_BEFORE_AUCTION_STARTS');
		require(
			block.timestamp <= (_auction.startBlock + _auction.duration),
			'Market: CANNOT_BID_AFTER_AUCTION_ENDS'
		);

		if (_auction.bidIds.length == 0) {
			require(_bidAmount >= _auction.initialPrice, 'Market: INVALID_BID_AMOUNT');
		} else {
			require(_bidAmount > bid[_auction.winningBidId].bidAmount, 'Market: INVALID_BID_AMOUNT');
		}

		//transferFrom the tokens
		require(
			IBEP20(_auction.currency).transferFrom(_user, address(this), _bidAmount),
			'Market: TRANSFER_FROM_FAILED'
		);

		if (_auction.winningBidId != 0) {
			//transfer back the tokens to the previous winner
			require(
				IBEP20(_auction.currency).transfer(
					bid[_auction.winningBidId].bidderAddress,
					bid[_auction.winningBidId].bidAmount
				),
				'Market: TRANSFER_FAILED'
			);
		}
		//place bid
		bidIdCounter.increment();
		bidId = bidIdCounter.current();

		bid[bidId] = Bid(_auctionId, _user, _bidAmount);

		_auction.winningBidId = bidId;
		_auction.bidIds.push(bidId);

		userBidIds[_user].push(bidId);
		userTotalBids[_user] += 1;

		emit PlaceBid(_auctionId, bidId, _user, _bidAmount, block.timestamp);
	}

	function onERC1155Received(
		address,
		address,
		uint256,
		uint256,
		bytes memory
	) public virtual override returns (bytes4) {
		return this.onERC1155Received.selector;
	}

	function onERC1155BatchReceived(
		address,
		address,
		uint256[] memory,
		uint256[] memory,
		bytes memory
	) public virtual override returns (bytes4) {
		return this.onERC1155BatchReceived.selector;
	}

	/**
	 * @dev See {IERC165-supportsInterface}.
	 */
	function supportsInterface(bytes4 interfaceId)
		public
		view
		virtual
		override(ERC1155ReceiverUpgradeable, AccessControlUpgradeable)
		returns (bool)
	{
		return super.supportsInterface(interfaceId);
	}
}
