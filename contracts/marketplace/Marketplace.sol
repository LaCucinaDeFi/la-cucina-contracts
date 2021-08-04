// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/utils/Counters.sol';

import '../interfaces/INFT.sol';
import '../interfaces/IBEP20.sol';

contract Marketplace is AccessControlUpgradeable, ReentrancyGuardUpgradeable {
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
    uint256 sellTimeStamp; // here, if sellTimeStamp is zero it means nft is available to purchase
    uint256 cancelTimeStamp;
  }

  struct AuctionInfo {
    uint256 nftId;
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
  INFT public nftContract;

  uint256 public minDuration;

  /// @notice saleId -> saleInfo
  mapping(uint256 => SaleInfo) public sale;

  /// @notice userAddress -> user`s sale ids
  mapping(address => uint256[]) public userSaleIds;

  /// @notice auctionId -> auctionInfo
  mapping(uint256 => AuctionInfo) public auction;

  /// @notice sellerAddress -> user`s auction ids
  mapping(address => uint256[]) public userAuctionIds;

  /// @notice bidId -> Bid
  mapping(uint256 => Bid) public bid;

  /// @notice BidderAddress -> bidIds
  mapping(address => uint256[]) public userBidIds;

  /// @notice list of supported tokens
  address[] public supportedTokens;

  /*
   =======================================================================
   ======================== Events =======================================
   =======================================================================
 */
  event NewNFTListing(address indexed seller, uint256 indexed saleId);
  event NFTAuction(address indexed seller, uint256 indexed auctionId);
  event NFTBought(address indexed buyer, uint256 indexed nftId);

  /*
   =======================================================================
   ======================== Modifiers ====================================
   =======================================================================
 */
  modifier onlyAdmin() {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), 'Market: ONLY_ADMIN_CAN_CALL');
    _;
  }

  modifier onlySupportedTokens(address _tokenAddress) {
    (bool isSupported, ) = isSupportedToken(_tokenAddress);
    require(isSupported, 'Market: UNSUPPORTED_TOKEN');
    _;
  }

  modifier onlyValidAuctionId(uint256 _auctionId) {
    require(_auctionId > 0 && _auctionId <= auctionIdCounter.current(), 'Market: INVALID_AUCTION_ID');

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
   * @param _timeExtension indicates the extended time for the auction.
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
  function updateSale(uint256 _saleId, uint256 _newPrice) external virtual onlyValidSaleId(_saleId) {
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
    returns (uint256 saleId)
  {
    require(isActiveAuction(_auctionId), 'Market: CANNOT_MOVE_NFT_FROM_INACTIVE_AUCTION');

    AuctionInfo storage _auction = auction[_auctionId];
    require(msg.sender == _auction.sellerAddress, 'Market: CALLER_NOT_THE_AUCTION_CREATOR');
    require(_auction.bidIds.length == 0, 'Market: CANNOT_UPDATE_AUCTION');

    //cancel the auction
    _auction.status = 2;

    //create sale
    saleId = _sellNFT(_auction.nftId, _sellingPrice, _auction.currency, 1);
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
    IBEP20(_sale.currency).transferFrom(msg.sender, _sale.seller, _sale.sellingPrice);

    //transfer one nft to buyer
    nftContract.safeTransferFrom(address(this), msg.sender, _sale.nftId, 1, '');

    _sale.buyer = msg.sender;
    _sale.remainingCopies = _sale.remainingCopies - 1;

    //check if all copies of sale is sold
    if (_sale.remainingCopies == 0) {
      _sale.sellTimeStamp = block.timestamp;
    }

    emit NFTBought(msg.sender, _sale.nftId);
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
    returns (uint256 bidId)
  {
    require(isActiveAuction(_auctionId), 'Market: CANNOT_BID_ON_INACTIVE_AUCTION');
    AuctionInfo storage _auction = auction[_auctionId];
    require(_auction.sellerAddress != msg.sender, 'Market: OWNER_CANNOT_PLACE_BID');

    require(block.timestamp >= _auction.startBlock, 'Market: CANNOT_BID_BEFORE_AUCTION_STARTS');

    require(block.timestamp <= (_auction.startBlock + _auction.duration), 'Market: CANNOT_BID_AFTER_AUCTION_ENDS');

    if (_auction.bidIds.length == 0) {
      require(_bidAmount >= _auction.initialPrice, 'Market: INVALID_BID_AMOUNT');
    } else {
      require(_bidAmount > bid[_auction.winningBidId].bidAmount, 'Market: INVALID_BID_AMOUNT');
    }
    //transferFrom the tokens
    IBEP20(_auction.currency).transferFrom(msg.sender, address(this), _bidAmount);

    if (_auction.winningBidId != 0) {
      //transfer back the tokens to the previous winner
      IBEP20(_auction.currency).transfer(
        bid[_auction.winningBidId].bidderAddress,
        bid[_auction.winningBidId].bidAmount
      );
    }
    //place bid
    bidIdCounter.increment();
    bidId = bidIdCounter.current();

    bid[bidId].auctionId = _auctionId;
    bid[bidId].bidderAddress = msg.sender;
    bid[bidId].bidAmount = _bidAmount;

    _auction.winningBidId = bidId;
    _auction.bidIds.push(bidId);

    userBidIds[msg.sender].push(bidId);
  }

  /**
   * @notice This method finds the winner of the Auction and transfer the nft to winning bidder and accepted tokens to the nft seller/owner
   * @param _auctionId indicates the auctionId which is to be resolve
   */
  function resolveAuction(uint256 _auctionId) external virtual onlyValidAuctionId(_auctionId) nonReentrant {
    AuctionInfo storage _auction = auction[_auctionId];
    require(isActiveAuction(_auctionId), 'Market: CANNOT_RESOLVE_INACTIVE_AUCTION');
    require(block.timestamp > (_auction.startBlock + _auction.duration), 'Market: CANNOT_RESOLVE_DURING_AUCTION');
    require(_auction.winningBidId != 0 && _auction.bidIds.length > 0, 'Market: CANNOT_RESOLVE_AUCTION_WITH_NO_BIDS');

    IBEP20(_auction.currency).transfer(_auction.sellerAddress, bid[_auction.winningBidId].bidAmount);

    nftContract.safeTransferFrom(address(this), bid[_auction.winningBidId].bidderAddress, _auction.nftId, 1, '');

    //close auction
    _auction.status = 0;
    _auction.buyTimestamp = block.timestamp;
  }

  /**
   * @notice This method allows admin to add the ERC20/BEP20 token which will be acceted for purchasing/selling NFT.
   * @param _tokenAddress indicates the ERC20/BEP20 token address
   */
  function addSupportedToken(address _tokenAddress) external virtual onlyAdmin {
    (bool isSupported, ) = isSupportedToken(_tokenAddress);
    require(!isSupported, 'Market: TOKEN_ALREADY_ADDED');
    supportedTokens.push(_tokenAddress);
  }

  /**
   * @notice This method allows admin to remove the ERC20/BEP20 token from the accepted token list.
   * @param _tokenAddress indicates the ERC20/BEP20 token address
   */
  function removeSupportedToken(address _tokenAddress) external virtual onlyAdmin {
    (bool isSupported, uint256 index) = isSupportedToken(_tokenAddress);
    require(isSupported, 'Market: TOKEN_DOES_NOT_EXISTS');

    //remove supported token
    if (supportedTokens.length > 1) {
      address temp = supportedTokens[supportedTokens.length - 1];
      supportedTokens[index] = temp;
      supportedTokens.pop();
    } else {
      supportedTokens.pop();
    }
  }

  /**
   * @notice This method allow admin to update the ERC1155 NFT contract address.
   * @param _newAddress indicates the new address of NFT contract.
   */
  function updateNftContract(address _newAddress) external virtual onlyAdmin {
    require(_newAddress != address(nftContract) && _newAddress != address(0), 'Market: INVALID_CONTRACT_ADDRESS');
    nftContract = INFT(_newAddress);
  }

  /**
   * @notice This method allows admin to update minimum duration for the auction period.
   * @param _newDuration indicates the new mint limit
   */
  function updateMinimumDuration(uint256 _newDuration) external virtual onlyAdmin {
    require(_newDuration > 0 && _newDuration != minDuration, 'MintingStatoin: INVALID_MINIMUM_DURATION');
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
  function getAuctionWinningBid(uint256 _auctionId)
    external
    view
    virtual
    onlyValidAuctionId(_auctionId)
    returns (Bid memory)
  {
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
  function isActiveAuction(uint256 _auctionId)
    public
    view
    virtual
    onlyValidAuctionId(_auctionId)
    returns (bool isActive)
  {
    if (auction[_auctionId].status == 1) return true;
  }

  /**
   * @notice This method allows user to check if particular sale is acive or not.
   * @param _saleId indicates the sale id.
   * @return isActive - returns true if sale is active false otherwise.
   */
  function isActiveSale(uint256 _saleId) public view virtual onlyValidSaleId(_saleId) returns (bool isActive) {
    if (sale[_saleId].sellTimeStamp == 0 && sale[_saleId].remainingCopies > 0 && sale[_saleId].cancelTimeStamp == 0)
      return true;
  }

  /**
   * @notice This method allows user to check if particular token is supported to purchase the NFT or not.
   * @param _tokenAddress indicates EC20/BEP20 token address
   * @return isSupported - returns true if token is supported false otherwise. index - index of the supported token from the list of supported tokens
   */
  function isSupportedToken(address _tokenAddress) public view virtual returns (bool isSupported, uint256 index) {
    for (uint256 i = 0; i < supportedTokens.length; i++) {
      if (supportedTokens[i] == _tokenAddress) {
        isSupported = true;
        index = i;
        break;
      }
    }
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
    uint256 _amountOfCopies
  ) internal virtual onlySupportedTokens(_tokenAddress) returns (uint256 saleId) {
    //create sale
    saleIdCounter.increment();

    saleId = saleIdCounter.current();

    sale[saleId].seller = msg.sender;
    sale[saleId].nftId = _nftId;
    sale[saleId].sellingPrice = _nftPrice;
    sale[saleId].currency = _tokenAddress;
    sale[saleId].totalCopies = _amountOfCopies;
    sale[saleId].remainingCopies = _amountOfCopies;

    userSaleIds[msg.sender].push(saleId);

    emit NewNFTListing(msg.sender, saleId);
  }

  function _createAuction(
    uint256 _nftId,
    uint256 _initialPrice,
    address _tokenAddress,
    uint256 _duration
  ) internal virtual onlySupportedTokens(_tokenAddress) returns (uint256 auctionId) {
    require(_duration >= minDuration, 'Market: INVALID_DURATION');

    //create Auction
    auctionIdCounter.increment();
    auctionId = auctionIdCounter.current();

    auction[auctionId].nftId = _nftId;
    auction[auctionId].sellerAddress = msg.sender;
    auction[auctionId].initialPrice = _initialPrice;
    auction[auctionId].currency = _tokenAddress;
    auction[auctionId].startBlock = block.timestamp;
    auction[auctionId].duration = _duration;
    auction[auctionId].status = 1;

    userAuctionIds[msg.sender].push(auctionId);

    emit NFTAuction(msg.sender, auctionId);
  }
}
