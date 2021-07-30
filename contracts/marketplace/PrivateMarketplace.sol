// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155ReceiverUpgradeable.sol';
import './Marketplace.sol';

contract PrivateMarketplace is Initializable, ERC1155ReceiverUpgradeable, Marketplace {
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

    require(_nftContractAddress != address(0), 'PrivateMarketplace: INVALID_NFT_CONTRACT');

    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _setupRole(MINTER_ROLE, _msgSender());

    nftContract = INFT(_nftContractAddress);
    minDuration = 1 days;
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
   * @param _ipfsHash indicates the ipfs hash for the nft id which contains the metadata for the nft
   * @param _amountOfCopies indicates the no. of copies to create for the nft id
   * @return nftId - indicates the new id for the nft.  saleId - indicates saleId in which copies of new NFT are sold.
   */
  function createAndSellNFT(
    uint256 _nftPrice,
    address _tokenAddress,
    string memory _ipfsHash,
    uint256 _amountOfCopies
  ) external onlyMinter nonReentrant returns (uint256 nftId, uint256 saleId) {
    //create nft
    nftId = nftContract.mint(address(this), _ipfsHash, _amountOfCopies);
    //create sale
    saleId = _sellNFT(nftId, _nftPrice, _tokenAddress, _amountOfCopies);
  }

  /**
   * @notice This method allows minter to create a new unique NFT and put it in auction. only minter can call this method
   * @param _initialPrice indicates the startting price for the auction. all the bids should be greater than the initial price.
   * @param _tokenAddress indicates the the ERC20/BEP20 token address in which nft seller/owner wants to get paid in
   * @param _ipfsHash indicates the ipfs hash for the nft id which contains the metadata for the nft
   * @param _duration indicates the duration after which auction will get closed.
   * @return nftId - indicates the new id for the nft.  auctionId - indicates auctionId though which copy of new unique NFT are sold.
   */
  function createAndAuctionNFT(
    uint256 _initialPrice,
    address _tokenAddress,
    string memory _ipfsHash,
    uint256 _duration
  ) external onlyMinter nonReentrant returns (uint256 nftId, uint256 auctionId) {
    //create only one unique nft
    nftId = nftContract.mint(address(this), _ipfsHash, 1);

    //creating auction for one copy of nft.
    auctionId = _createAuction(nftId, _initialPrice, _tokenAddress, _duration);
  }

  /**
   * @notice This method allows minter to cancel the sale, burn the token and delete the sale data
   * @param _saleId indicates the sale id
   */
  function cancelSale(uint256 _saleId) external onlyValidSaleId(_saleId) {
    SaleInfo memory _sale = sale[_saleId];
    require(isActiveSale(_saleId), 'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_SALE');
    require(_sale.totalCopies == _sale.remainingCopies, 'PrivateMarketplace: CANNOT_CANCEL_SALE');
    require(msg.sender == _sale.seller, 'PrivateMarketplace:  ONLY_NFT_SELLER_CAN_CANCEL');

    //burn the token
    nftContract.burn(address(this), _sale.nftId, _sale.remainingCopies);

    //remove saleId from active sale ids of user
    _removeUserSaleId(_saleId);

    //delete sale data
    delete sale[_saleId];
  }

  /**
   * @notice This method allows minter to cancel the auction, burn the token and delete the auction data
   * @param _auctionId indicates the auction id
   */
  function cancelAuction(uint256 _auctionId) external onlyValidAuctionId(_auctionId) {
    AuctionInfo storage _auction = auction[_auctionId];

    require(isActiveAuction(_auctionId), 'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_AUCTION');
    require(_auction.sellerAddress == msg.sender, 'PrivateMarketplace: ONLY_NFT_SELLER_CAN_CANCEL');
    require(_auction.bidIds.length == 0, 'PrivateMarketplace: CANNOT_CANCEL_AUCTION');

    //burn the token
    nftContract.burn(address(this), _auction.nftId, 1);

    //delete auction data
    delete auction[_auctionId];
  }

  function _removeUserSaleId(uint256 _saleId) internal {
    uint256 saleIndex;
    for (saleIndex = 0; saleIndex < userSaleIds[msg.sender].length; saleIndex++) {
      if (userSaleIds[msg.sender][saleIndex] == _saleId) {
        break;
      }
    }

    if (userSaleIds[msg.sender].length > 1) {
      //swap auction with la st auction id and pop last auction id
      uint256 lastAuctionId = userSaleIds[msg.sender][userSaleIds[msg.sender].length - 1];
      userSaleIds[msg.sender][saleIndex] = lastAuctionId;
      userSaleIds[msg.sender].pop();
    } else {
      userSaleIds[msg.sender].pop();
    }
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
