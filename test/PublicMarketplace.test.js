require('chai').should();
const { expect } = require('chai');
const { expectRevert, ether, BN, time } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS, MAX_UINT256 } = require('@openzeppelin/test-helpers/src/constants');
const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');

const ERC1155NFT = artifacts.require('ERC1155NFT');
const PrivateMarketplace = artifacts.require('PrivateMarketplace');
const PublicMarketplace = artifacts.require('PublicMarketplace');

const SampleToken = artifacts.require('SampleToken');

const uri = 'https://token-cdn-domain/{id}.json';

contract('PublicMarketplace', accounts => {
  const owner = accounts[0];
  const minter = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const user3 = accounts[4];

  beforeEach(async () => {
    // deploy nft token
    this.ERC1155NFT = await deployProxy(ERC1155NFT, [uri], { initializer: 'initialize' });

    // deploy private marketplace
    this.privateMarketplace = await deployProxy(PrivateMarketplace, [this.ERC1155NFT.address], {
      initializer: 'initialize',
    });

    // deploy Public marketplace
    this.publicMarketplace = await deployProxy(PublicMarketplace, [this.ERC1155NFT.address], {
      initializer: 'initialize',
    });

    // deploy Lac token
    this.sampleToken = await SampleToken.new();

    // add supported token
    await this.privateMarketplace.addSupportedToken(this.sampleToken.address);
    await this.publicMarketplace.addSupportedToken(this.sampleToken.address);

    // add privateMarket as minter in ERC1155 contract.
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    await this.ERC1155NFT.grantRole(minterRole, this.privateMarketplace.address);

    // add excepted address
    await this.ERC1155NFT.addExceptedAddress(this.privateMarketplace.address);
    // add excepted address
    await this.ERC1155NFT.addExceptedAddress(this.publicMarketplace.address);

    // add minter in privateMarketplace
    await this.privateMarketplace.grantRole(minterRole, minter);

    // add minter in publicMarketplace
    await this.publicMarketplace.grantRole(minterRole, minter);

    // mint tokens to users
    await this.sampleToken.mint(user1, ether('10'));
    await this.sampleToken.mint(user2, ether('10'));
    await this.sampleToken.mint(user3, ether('10'));
  });

  it('should initialize contract correctly', async () => {
    const minDuration = await this.publicMarketplace.minDuration();
    const nftContractAddress = await this.publicMarketplace.nftContract();

    expect(minDuration).to.bignumber.be.eq(new BN('86400'));
    expect(this.ERC1155NFT.address).to.be.eq(nftContractAddress);
  });

  describe('public market sale', () => {
    beforeEach(async () => {
      // create nft sale
      await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, uri, 10, { from: minter });

      this.currentNftId = await this.ERC1155NFT.getCurrentNftId();
      this.currentSaleId = await this.privateMarketplace.getCurrentSaleId();

      // buy nft from sale to close sale
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });

      // buy nft from sale
      await this.privateMarketplace.buyNFT(this.currentSaleId, { from: user1 });

      this.user1NftBal = await this.ERC1155NFT.balanceOf(user1, this.currentNftId);

      // approve nft to PublicMarketplace contract
      await this.ERC1155NFT.setApprovalForAll(this.publicMarketplace.address, true, { from: user1 });
    });

    it('should create a sale correctly', async () => {
      await expectRevert(
        this.publicMarketplace.sellNFT(this.currentNftId, ether('2'), ZERO_ADDRESS, { from: user1 }),
        'Market: UNSUPPORTED_TOKEN',
      );

      // create sale for the nft
      await this.publicMarketplace.sellNFT(this.currentNftId, ether('2'), this.sampleToken.address, { from: user1 });

      const publicMarketNFTBal = await this.ERC1155NFT.balanceOf(this.publicMarketplace.address, this.currentNftId);
      const user1NftBalAfter = await this.ERC1155NFT.balanceOf(user1, this.currentNftId);

      const currentSaleId = await this.publicMarketplace.getCurrentSaleId();

      const sale = await this.publicMarketplace.sale(currentSaleId);

      const userSaleIds = await this.publicMarketplace.userSaleIds(user1, 0);

      expect(this.currentNftId).to.bignumber.be.eq(new BN('1'));
      expect(this.currentSaleId).to.bignumber.be.eq(new BN('1'));
      expect(publicMarketNFTBal).to.bignumber.be.eq(new BN('1'));
      expect(this.user1NftBal).to.bignumber.be.eq(new BN('1'));
      expect(user1NftBalAfter).to.bignumber.be.eq(new BN('0'));
    });

    it('should create auction correctly', async () => {
      await expectRevert(
        this.publicMarketplace.createNFTAuction(
          this.currentNftId,
          ether('1'),
          ZERO_ADDRESS,
          String(time.duration.days('2')),
          {
            from: user1,
          },
        ),
        'Market: UNSUPPORTED_TOKEN',
      );

      await expectRevert(
        this.publicMarketplace.createNFTAuction(this.currentNftId, ether('1'), this.sampleToken.address, '100', {
          from: user1,
        }),
        'Market: INVALID_DURATION',
      );

      // create auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      const publicMarketNFTBal = await this.ERC1155NFT.balanceOf(this.publicMarketplace.address, this.currentNftId);
      const user1NftBalAfter = await this.ERC1155NFT.balanceOf(user1, this.currentNftId);

      const currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      const auction = await this.publicMarketplace.auction(currentAuctionId);
      const userAuctionIds = await this.publicMarketplace.userAuctionIds(user1, 0);

      expect(auction.sellerAddress).to.be.eq(user1);
      expect(userAuctionIds).to.bignumber.be.eq(new BN('1'));
      expect(currentAuctionId).to.bignumber.be.eq(new BN('1'));
      expect(publicMarketNFTBal).to.bignumber.be.eq(new BN('1'));
      expect(user1NftBalAfter).to.bignumber.be.eq(new BN('0'));
    });

    it('should update sale correctly', async () => {
      // create sale for the nft
      await this.publicMarketplace.sellNFT(this.currentNftId, ether('1'), this.sampleToken.address, { from: user1 });

      const currentSaleId = await this.publicMarketplace.getCurrentSaleId();

      const saleBeforeUpdate = await this.publicMarketplace.sale(currentSaleId);

      // update sale
      await this.publicMarketplace.updateSale(currentSaleId, ether('2'), { from: user1 });

      const saleAfterUpdate = await this.publicMarketplace.sale(currentSaleId);

      expect(saleBeforeUpdate.sellingPrice).to.bignumber.be.lt(saleAfterUpdate.sellingPrice);
      expect(saleAfterUpdate.sellingPrice).to.bignumber.be.eq(ether('2'));

      await expectRevert(
        this.publicMarketplace.updateSale(currentSaleId, ether('2'), { from: user2 }),
        'Market:ONLY_SELLER_CAN_UPDATE',
      );

      await expectRevert(
        this.publicMarketplace.updateSale(currentSaleId, ether('0'), { from: user1 }),
        'Market: INVALID_SELLING_PRICE',
      );

      await expectRevert(
        this.publicMarketplace.updateSale(currentSaleId, ether('2'), { from: user1 }),
        'Market: INVALID_SELLING_PRICE',
      );

      await expectRevert(this.publicMarketplace.updateSale(5, ether('5'), { from: user1 }), 'Market: INVALID_SALE_ID');

      // buy nft from sale to close sale
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user2 });
      await this.publicMarketplace.buyNFT(currentSaleId, { from: user2 });

      await expectRevert(
        this.publicMarketplace.updateSale(currentSaleId, ether('3'), { from: user1 }),
        'Market: SALE_ALREADY_ENDED',
      );
    });

    it('should update auction correctly', async () => {
      // create auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      let currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      const auctionBefore = await this.publicMarketplace.auction(currentAuctionId);

      // update auction
      await this.publicMarketplace.updateAuction(currentAuctionId, ether('2'), String(time.duration.days('1')), {
        from: user1,
      });

      const auctionAfter = await this.publicMarketplace.auction(currentAuctionId);

      expect(auctionAfter.initialPrice).to.bignumber.be.eq(ether('2'));
      expect(auctionAfter.initialPrice).to.bignumber.be.gt(auctionBefore.initialPrice);
      expect(auctionAfter.duration).to.bignumber.be.eq(String(time.duration.days('3')));
      expect(auctionAfter.duration).to.bignumber.be.gt(auctionBefore.duration);

      await expectRevert(
        this.publicMarketplace.updateAuction(currentAuctionId, ether('3'), String(time.duration.days('1')), {
          from: user2,
        }),
        'Market:ONLY_SELLER_CAN_UPDATE',
      );

      await expectRevert(
        this.publicMarketplace.updateAuction(currentAuctionId, ether('0'), String(time.duration.days('1')), {
          from: user1,
        }),
        'Market: INVALID_INITIAL_PRICE',
      );

      await expectRevert(
        this.publicMarketplace.updateAuction(currentAuctionId, ether('2'), String(time.duration.days('1')), {
          from: user1,
        }),
        'Market: INVALID_INITIAL_PRICE',
      );

      await expectRevert(
        this.publicMarketplace.updateAuction(4, ether('5'), String(time.duration.days('1')), {
          from: user1,
        }),
        'Market: INVALID_AUCTION_ID',
      );

      // approve tokens
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user2 });

      // place bid
      await this.publicMarketplace.placeBid(currentAuctionId, ether('2'), { from: user2 });

      await expectRevert(
        this.publicMarketplace.updateAuction(currentAuctionId, ether('3'), String(time.duration.days('1')), {
          from: user1,
        }),
        'Market: CANNOT_UPDATE_AUCTION_WITH_NON_ZERO_BIDS',
      );

      // buy nft from sale
      await this.privateMarketplace.buyNFT(this.currentSaleId, { from: user1 });

      // create new Auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      // cancel auction
      await this.publicMarketplace.cancelAuctionAndClaimToken(currentAuctionId, { from: user1 });

      await expectRevert(
        this.publicMarketplace.updateAuction(currentAuctionId, ether('3'), String(time.duration.days('1')), {
          from: user1,
        }),
        'Market: CANNOT_UPDATE_INACTIVE_AUCTION',
      );
    });

    it('should cancel sale and Claim NFT correctly', async () => {
      // create sale for the nft
      await this.publicMarketplace.sellNFT(this.currentNftId, ether('1'), this.sampleToken.address, { from: user1 });

      const currentSaleId = await this.publicMarketplace.getCurrentSaleId();

      const publicMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(
        this.publicMarketplace.address,
        this.currentNftId,
      );

      const user1NFTBalBefore = await this.ERC1155NFT.balanceOf(user1, this.currentNftId);

      // cancel sale
      await this.publicMarketplace.cancelSaleAndClaimToken(currentSaleId, { from: user1 });

      const publicMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(
        this.publicMarketplace.address,
        this.currentNftId,
      );
      const user1NFTBalAfter = await this.ERC1155NFT.balanceOf(user1, this.currentNftId);

      expect(publicMarketNFTBalBefore).to.bignumber.be.eq(new BN('1'));
      expect(publicMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));
      expect(user1NFTBalBefore).to.bignumber.be.eq(new BN('0'));
      expect(user1NFTBalAfter).to.bignumber.be.eq(new BN('1'));

      // cancel the sale again
      await expectRevert(
        this.publicMarketplace.cancelSaleAndClaimToken(currentSaleId, { from: user1 }),
        'PublicMarket: CANNOT_CANCEL_INACTIVE_SALE',
      );

      await expectRevert(
        this.publicMarketplace.cancelSaleAndClaimToken(currentSaleId, { from: minter }),
        'PublicMarket: ONLY_SELLER_CAN_CANCEL',
      );

      await expectRevert(this.publicMarketplace.cancelSaleAndClaimToken(4, { from: user1 }), 'Market: INVALID_SALE_ID');
    });

    it('should cancel auction and claim token correctly', async () => {
      // create auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      let currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();
      const publicMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(
        this.publicMarketplace.address,
        this.currentNftId,
      );
      const user1NFTBalBefore = await this.ERC1155NFT.balanceOf(user1, this.currentNftId);

      // cancel auction
      await this.publicMarketplace.cancelAuctionAndClaimToken(currentAuctionId, { from: user1 });

      const publicMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(
        this.publicMarketplace.address,
        this.currentNftId,
      );
      const user1NFTBalAfter = await this.ERC1155NFT.balanceOf(user1, this.currentNftId);

      expect(publicMarketNFTBalBefore).to.bignumber.be.eq(new BN('1'));
      expect(publicMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));
      expect(user1NFTBalBefore).to.bignumber.be.eq(new BN('0'));
      expect(user1NFTBalAfter).to.bignumber.be.eq(new BN('1'));

      // cancel auction again
      await expectRevert(
        this.publicMarketplace.cancelAuctionAndClaimToken(currentAuctionId, { from: minter }),
        'PublicMarket: CANNOT_CANCEL_INACTIVE_AUCTION',
      );

      // create another auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      this.currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      // approve tokens
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user2 });

      // place bid
      await this.publicMarketplace.placeBid(currentAuctionId, ether('4'), { from: user2 });

      await expectRevert(
        this.publicMarketplace.cancelAuctionAndClaimToken(currentAuctionId, { from: user1 }),
        'PublicMarket: CANNOT_CANCEL_AUCTION_WITH_NON_ZERO_BIDS',
      );

      await expectRevert(
        this.publicMarketplace.cancelAuctionAndClaimToken(currentAuctionId, { from: user2 }),
        'PublicMarket: ONLY_NFT_SELLER_CAN_CANCEL',
      );
    });

    it('should buy nft from sale correctly', async () => {
      // create sale for the nft
      await this.publicMarketplace.sellNFT(this.currentNftId, ether('1'), this.sampleToken.address, { from: user1 });

      const currentSaleId = await this.publicMarketplace.getCurrentSaleId();
      const publicMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(
        this.publicMarketplace.address,
        this.currentNftId,
      );

      // buy nft from sale to close sale
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user2 });

      const user2NFTBalBefore = await this.ERC1155NFT.balanceOf(user2, this.currentNftId);

      await this.publicMarketplace.buyNFT(currentSaleId, { from: user2 });

      const publicMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(
        this.publicMarketplace.address,
        this.currentNftId,
      );
      const user2NFTBal = await this.ERC1155NFT.balanceOf(user2, this.currentNftId);

      expect(user2NFTBalBefore).to.bignumber.be.eq(new BN('0'));
      expect(user2NFTBal).to.bignumber.be.eq(new BN('1'));
      expect(publicMarketNFTBalBefore).to.bignumber.be.eq(new BN('1'));
      expect(publicMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));

      await expectRevert(this.publicMarketplace.buyNFT(5, { from: user2 }), 'Market: INVALID_SALE_ID');
      await expectRevert(
        this.publicMarketplace.buyNFT(currentSaleId, { from: user1 }),
        'Market: CANNOT_BUY_FROM_INACTIVE_SALE',
      );
    });

    it('should move nft from auction to sale correctly', async () => {
      // create auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      let currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      // move nft from auction to sale
      await this.publicMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: user1 });

      const auction = await this.publicMarketplace.auction(currentAuctionId);

      expect(auction.status).to.bignumber.be.eq(new BN('2'));

      const currentSaleId = await this.publicMarketplace.getCurrentSaleId();
      expect(currentSaleId).to.bignumber.be.eq(new BN('1'));

      const sale = await this.publicMarketplace.sale(currentSaleId);
      expect(sale.seller).to.be.eq(user1);

      // buy nft from sale
      await this.privateMarketplace.buyNFT(this.currentSaleId, { from: user1 });

      // create another auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      // approve tokens
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user2 });

      // place bid
      await this.publicMarketplace.placeBid(currentAuctionId, ether('4'), { from: user2 });

      await expectRevert(
        this.publicMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: user1 }),
        'Market: CANNOT_UPDATE_AUCTION',
      );

      await expectRevert(
        this.publicMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: user3 }),
        'Market: CALLER_NOT_THE_AUCTION_CREATOR',
      );

      await expectRevert(
        this.publicMarketplace.createNFTAuction(
          this.currentNftId,
          ether('1'),
          this.sampleToken.address,
          String(time.duration.days('2')),
          {
            from: user1,
          },
        ),
        'ERC1155: insufficient balance for transfer',
      );

      // buy nft from sale
      await this.privateMarketplace.buyNFT(this.currentSaleId, { from: user1 });

      // create another auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );
      currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      // cancel auction
      await this.publicMarketplace.cancelAuctionAndClaimToken(currentAuctionId, { from: user1 });

      await expectRevert(
        this.publicMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: user1 }),
        'Market: CANNOT_MOVE_NFT_FROM_INACTIVE_AUCTION',
      );

      await expectRevert(
        this.publicMarketplace.moveNftInSale(5, ether('2'), { from: user1 }),
        'Market: INVALID_AUCTION_ID',
      );
    });
  });

  it('should add supported token correctly', async () => {
    const isSupportedBefore = await this.publicMarketplace.isSupportedToken(ZERO_ADDRESS);

    // add supported token
    await this.publicMarketplace.addSupportedToken(ZERO_ADDRESS, { from: owner });

    const isSupportedAfter = await this.publicMarketplace.isSupportedToken(ZERO_ADDRESS);

    expect(isSupportedBefore[0]).to.be.eq(false);
    expect(isSupportedAfter[0]).to.be.eq(true);

    await expectRevert(
      this.publicMarketplace.addSupportedToken(ZERO_ADDRESS, { from: owner }),
      'Market: TOKEN_ALREADY_ADDED',
    );

    await expectRevert(
      this.publicMarketplace.addSupportedToken(ZERO_ADDRESS, { from: user2 }),
      'Market: ONLY_ADMIN_CAN_CALL',
    );
  });

  it('should remove supported token correctly', async () => {
    // add supported token
    await this.publicMarketplace.addSupportedToken(ZERO_ADDRESS, { from: owner });

    const isSupportedBefore = await this.publicMarketplace.isSupportedToken(ZERO_ADDRESS);

    // remove supported token

    await this.publicMarketplace.removeSupportedToken(ZERO_ADDRESS, { from: owner });

    const isSupportedAfter = await this.publicMarketplace.isSupportedToken(ZERO_ADDRESS);

    expect(isSupportedBefore[0]).to.be.eq(true);
    expect(isSupportedAfter[0]).to.be.eq(false);

    await expectRevert(
      this.publicMarketplace.removeSupportedToken(ZERO_ADDRESS, { from: owner }),
      'Market: TOKEN_DOES_NOT_EXISTS',
    );

    await expectRevert(
      this.publicMarketplace.addSupportedToken(ZERO_ADDRESS, { from: user2 }),
      'Market: ONLY_ADMIN_CAN_CALL',
    );
  });

  it('should update nft contract correctly', async () => {
    // update nft contract
    await this.publicMarketplace.updateNftContract(this.sampleToken.address, { from: owner });

    const nftContractAddress = await this.publicMarketplace.nftContract();

    expect(nftContractAddress).to.be.eq(this.sampleToken.address);
    await expectRevert(
      this.publicMarketplace.updateNftContract(this.sampleToken.address, { from: owner }),
      'Market: INVALID_CONTRACT_ADDRESS',
    );
    await expectRevert(
      this.publicMarketplace.updateNftContract(ZERO_ADDRESS, { from: owner }),
      'Market: INVALID_CONTRACT_ADDRESS',
    );

    await expectRevert(
      this.publicMarketplace.updateNftContract(this.ERC1155NFT.address, { from: user2 }),
      'Market: ONLY_ADMIN_CAN_CALL',
    );
  });

  it('should update minimumDuration correctly', async () => {
    // update minimum duration
    await this.publicMarketplace.updateMinimumDuration(String(time.duration.days('4')), { from: owner });
    const minDuration = await this.publicMarketplace.minDuration();

    expect(minDuration).to.bignumber.be.eq(new BN('345600'));
    await expectRevert(
      this.publicMarketplace.updateMinimumDuration(String(time.duration.days('4')), { from: owner }),
      'MintingStatoin: INVALID_MINIMUM_DURATION',
    );

    await expectRevert(
      this.publicMarketplace.updateMinimumDuration(String(time.duration.days('0')), { from: owner }),
      'MintingStatoin: INVALID_MINIMUM_DURATION',
    );

    await expectRevert(
      this.publicMarketplace.updateMinimumDuration(String(time.duration.days('3')), { from: user2 }),
      'Market: ONLY_ADMIN_CAN_CALL',
    );
  });

  describe('Bidding', () => {
    beforeEach(async () => {
      // create nft sale
      await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, uri, 10, { from: minter });

      this.currentNftId = await this.ERC1155NFT.getCurrentNftId();
      this.currentSaleId = await this.privateMarketplace.getCurrentSaleId();

      // buy nft from sale to close sale
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });

      // buy nft from sale
      await this.privateMarketplace.buyNFT(this.currentSaleId, { from: user1 });

      this.user1NftBal = await this.ERC1155NFT.balanceOf(user1, this.currentNftId);

      // approve nft to PublicMarketplace contract
      await this.ERC1155NFT.setApprovalForAll(this.publicMarketplace.address, true, { from: user1 });

      // create auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      this.currentNftId = await this.ERC1155NFT.getCurrentNftId();
      this.currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();
      this.publicMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(
        this.publicMarketplace.address,
        this.currentNftId,
      );
    });

    it('should place bid correctly', async () => {
      await expectRevert(
        this.publicMarketplace.placeBid(this.currentAuctionId, ether('2'), { from: user2 }),
        'ERC20: transfer amount exceeds allowance',
      );

      // approve tokens
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user2 });

      const user2BalanceBefore = await this.sampleToken.balanceOf(user2);

      // place bid for user2
      await this.publicMarketplace.placeBid(this.currentAuctionId, ether('2'), { from: user2 });

      let user2BalanceAfter = await this.sampleToken.balanceOf(user2);

      expect(user2BalanceBefore).to.bignumber.be.eq(ether('10'));
      expect(user2BalanceAfter).to.bignumber.be.eq(ether('8'));

      let auction = await this.publicMarketplace.auction(this.currentAuctionId);

      expect(auction.winningBidId).to.bignumber.be.eq(new BN('1'));

      const bid = await this.publicMarketplace.bid('1');

      expect(bid.bidAmount).to.bignumber.be.eq(ether('2'));
      expect(bid.bidderAddress).to.be.eq(user2);

      // approve tokens
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user3 });

      const user3BalBefore = await this.sampleToken.balanceOf(user3);

      // place bid for user3
      await this.publicMarketplace.placeBid(this.currentAuctionId, ether('3'), { from: user3 });

      const user3BalAfter = await this.sampleToken.balanceOf(user3);
      user2BalanceAfter = await this.sampleToken.balanceOf(user2);

      expect(user3BalBefore).to.bignumber.be.gt(user3BalAfter);
      expect(user3BalAfter).to.bignumber.be.eq(ether('7'));
      expect(user2BalanceAfter).to.bignumber.be.eq(ether('10'));

      auction = await this.publicMarketplace.auction(this.currentAuctionId);

      expect(auction.winningBidId).to.bignumber.be.eq(new BN('2'));

      await expectRevert(
        this.publicMarketplace.placeBid(this.currentAuctionId, ether('3'), { from: user1 }),
        'Market: OWNER_CANNOT_PLACE_BID',
      );

      await expectRevert(
        this.publicMarketplace.placeBid(this.currentAuctionId, ether('3'), { from: user3 }),
        'Market: INVALID_BID_AMOUNT',
      );
      await expectRevert(
        this.publicMarketplace.placeBid(this.currentAuctionId, '500000000000000000', { from: user3 }),
        'Market: INVALID_BID_AMOUNT',
      );

      // advance time
      await time.increase(String(time.duration.days('3')));

      await expectRevert(
        this.publicMarketplace.placeBid(this.currentAuctionId, ether('5'), { from: user3 }),
        'Market: CANNOT_BID_AFTER_AUCTION_ENDS',
      );

      // resolve auction
      await this.publicMarketplace.resolveAuction(this.currentAuctionId);

      await expectRevert(
        this.publicMarketplace.placeBid(this.currentAuctionId, ether('6'), { from: user3 }),
        'Market: CANNOT_BID_ON_INACTIVE_AUCTION',
      );
      await expectRevert(this.publicMarketplace.placeBid(5, ether('6'), { from: user3 }), 'Market: INVALID_AUCTION_ID');
    });

    it('should resolve auction correctly', async () => {
      // approve tokens
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user2 });

      const user2BalanceBefore = await this.sampleToken.balanceOf(user2);

      let currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      // place bid for user2
      await this.publicMarketplace.placeBid(currentAuctionId, ether('2'), { from: user2 });

      let user2BalanceAfter = await this.sampleToken.balanceOf(user2);

      expect(user2BalanceBefore).to.bignumber.be.gt(user2BalanceAfter);
      expect(user2BalanceAfter).to.bignumber.be.eq(ether('8'));

      let auction = await this.publicMarketplace.auction(currentAuctionId);

      expect(auction.winningBidId).to.bignumber.be.eq(new BN('1'));

      const bid = await this.publicMarketplace.bid('1');

      expect(bid.bidAmount).to.bignumber.be.eq(ether('2'));
      expect(bid.bidderAddress).to.be.eq(user2);

      // approve tokens
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user3 });

      // place bid for user3
      await this.publicMarketplace.placeBid(currentAuctionId, ether('3'), { from: user3 });

      const user3BalAfter = await this.sampleToken.balanceOf(user3);
      user2BalanceAfter = await this.sampleToken.balanceOf(user2);

      expect(user3BalAfter).to.bignumber.be.eq(ether('7'));
      expect(user2BalanceAfter).to.bignumber.be.eq(ether('10'));

      auction = await this.publicMarketplace.auction(currentAuctionId);

      expect(auction.winningBidId).to.bignumber.be.eq(new BN('2'));

      await expectRevert(
        this.publicMarketplace.resolveAuction(currentAuctionId),
        'Market: CANNOT_RESOLVE_DURING_AUCTION',
      );

      // advance time to finish auction phase
      await time.increase(String(time.duration.days('3')));

      // resolve auction
      await this.publicMarketplace.resolveAuction(currentAuctionId);

      const user3NFTBal = await this.ERC1155NFT.balanceOf(user3, this.currentNftId);
      expect(user3NFTBal).to.bignumber.be.eq(new BN('1'));

      await expectRevert(
        this.publicMarketplace.resolveAuction(currentAuctionId),
        'Market: CANNOT_RESOLVE_INACTIVE_AUCTION',
      );

      // create another auction for user3

      // approve nft to PublicMarketplace contract
      await this.ERC1155NFT.setApprovalForAll(this.publicMarketplace.address, true, { from: user3 });

      // create auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user3,
        },
      );

      currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      // advance time to finish auction phase
      await time.increase(String(time.duration.days('3')));

      await expectRevert(
        this.publicMarketplace.resolveAuction(currentAuctionId),
        'Market: CANNOT_RESOLVE_AUCTION_WITH_NO_BIDS',
      );
    });
  });

  describe('Getters', () => {
    beforeEach(async () => {
      // create nft sale
      await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, uri, 10, { from: minter });

      this.currentNftId = await this.ERC1155NFT.getCurrentNftId();
      this.currentSaleId = await this.privateMarketplace.getCurrentSaleId();

      // buy nft from sale to close sale
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });

      // buy nft from sale
      await this.privateMarketplace.buyNFT(this.currentSaleId, { from: user1 });

      this.user1NftBal = await this.ERC1155NFT.balanceOf(user1, this.currentNftId);

      // approve nft to PublicMarketplace contract
      await this.ERC1155NFT.setApprovalForAll(this.publicMarketplace.address, true, { from: user1 });
    });
    it('should get auction winning bid correctly', async () => {
      // create auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      const currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      // approve tokens
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user2 });

      // place bid for user2
      await this.publicMarketplace.placeBid(currentAuctionId, ether('2'), { from: user2 });

      // get winning bid
      const bid = await this.publicMarketplace.getAuctionWinningBid(currentAuctionId);
      expect(bid.bidderAddress).to.be.eq(user2);
      await expectRevert(this.publicMarketplace.getAuctionWinningBid(5), 'Market: INVALID_AUCTION_ID');
    });
    it('should get current auction id correctly', async () => {
      // create auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      this.currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      expect(this.currentAuctionId).to.bignumber.be.eq(new BN('1'));
    });

    it('should get current bid id correctly', async () => {
      // create auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      this.currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

      // approve tokens
      await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, { from: user2 });

      // place bid
      await this.publicMarketplace.placeBid(this.currentAuctionId, ether('2'), { from: user2 });

      // get current bidId
      const bidId = await this.publicMarketplace.getCurrentBidId();
      expect(bidId).to.bignumber.be.eq(new BN('1'));
    });

    it('should get current sale id correctly', async () => {
      // create sale for the nft
      await this.publicMarketplace.sellNFT(this.currentNftId, ether('2'), this.sampleToken.address, { from: user1 });

      const currentSaleId = await this.publicMarketplace.getCurrentSaleId();
      expect(currentSaleId).to.bignumber.be.eq(new BN('1'));
    });

    it('should return isActiveAuction correctly', async () => {
      // create auction
      await this.publicMarketplace.createNFTAuction(
        this.currentNftId,
        ether('1'),
        this.sampleToken.address,
        String(time.duration.days('2')),
        {
          from: user1,
        },
      );

      let isActive = await this.publicMarketplace.isActiveAuction('1');
      expect(isActive).to.be.eq(true);

      // cancel auction
      await this.publicMarketplace.cancelAuctionAndClaimToken('1', { from: user1 });

      isActive = await this.publicMarketplace.isActiveAuction('1');
      expect(isActive).to.be.eq(false);

      await expectRevert(this.publicMarketplace.isActiveAuction('5'), 'Market: INVALID_AUCTION_ID');
    });

    it('should return isActiveSale correctly', async () => {
      // create sale for the nft
      await this.publicMarketplace.sellNFT(this.currentNftId, ether('2'), this.sampleToken.address, { from: user1 });

      let isActive = await this.publicMarketplace.isActiveSale('1');

      expect(isActive).to.be.eq(true);

      // cancel sale
      await this.publicMarketplace.cancelSaleAndClaimToken('1', { from: user1 });

      isActive = await this.publicMarketplace.isActiveSale('1');
      expect(isActive).to.be.eq(false);

      await expectRevert(this.publicMarketplace.isActiveSale('5'), 'Market: INVALID_SALE_ID');
    });

    it('should return isSupported token correctly', async () => {
      let isSupported = await this.publicMarketplace.isSupportedToken(this.sampleToken.address);
      expect(isSupported[0]).to.be.eq(true);

      await this.publicMarketplace.removeSupportedToken(this.sampleToken.address, { from: owner });

      isSupported = await this.publicMarketplace.isSupportedToken(this.sampleToken.address);
      expect(isSupported[0]).to.be.eq(false);
    });
  });
});
