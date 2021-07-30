require('chai').should();
const { expect } = require('chai');
const { expectRevert, ether, BN, time } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS, MAX_UINT256 } = require('@openzeppelin/test-helpers/src/constants');
const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');

const ERC1155NFT = artifacts.require('ERC1155NFT');
const PrivateMarketplace = artifacts.require('PrivateMarketplace');
const SampleToken = artifacts.require('SampleToken');

const url = 'https://token-cdn-domain/{id}.json';

contract('PrivateMarketplace', accounts => {
  const owner = accounts[0];
  const minter = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const user3 = accounts[4];

  beforeEach(async () => {
    // deploy nft token
    this.ERC1155NFT = await deployProxy(ERC1155NFT, [url], { initializer: 'initialize' });

    // deploy private marketplace
    this.privateMarketplace = await deployProxy(PrivateMarketplace, [this.ERC1155NFT.address], {
      initializer: 'initialize',
    });

    // deploy Lac token
    this.sampleToken = await SampleToken.new();

    // add supported token
    await this.privateMarketplace.addSupportedToken(this.sampleToken.address, { from: owner });

    // add privateMarket as minter in ERC1155 contract.
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    await this.ERC1155NFT.grantRole(minterRole, this.privateMarketplace.address);

    // add excepted address
    await this.ERC1155NFT.addExceptedAddress(this.privateMarketplace.address);

    // add minter in privateMarketplace
    await this.privateMarketplace.grantRole(minterRole, minter);

    // mint tokens to users
    await this.sampleToken.mint(user1, ether('10'), { from: owner });
    await this.sampleToken.mint(user2, ether('10'), { from: owner });
  });

  it('should initialize contract correctly', async () => {
    const minDuration = await this.privateMarketplace.minDuration();

    const nftContractAddress = await this.privateMarketplace.nftContract();

    expect(minDuration).to.bignumber.be.eq(new BN('86400'));
    expect(this.ERC1155NFT.address).to.be.eq(nftContractAddress);
  });

  it('should createAndSellNFT correctly', async () => {
    await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 10, { from: minter });

    const privateMarketNFTBal = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, '1');

    const currentNftId = await this.ERC1155NFT.getCurrentNftId();
    const currentSaleId = await this.privateMarketplace.getCurrentSaleId();

    const sale = await this.privateMarketplace.sale(currentSaleId);

    const userSaleIds = await this.privateMarketplace.userSaleIds(minter, 0);

    expect(sale.seller).to.be.eq(minter);
    expect(userSaleIds).to.bignumber.be.eq(new BN('1'));
    expect(currentNftId).to.bignumber.be.eq(new BN('1'));
    expect(currentSaleId).to.bignumber.be.eq(new BN('1'));
    expect(privateMarketNFTBal).to.bignumber.be.eq(new BN('10'));

    await expectRevert(
      this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 10, { from: user1 }),
      'PrivateMarketplace: MINTER_ROLE_REQUIRED',
    );
    await expectRevert(
      this.privateMarketplace.createAndSellNFT(ether('1'), ZERO_ADDRESS, url, 10, { from: minter }),
      'Market: UNSUPPORTED_TOKEN',
    );
  });

  it('should createAndAuctionNFT correctly', async () => {
    // create auction
    await this.privateMarketplace.createAndAuctionNFT(
      ether('1'),
      this.sampleToken.address,
      url,
      String(time.duration.days('2')),
      {
        from: minter,
      },
    );

    const privateMarketNFTBal = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, '1');

    const currentNftId = await this.ERC1155NFT.getCurrentNftId();
    const currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

    const auction = await this.privateMarketplace.auction(currentAuctionId);

    // todo -expect for userAuctionIds
    const userAuctionIds = await this.privateMarketplace.userAuctionIds(minter, 0);

    expect(currentNftId).to.bignumber.be.eq(new BN('1'));
    expect(currentAuctionId).to.bignumber.be.eq(new BN('1'));
    expect(privateMarketNFTBal).to.bignumber.be.eq(new BN('1'));

    await expectRevert(
      this.privateMarketplace.createAndAuctionNFT(
        ether('1'),
        this.sampleToken.address,
        url,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      ),
      'PrivateMarketplace: MINTER_ROLE_REQUIRED',
    );

    await expectRevert(
      this.privateMarketplace.createAndAuctionNFT(ether('1'), this.sampleToken.address, url, '100', {
        from: minter,
      }),
      'Market: INVALID_DURATION',
    );

    await expectRevert(
      this.privateMarketplace.createAndAuctionNFT(ether('1'), ZERO_ADDRESS, url, String(time.duration.days('2')), {
        from: minter,
      }),
      'Market: UNSUPPORTED_TOKEN',
    );
  });

  it('should update sale correctly', async () => {
    // create sale
    await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 1, { from: minter });

    const currentSaleId = await this.privateMarketplace.getCurrentSaleId();

    const saleBeforeUpdate = await this.privateMarketplace.sale(currentSaleId);

    // update sale
    await this.privateMarketplace.updateSale(currentSaleId, ether('2'), { from: minter });

    const saleAfterUpdate = await this.privateMarketplace.sale(currentSaleId);

    expect(saleBeforeUpdate.sellingPrice).to.bignumber.be.lt(saleAfterUpdate.sellingPrice);

    await expectRevert(
      this.privateMarketplace.updateSale(currentSaleId, ether('2'), { from: user1 }),
      'Market:ONLY_SELLER_CAN_UPDATE',
    );

    await expectRevert(
      this.privateMarketplace.updateSale(currentSaleId, ether('0'), { from: minter }),
      'Market: INVALID_SELLING_PRICE',
    );

    await expectRevert(
      this.privateMarketplace.updateSale(currentSaleId, ether('2'), { from: minter }),
      'Market: INVALID_SELLING_PRICE',
    );

    await expectRevert(this.privateMarketplace.updateSale(5, ether('5'), { from: minter }), 'Market: INVALID_SALE_ID');

    // buy nft from sale to close sale
    await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });
    await this.privateMarketplace.buyNFT(currentSaleId, { from: user1 });

    await expectRevert(
      this.privateMarketplace.updateSale(currentSaleId, ether('3'), { from: minter }),
      'Market: SALE_ALREADY_ENDED',
    );
  });

  it('should update auction correctly', async () => {
    // create auction
    await this.privateMarketplace.createAndAuctionNFT(
      ether('1'),
      this.sampleToken.address,
      url,
      String(time.duration.days('2')),
      {
        from: minter,
      },
    );

    const currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

    const auctionBefore = await this.privateMarketplace.auction(currentAuctionId);

    // update auction
    await this.privateMarketplace.updateAuction(currentAuctionId, ether('2'), String(time.duration.days('1')), {
      from: minter,
    });

    const auctionAfter = await this.privateMarketplace.auction(currentAuctionId);

    expect(auctionAfter.initialPrice).to.bignumber.be.eq(ether('2'));
    expect(auctionAfter.initialPrice).to.bignumber.be.gt(auctionBefore.initialPrice);
    expect(auctionAfter.duration).to.bignumber.be.eq(String(time.duration.days('3')));
    expect(auctionAfter.duration).to.bignumber.be.gt(auctionBefore.duration);

    await expectRevert(
      this.privateMarketplace.updateAuction(currentAuctionId, ether('3'), String(time.duration.days('1')), {
        from: user1,
      }),
      'Market:ONLY_SELLER_CAN_UPDATE',
    );

    await expectRevert(
      this.privateMarketplace.updateAuction(currentAuctionId, ether('0'), String(time.duration.days('1')), {
        from: minter,
      }),
      'Market: INVALID_INITIAL_PRICE',
    );

    await expectRevert(
      this.privateMarketplace.updateAuction(currentAuctionId, ether('2'), String(time.duration.days('1')), {
        from: minter,
      }),
      'Market: INVALID_INITIAL_PRICE',
    );

    await expectRevert(
      this.privateMarketplace.updateAuction(4, ether('5'), String(time.duration.days('1')), {
        from: minter,
      }),
      'Market: INVALID_AUCTION_ID',
    );

    // approve tokens
    await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });

    // place bid
    await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), { from: user1 });

    await expectRevert(
      this.privateMarketplace.updateAuction(currentAuctionId, ether('3'), String(time.duration.days('1')), {
        from: minter,
      }),
      'Market: CANNOT_UPDATE_AUCTION_WITH_NON_ZERO_BIDS',
    );

    // create new Auction
    await this.privateMarketplace.createAndAuctionNFT(
      ether('1'),
      this.sampleToken.address,
      url,
      String(time.duration.days('2')),
      {
        from: minter,
      },
    );

    // cancel auction
    await this.privateMarketplace.cancelAuction(2, { from: minter });

    await expectRevert(
      this.privateMarketplace.updateAuction(2, ether('3'), String(time.duration.days('1')), {
        from: minter,
      }),
      'Market:ONLY_SELLER_CAN_UPDATE',
    );
  });

  it('should cancelSale correctly', async () => {
    // create a sale
    await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 10, { from: minter });

    let currentNftId = await this.ERC1155NFT.getCurrentNftId();
    let currentSaleId = await this.privateMarketplace.getCurrentSaleId();
    const privateMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

    await expectRevert(
      this.privateMarketplace.cancelSale(currentSaleId, { from: user2 }),
      'PrivateMarketplace:  ONLY_NFT_SELLER_CAN_CANCEL',
    );

    // cancel sale
    await this.privateMarketplace.cancelSale(currentSaleId, { from: minter });

    let privateMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

    expect(privateMarketNFTBalBefore).to.bignumber.be.eq(new BN('10'));
    expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));

    // cancel the sale again
    await expectRevert(
      this.privateMarketplace.cancelSale(currentSaleId, { from: minter }),
      'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_SALE',
    );

    // create another sale
    await this.privateMarketplace.createAndSellNFT(ether('2'), this.sampleToken.address, url, 10, { from: minter });

    currentNftId = await this.ERC1155NFT.getCurrentNftId();
    currentSaleId = await this.privateMarketplace.getCurrentSaleId();

    await expectRevert(
      this.privateMarketplace.cancelSale(currentSaleId, { from: user2 }),
      'PrivateMarketplace:  ONLY_NFT_SELLER_CAN_CANCEL',
    );

    // approve tokens
    await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });
    // buy nft from sale
    await this.privateMarketplace.buyNFT(currentSaleId, { from: user1 });

    privateMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

    expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('9'));

    await expectRevert(
      this.privateMarketplace.cancelSale(currentSaleId, { from: minter }),
      'PrivateMarketplace: CANNOT_CANCEL_SALE',
    );
  });

  it('should cancelAuction correctly', async () => {
    // create auction
    await this.privateMarketplace.createAndAuctionNFT(
      ether('1'),
      this.sampleToken.address,
      url,
      String(time.duration.days('2')),
      {
        from: minter,
      },
    );

    let currentNftId = await this.ERC1155NFT.getCurrentNftId();
    let currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();
    let privateMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

    // cancel auction
    await this.privateMarketplace.cancelAuction(currentAuctionId, { from: minter });

    let privateMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

    expect(privateMarketNFTBalBefore).to.bignumber.be.eq(new BN('1'));
    expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));

    // cancel auction again
    await expectRevert(
      this.privateMarketplace.cancelAuction(currentAuctionId, { from: minter }),
      'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_AUCTION',
    );

    // create another auction
    await this.privateMarketplace.createAndAuctionNFT(
      ether('2'),
      this.sampleToken.address,
      url,
      String(time.duration.days('2')),
      {
        from: minter,
      },
    );

    currentNftId = await this.ERC1155NFT.getCurrentNftId();
    currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

    // approve tokens
    await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });

    // place bid
    await this.privateMarketplace.placeBid(currentAuctionId, ether('4'), { from: user1 });

    await expectRevert(
      this.privateMarketplace.cancelAuction(currentAuctionId, { from: minter }),
      'PrivateMarketplace: CANNOT_CANCEL_AUCTION',
    );

    await expectRevert(
      this.privateMarketplace.cancelAuction(currentAuctionId, { from: user2 }),
      'PrivateMarketplace: ONLY_NFT_SELLER_CAN_CANCEL',
    );

    privateMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

    // end auction
    await time.increase(String(time.duration.days('3')));

    // resolve auction
    await this.privateMarketplace.resolveAuction(currentAuctionId);
    privateMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

    expect(privateMarketNFTBalBefore).to.bignumber.be.eq(new BN('1'));
    expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));

    await expectRevert(
      this.privateMarketplace.cancelAuction(currentAuctionId, { from: minter }),
      'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_AUCTION',
    );
  });

  it('should buy nft from sale correctly', async () => {
    // create sale
    await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 1, { from: minter });

    const currentNftId = await this.ERC1155NFT.getCurrentNftId();
    const currentSaleId = await this.privateMarketplace.getCurrentSaleId();
    const privateMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

    // buy nft from sale to close sale
    await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });

    await this.privateMarketplace.buyNFT(currentSaleId, { from: user1 });

    const privateMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);
    const user1NFTBal = await this.ERC1155NFT.balanceOf(user1, currentNftId);

    expect(user1NFTBal).to.bignumber.be.eq(new BN('1'));
    expect(privateMarketNFTBalBefore).to.bignumber.be.eq(new BN('1'));
    expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));

    // cancel sale
    await expectRevert(
      this.privateMarketplace.cancelSale(currentSaleId, { from: minter }),
      'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_SALE',
    );

    await expectRevert(this.privateMarketplace.buyNFT(5, { from: user1 }), 'Market: INVALID_SALE_ID');
    await expectRevert(
      this.privateMarketplace.buyNFT(currentSaleId, { from: user1 }),
      'Market: CANNOT_BUY_FROM_INACTIVE_SALE',
    );
  });

  it('should move nft from auction to sale correctly', async () => {
    // create auction
    await this.privateMarketplace.createAndAuctionNFT(
      ether('1'),
      this.sampleToken.address,
      url,
      String(time.duration.days('2')),
      {
        from: minter,
      },
    );

    let currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

    // move nft from auction to sale
    await this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: minter });

    const auction = await this.privateMarketplace.auction(currentAuctionId);
    expect(auction.status).to.bignumber.be.eq(new BN('2'));

    const currentSaleId = await this.privateMarketplace.getCurrentSaleId();
    expect(currentSaleId).to.bignumber.be.eq(new BN('1'));

    const sale = await this.privateMarketplace.sale(currentSaleId);
    expect(sale.seller).to.be.eq(minter);

    // create another auction
    await this.privateMarketplace.createAndAuctionNFT(
      ether('1'),
      this.sampleToken.address,
      url,
      String(time.duration.days('2')),
      {
        from: minter,
      },
    );

    currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

    // approve tokens
    await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });

    // place bid
    await this.privateMarketplace.placeBid(currentAuctionId, ether('4'), { from: user1 });

    await expectRevert(
      this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: minter }),
      'Market: CANNOT_UPDATE_AUCTION',
    );

    await expectRevert(
      this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: user3 }),
      'Market: CALLER_NOT_THE_AUCTION_CREATOR',
    );

    // create another auction
    await this.privateMarketplace.createAndAuctionNFT(
      ether('1'),
      this.sampleToken.address,
      url,
      String(time.duration.days('2')),
      {
        from: minter,
      },
    );
    currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

    // cancel auction
    await this.privateMarketplace.cancelAuction(currentAuctionId, { from: minter });

    await expectRevert(
      this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: minter }),
      'Market: CANNOT_MOVE_NFT_FROM_INACTIVE_AUCTION',
    );
  });

  it('should add supported token correctly', async () => {
    const isSupportedBefore = await this.privateMarketplace.isSupportedToken(ZERO_ADDRESS);

    // add supported token
    await this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, { from: owner });

    const isSupportedAfter = await this.privateMarketplace.isSupportedToken(ZERO_ADDRESS);

    expect(isSupportedBefore[0]).to.be.eq(false);
    expect(isSupportedAfter[0]).to.be.eq(true);

    await expectRevert(
      this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, { from: owner }),
      'Market: TOKEN_ALREADY_ADDED',
    );

    await expectRevert(
      this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, { from: user2 }),
      'Market: ONLY_ADMIN_CAN_CALL',
    );
  });

  it('should remove supported token correctly', async () => {
    // add supported token
    await this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, { from: owner });

    const isSupportedBefore = await this.privateMarketplace.isSupportedToken(ZERO_ADDRESS);

    // remove supported token

    await this.privateMarketplace.removeSupportedToken(ZERO_ADDRESS, { from: owner });

    const isSupportedAfter = await this.privateMarketplace.isSupportedToken(ZERO_ADDRESS);

    expect(isSupportedBefore[0]).to.be.eq(true);
    expect(isSupportedAfter[0]).to.be.eq(false);

    await expectRevert(
      this.privateMarketplace.removeSupportedToken(ZERO_ADDRESS, { from: owner }),
      'Market: TOKEN_DOES_NOT_EXISTS',
    );

    await expectRevert(
      this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, { from: user2 }),
      'Market: ONLY_ADMIN_CAN_CALL',
    );
  });

  it('should update nft contract correctly', async () => {
    // update nft contract
    await this.privateMarketplace.updateNftContract(this.sampleToken.address, { from: owner });

    const nftContractAddress = await this.privateMarketplace.nftContract();

    expect(nftContractAddress).to.be.eq(this.sampleToken.address);
    await expectRevert(
      this.privateMarketplace.updateNftContract(this.sampleToken.address, { from: owner }),
      'Market: INVALID_CONTRACT_ADDRESS',
    );
    await expectRevert(
      this.privateMarketplace.updateNftContract(ZERO_ADDRESS, { from: owner }),
      'Market: INVALID_CONTRACT_ADDRESS',
    );

    await expectRevert(
      this.privateMarketplace.updateNftContract(this.ERC1155NFT.address, { from: user2 }),
      'Market: ONLY_ADMIN_CAN_CALL',
    );
  });

  it('should update minimumDuration correctly', async () => {
    // update minimum duration
    await this.privateMarketplace.updateMinimumDuration(String(time.duration.days('4')), { from: owner });
    const minDuration = await this.privateMarketplace.minDuration();

    expect(minDuration).to.bignumber.be.eq(new BN('345600'));

    await expectRevert(
      this.privateMarketplace.updateMinimumDuration(String(time.duration.days('4')), { from: owner }),
      'MintingStatoin: INVALID_MINIMUM_DURATION',
    );

    await expectRevert(
      this.privateMarketplace.updateMinimumDuration(String(time.duration.days('0')), { from: owner }),
      'MintingStatoin: INVALID_MINIMUM_DURATION',
    );

    await expectRevert(
      this.privateMarketplace.updateMinimumDuration(String(time.duration.days('3')), { from: user2 }),
      'Market: ONLY_ADMIN_CAN_CALL',
    );
  });

  describe('Bidding', () => {
    beforeEach(async () => {
      // create auction
      await this.privateMarketplace.createAndAuctionNFT(
        ether('1'),
        this.sampleToken.address,
        url,
        String(time.duration.days('2')),
        {
          from: minter,
        },
      );

      this.privateMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, '1');

      this.currentNftId = await this.ERC1155NFT.getCurrentNftId();
      this.currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();
    });

    it('should place bid correctly', async () => {
      await expectRevert(
        this.privateMarketplace.placeBid(this.currentAuctionId, ether('2'), { from: user1 }),
        'ERC20: transfer amount exceeds allowance',
      );

      // approve tokens
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });

      const user1BalanceBefore = await this.sampleToken.balanceOf(user1);

      // place bid for user1
      await this.privateMarketplace.placeBid(this.currentAuctionId, ether('2'), { from: user1 });

      let user1BalanceAfter = await this.sampleToken.balanceOf(user1);

      expect(user1BalanceBefore).to.bignumber.be.gt(user1BalanceAfter);
      expect(user1BalanceAfter).to.bignumber.be.eq(ether('8'));

      let auction = await this.privateMarketplace.auction(this.currentAuctionId);
      expect(auction.winningBidId).to.bignumber.be.eq(new BN('1'));

      const bid = await this.privateMarketplace.bid('1');

      expect(bid.bidAmount).to.bignumber.be.eq(ether('2'));
      expect(bid.bidderAddress).to.be.eq(user1);

      // approve tokens
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user2 });

      const user2BalBefore = await this.sampleToken.balanceOf(user2);

      // place bid for user2
      await this.privateMarketplace.placeBid(this.currentAuctionId, ether('3'), { from: user2 });

      const user2BalAfter = await this.sampleToken.balanceOf(user2);
      user1BalanceAfter = await this.sampleToken.balanceOf(user1);

      expect(user2BalBefore).to.bignumber.be.gt(user2BalAfter);
      expect(user2BalAfter).to.bignumber.be.eq(ether('7'));
      expect(user1BalanceAfter).to.bignumber.be.eq(ether('10'));

      auction = await this.privateMarketplace.auction(this.currentAuctionId);
      expect(auction.winningBidId).to.bignumber.be.eq(new BN('2'));

      await expectRevert(
        this.privateMarketplace.placeBid(this.currentAuctionId, ether('3'), { from: minter }),
        'Market: OWNER_CANNOT_PLACE_BID',
      );

      await expectRevert(
        this.privateMarketplace.placeBid(this.currentAuctionId, ether('3'), { from: user1 }),
        'Market: INVALID_BID_AMOUNT',
      );
      await expectRevert(
        this.privateMarketplace.placeBid(this.currentAuctionId, '500000000000000000', { from: user1 }),
        'Market: INVALID_BID_AMOUNT',
      );

      // advance time
      await time.increase(String(time.duration.days('3')));

      await expectRevert(
        this.privateMarketplace.placeBid(this.currentAuctionId, ether('5'), { from: user1 }),
        'Market: CANNOT_BID_AFTER_AUCTION_ENDS.',
      );

      // resolve auction
      await this.privateMarketplace.resolveAuction(this.currentAuctionId);

      await expectRevert(
        this.privateMarketplace.placeBid(this.currentAuctionId, ether('6'), { from: user2 }),
        'Market: CANNOT_BID_ON_INACTIVE_AUCTION',
      );
      await expectRevert(
        this.privateMarketplace.placeBid(5, ether('6'), { from: user2 }),
        'Market: INVALID_AUCTION_ID',
      );
    });

    it('should resolve auction correctly', async () => {
      // approve tokens
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });

      const user1BalanceBefore = await this.sampleToken.balanceOf(user1);

      // place bid for user1
      await this.privateMarketplace.placeBid(this.currentAuctionId, ether('2'), { from: user1 });

      let user1BalanceAfter = await this.sampleToken.balanceOf(user1);

      expect(user1BalanceBefore).to.bignumber.be.gt(user1BalanceAfter);
      expect(user1BalanceAfter).to.bignumber.be.eq(ether('8'));

      let auction = await this.privateMarketplace.auction(this.currentAuctionId);
      expect(auction.winningBidId).to.bignumber.be.eq(new BN('1'));

      const bid = await this.privateMarketplace.bid('1');
      expect(bid.bidAmount).to.bignumber.be.eq(ether('2'));
      expect(bid.bidderAddress).to.be.eq(user1);

      // approve tokens
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user2 });

      // place bid for user2
      await this.privateMarketplace.placeBid(this.currentAuctionId, ether('3'), { from: user2 });

      const user2BalAfter = await this.sampleToken.balanceOf(user2);
      user1BalanceAfter = await this.sampleToken.balanceOf(user1);

      expect(user2BalAfter).to.bignumber.be.eq(ether('7'));
      expect(user1BalanceAfter).to.bignumber.be.eq(ether('10'));

      auction = await this.privateMarketplace.auction(this.currentAuctionId);
      expect(auction.winningBidId).to.bignumber.be.eq(new BN('2'));

      await expectRevert(
        this.privateMarketplace.resolveAuction(this.currentAuctionId),
        'Market: CANNOT_RESOLVE_DURING_AUCTION',
      );

      // advance time to finish auction phase
      await time.increase(String(time.duration.days('3')));

      // resolve auction
      await this.privateMarketplace.resolveAuction(this.currentAuctionId);

      await expectRevert(
        this.privateMarketplace.resolveAuction(this.currentAuctionId),
        'Market: CANNOT_RESOLVE_INACTIVE_AUCTION',
      );

      // create another auction
      await this.privateMarketplace.createAndAuctionNFT(
        ether('1'),
        this.sampleToken.address,
        url,
        String(time.duration.days('2')),
        {
          from: minter,
        },
      );

      // advance time to finish auction phase
      await time.increase(String(time.duration.days('3')));

      await expectRevert(this.privateMarketplace.resolveAuction(2), 'Market: CANNOT_RESOLVE_AUCTION_WITH_NO_BIDS');
    });
  });

  describe('Getters', () => {
    beforeEach(async () => { });
    it('should get auction winning bid correctly', async () => {
      // create auction
      await this.privateMarketplace.createAndAuctionNFT(
        ether('1'),
        this.sampleToken.address,
        url,
        String(time.duration.days('2')),
        {
          from: minter,
        },
      );

      this.currentNftId = await this.ERC1155NFT.getCurrentNftId();
      this.currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

      // approve tokens
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });

      // place bid for user1
      await this.privateMarketplace.placeBid(this.currentAuctionId, ether('2'), { from: user1 });

      // get winning bid
      const bid = await this.privateMarketplace.getAuctionWinningBid(this.currentAuctionId);
      expect(bid.bidderAddress).to.be.eq(user1);

      await expectRevert(this.privateMarketplace.getAuctionWinningBid(5), 'Market: INVALID_AUCTION_ID');
    });

    it('should get current auction id correctly', async () => {
      // create auction
      await this.privateMarketplace.createAndAuctionNFT(
        ether('1'),
        this.sampleToken.address,
        url,
        String(time.duration.days('2')),
        {
          from: minter,
        },
      );

      this.currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

      expect(this.currentAuctionId).to.bignumber.be.eq(new BN('1'));
    });

    it('should get current bid id correctly', async () => {
      // create auction
      await this.privateMarketplace.createAndAuctionNFT(
        ether('1'),
        this.sampleToken.address,
        url,
        String(time.duration.days('2')),
        {
          from: minter,
        },
      );

      this.currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

      // approve tokens
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user2 });

      // place bid
      await this.privateMarketplace.placeBid(this.currentAuctionId, ether('2'), { from: user2 });

      // get current bidId
      const bidId = await this.privateMarketplace.getCurrentBidId();

      expect(bidId).to.bignumber.be.eq(new BN('1'));
    });

    it('should get current sale id correctly', async () => {
      // create sale
      await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 10, { from: minter });

      const currentSaleId = await this.privateMarketplace.getCurrentSaleId();
      expect(currentSaleId).to.bignumber.be.eq(new BN('1'));
    });

    it('should return isActiveAuction correctly', async () => {
      // create auction
      await this.privateMarketplace.createAndAuctionNFT(
        ether('1'),
        this.sampleToken.address,
        url,
        String(time.duration.days('2')),
        {
          from: minter,
        },
      );

      let isActive = await this.privateMarketplace.isActiveAuction('1');
      expect(isActive).to.be.eq(true);

      // cancel auction
      await this.privateMarketplace.cancelAuction('1', { from: minter });

      isActive = await this.privateMarketplace.isActiveAuction('1');
      expect(isActive).to.be.eq(false);

      await expectRevert(this.privateMarketplace.isActiveAuction('5'), 'Market: INVALID_AUCTION_ID');
    });
    it('should return isActiveSale correctly', async () => {
      // create sale
      await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 10, { from: minter });

      let isActive = await this.privateMarketplace.isActiveSale('1');

      expect(isActive).to.be.eq(true);

      // cancel sale
      await this.privateMarketplace.cancelSale('1', { from: minter });

      isActive = await this.privateMarketplace.isActiveSale('1');
      expect(isActive).to.be.eq(false);

      await expectRevert(this.privateMarketplace.isActiveSale('5'), 'Market: INVALID_SALE_ID');
    });
    it('should return isSupported token correctly', async () => {
      let isSupported = await this.privateMarketplace.isSupportedToken(this.sampleToken.address);
      expect(isSupported[0]).to.be.eq(true);

      await this.privateMarketplace.removeSupportedToken(this.sampleToken.address, { from: owner });

      isSupported = await this.privateMarketplace.isSupportedToken(this.sampleToken.address);
      expect(isSupported[0]).to.be.eq(false);
    });
  });
});
