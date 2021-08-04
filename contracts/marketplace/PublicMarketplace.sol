// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155ReceiverUpgradeable.sol';

import './Marketplace.sol';

contract PublicMarketplace is Initializable, ERC1155ReceiverUpgradeable, Marketplace {
  /*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

  /**
   * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
   * @param _nftContractAddress indicates the ERC1155 NFT contract address
   */
  function initialize(address _nftContractAddress) external initializer {
    __AccessControl_init();
    __ReentrancyGuard_init();

    require(_nftContractAddress != address(0), 'Market: INVALID_NFT_CONTRACT');

    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _setupRole(MINTER_ROLE, _msgSender());

    nftContract = INFT(_nftContractAddress);
    minDuration = 1 days;
  }

  /*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */

  /**
   * @notice This method allows the NFT owner/seller to sell his nft at a fix price. owner needs to approve his nft to this contract first. anyone with nft can call this method.
   * @param _nftId indicates the nft id which user wants to sell
   * @param _nftPrice indicates the fix price for the NFT at which user wants to sell his NFT.
   * @param _tokenAddress indicates the the ERC20/BEP20 token address in which nft seller/owner wants to get paid in
   * @return saleId - indicates the new sale id in which owners nft is sold
   */
  function sellNFT(
    uint256 _nftId,
    uint256 _nftPrice,
    address _tokenAddress
  ) external virtual nonReentrant returns (uint256 saleId) {
    require(_nftPrice > 0, 'PublicMarket: INVALID_NFT_PRICE');

    //get NFT tokens from seller
    nftContract.safeTransferFrom(msg.sender, address(this), _nftId, 1, '');
    saleId = _sellNFT(_nftId, _nftPrice, _tokenAddress, 1);
  }

  /**
   * @notice This method allows anyone with NFT to put his NFT in Auction.
   * @param _nftId indicates the NFT id for which user wants to creat auction.
   * @param _initialPrice indicates the startting price for the auction. all the bids should be greater than the initial price.
   * @param _tokenAddress indicates the the ERC20/BEP20 token address in which nft seller/owner wants to get paid in
   * @param _duration indicates the duration after which auction will get closed.
   * @return auctionId - indicates the auctionId in which owner puts his nft for sale.
   */
  function createNFTAuction(
    uint256 _nftId,
    uint256 _initialPrice,
    address _tokenAddress,
    uint256 _duration
  ) external virtual nonReentrant returns (uint256 auctionId) {
    require(_initialPrice > 0, 'PublicMarket: INVALID_INITIAL_NFT_PRICE');

    //get nft copy from sender and put it in auction
    nftContract.safeTransferFrom(msg.sender, address(this), _nftId, 1, '');

    auctionId = _createAuction(_nftId, _initialPrice, _tokenAddress, _duration);
  }

  /**
   * @notice This method allows NFT sale creator to cancel the sale and claim back the nft token
   * @param _saleId indicates the saleId which user wants to cancel
   */
  function cancelSaleAndClaimToken(uint256 _saleId) external virtual onlyValidSaleId(_saleId) nonReentrant {
    SaleInfo storage _sale = sale[_saleId];

    require(_sale.seller == msg.sender, 'PublicMarket: ONLY_SELLER_CAN_CANCEL');
    require(isActiveSale(_saleId), 'PublicMarket: CANNOT_CANCEL_INACTIVE_SALE');

    nftContract.safeTransferFrom(address(this), msg.sender, _sale.nftId, _sale.remainingCopies, '');

    _sale.remainingCopies = 0;
    _sale.cancelTimeStamp = block.timestamp;
  }

  /**
   * @notice This method allows auction creator to cancel the auction and claim back the nft. Auction can be cancel only if it does not have any bids.
   * @param _auctionId indicates the auctionId which user wants to cancel
   */
  function cancelAuctionAndClaimToken(uint256 _auctionId) external virtual onlyValidAuctionId(_auctionId) nonReentrant {
    AuctionInfo storage _auction = auction[_auctionId];

    require(isActiveAuction(_auctionId), 'PublicMarket: CANNOT_CANCEL_INACTIVE_AUCTION');
    require(_auction.sellerAddress == msg.sender, 'PublicMarket: ONLY_NFT_SELLER_CAN_CANCEL');
    require(_auction.bidIds.length == 0, 'PublicMarket: CANNOT_CANCEL_AUCTION_WITH_NON_ZERO_BIDS');

    nftContract.safeTransferFrom(address(this), msg.sender, _auction.nftId, 1, '');

    _auction.status = 2;
    _auction.cancelTimeStamp = block.timestamp;
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
