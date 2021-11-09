// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './BaseMarketplace.sol';

contract BaseMarketplaceWithRoyalties is BaseMarketplace {
	/*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

	/**
	 * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
	 * @param _nftContractAddress indicates the ERC1155 NFT contract address
	 */
	function __MarketplaceWithRoyalties_init(address _nftContractAddress)
		internal
		virtual
		initializer
	{
		__Marketplace_init(_nftContractAddress);
	}

	/**
    * @notice This method allows anyone with accepted tokens to purchase the NFT from the particular sale. user needs to approve his ERC20/BEP20 tokens to this contract.
              buyer cannot buy/hold more than one copy of same nft.
    * @param _saleId indicates the saleId in from which buyer buys required NFT at specified price.
   */
	function buyNFT(uint256 _saleId) external virtual onlyValidSaleId(_saleId) nonReentrant {
		require(isActiveSale(_saleId), 'Market: CANNOT_BUY_FROM_INACTIVE_SALE');
		SaleInfo storage _sale = sale[_saleId];

		// check the royalty amount
		(address royaltyReceiver, uint256 royaltyAmount) = nftContract.royaltyInfo(
			_sale.nftId,
			_sale.sellingPrice
		);

		uint256 sellerAmount = _sale.sellingPrice - royaltyAmount;

		//transfer tokens to the seller
		require(
			IBEP20(_sale.currency).transferFrom(msg.sender, _sale.seller, sellerAmount),
			'Market: TRANSFER_FROM_FAILED'
		);

		//transfer royaly amount to royalty receiver
		require(
			IBEP20(_sale.currency).transferFrom(msg.sender, royaltyReceiver, royaltyAmount),
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
	 * @notice This method finds the winner of the Auction and transfer the nft to winning bidder and accepted tokens to the nft seller/owner
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

		// check the royalty amount
		(address royaltyReceiver, uint256 royaltyAmount) = nftContract.royaltyInfo(
			_auction.nftId,
			bid[_auction.winningBidId].bidAmount
		);

		uint256 sellerAmount = bid[_auction.winningBidId].bidAmount - royaltyAmount;

		// transfer the tokens to the auction creator
		require(
			IBEP20(_auction.currency).transfer(_auction.sellerAddress, sellerAmount),
			'Market: TRANSFER_FAILED'
		);

		// transfer the royalty amount to the royaltyReceiver
		require(
			IBEP20(_auction.currency).transfer(royaltyReceiver, royaltyAmount),
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
}
