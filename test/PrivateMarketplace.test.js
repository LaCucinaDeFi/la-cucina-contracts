require('chai').should();
const { expect } = require('chai');
const { expectRevert, ether, BN, time, expectEvent } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS, MAX_UINT256 } = require('@openzeppelin/test-helpers/src/constants');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

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

  before('Deploy ERC-1155 and Marketplace contracts', async () => {
    // deploy NFT token
    this.ERC1155NFT = await deployProxy(ERC1155NFT, [url], { initializer: 'initialize' });

    // deploy private marketplace
    this.privateMarketplace = await deployProxy(PrivateMarketplace, [this.ERC1155NFT.address], {
      initializer: 'initialize',
    });

    // add privateMarket as minter in ERC1155 contract.
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    await this.ERC1155NFT.grantRole(minterRole, this.privateMarketplace.address);

    // add excepted address
    await this.ERC1155NFT.addExceptedAddress(this.privateMarketplace.address);

    // add minter in privateMarketplace
    await this.privateMarketplace.grantRole(minterRole, minter);

    // deploy Lac token
    this.sampleToken = await SampleToken.new();

    // mint tokens to users
    await this.sampleToken.mint(user1, ether('100'), { from: owner });
    await this.sampleToken.mint(user2, ether('100'), { from: owner });
  });

  describe('initialize()', () => {
    it('should initialize the min duration correctly', async () => {
      const minDuration = await this.privateMarketplace.minDuration();
      expect(minDuration).to.bignumber.be.eq(new BN('86400'));
    });

    it('should initialize the NFT contract address correctly', async () => {
      const nftContractAddress = await this.privateMarketplace.nftContract();
      expect(this.ERC1155NFT.address).to.be.eq(nftContractAddress);
    });
  });

  describe('createAndSellNFT()', () => {
    let currentSaleId;
    let currentNftId;
    before('create and sell NFT', async () => {
      // add supported token
      await this.privateMarketplace.addSupportedToken(this.sampleToken.address, { from: owner });

      // create the NFT and list for sale
      this.sale1 = await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 10, {
        from: minter,
      });
    });

    it('should generate sale id and nft id correctly', async () => {
      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentSaleId = await this.privateMarketplace.getCurrentSaleId();

      const userSaleIds = await this.privateMarketplace.userSaleIds(minter, 0);

      expect(userSaleIds).to.bignumber.be.eq(new BN('1'));
      expect(currentNftId).to.bignumber.be.eq(new BN('1'));
      expect(currentSaleId).to.bignumber.be.eq(new BN('1'));
    });

    it('should store sale details correctly', async () => {
      // get sale details
      const sale = await this.privateMarketplace.sale(currentSaleId);

      expect(sale.seller).to.be.eq(minter);
      expect(sale.buyer).to.be.eq(ZERO_ADDRESS);
      expect(sale.currency).to.be.eq(this.sampleToken.address);
      expect(sale.nftId).to.bignumber.be.eq(new BN('1'));
      expect(sale.totalCopies).to.bignumber.be.eq(new BN('10'));
      expect(sale.remainingCopies).to.bignumber.be.eq(new BN('10'));
      expect(sale.sellingPrice).to.bignumber.be.eq(new BN(ether('1')));
      expect(sale.sellTimeStamp).to.bignumber.be.eq(new BN('0'));
      expect(sale.cancelTimeStamp).to.bignumber.be.eq(new BN('0'));
    });

    it('should revert when Non-Minter tries to create NFT and lists for sale', async () => {
      await expectRevert(
        this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 10, { from: user1 }),
        'PrivateMarketplace: MINTER_ROLE_REQUIRED',
      );
    });
    it('should revert when minter tries to create NFT sale with unsupported tokens', async () => {
      await expectRevert(
        this.privateMarketplace.createAndSellNFT(ether('1'), ZERO_ADDRESS, url, 10, { from: minter }),
        'Market: UNSUPPORTED_TOKEN',
      );
    });
    it('should revert when minter tries to create NFT sale with 0 copies', async () => {
      await expectRevert(
        this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 0, { from: minter }),
        'PrivateMarketplace: INVALID_NUMBER_OF_COPIES',
      );
    });
    it('should revert when minter tries to create NFT sale with 0 initial price', async () => {
      await expectRevert(
        this.privateMarketplace.createAndSellNFT('0', this.sampleToken.address, url, 10, { from: minter }),
        'PrivateMarketplace: INVALID_NFT_PRICE',
      );
    });
    it('should emit event after successfully creating nft sale', async () => {
      await expectEvent(this.sale1, 'NewNFTListing', [minter, '1']);
    });
  });

  describe('createAndAuctionNFT()', () => {
    let currentAuctionId;
    let currentNftId;
    before('create and auction NFT', async () => {
      // create auction
      this.auction1 = await this.privateMarketplace.createAndAuctionNFT(
        ether('1'),
        this.sampleToken.address,
        url,
        String(time.duration.days('2')),
        {
          from: minter,
        },
      );
    });

    it('should generate auction id and nft id correctly', async () => {
      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

      const userAuctionIds = await this.privateMarketplace.userAuctionIds(minter, 0);

      expect(currentNftId).to.bignumber.be.eq(new BN('2'));
      expect(currentAuctionId).to.bignumber.be.eq(new BN('1'));
      expect(userAuctionIds).to.bignumber.be.eq(new BN('1'));
    });

    it('should store auction details correctly', async () => {
      // get auction details
      const auction = await this.privateMarketplace.auction(currentAuctionId);
      expect(auction.nftId).to.bignumber.be.eq(currentNftId);
      expect(auction.sellerAddress).to.be.eq(minter);
      expect(auction.initialPrice).to.bignumber.be.eq(ether('1'));
      expect(auction.currency).to.be.eq(this.sampleToken.address);
      expect(auction.duration).to.bignumber.be.eq(new BN(String(time.duration.days('2'))));
      expect(auction.status).to.bignumber.be.eq(new BN('1'));
      expect(auction.winningBidId).to.bignumber.be.eq(new BN('0'));
      expect(auction.cancelTimeStamp).to.bignumber.be.eq(new BN('0'));
      expect(auction.buyTimestamp).to.bignumber.be.eq(new BN('0'));
    });
    it('should revert when Non-Minter tries to create NFT and lists for auction', async () => {
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
    });

    it('should revert when minter tries to create NFT and auction with unsupported tokens', async () => {
      await expectRevert(
        this.privateMarketplace.createAndAuctionNFT(ether('1'), ZERO_ADDRESS, url, String(time.duration.days('2')), {
          from: minter,
        }),
        'Market: UNSUPPORTED_TOKEN',
      );
    });

    it('should revert when minter tries to create NFT and auction with 0 initial price', async () => {
      await expectRevert(
        this.privateMarketplace.createAndAuctionNFT(
          '0',
          this.sampleToken.address,
          url,
          String(time.duration.days('2')),
          {
            from: minter,
          },
        ),
        'PrivateMarketplace: INVALID_INITIAL_NFT_PRICE',
      );
    });
    it('should revert when minter tries to create NFT and auction for invalid duration', async () => {
      await expectRevert(
        this.privateMarketplace.createAndAuctionNFT(ether('1'), this.sampleToken.address, url, '100', {
          from: minter,
        }),
        'Market: INVALID_DURATION',
      );
    });

    it('should emit event after successfully creating nft auction', async () => {
      await expectEvent(this.auction1, 'NFTAuction', [minter, '1']);
    });
  });

  describe('updateSale()', () => {
    let currentSaleId;
    let saleBeforeUpdate;
    before('update current sale', async () => {
      // create the NFT and list for sale
      await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 1, {
        from: minter,
      });

      currentSaleId = await this.privateMarketplace.getCurrentSaleId();

      saleBeforeUpdate = await this.privateMarketplace.sale(currentSaleId);

      // update sale
      await this.privateMarketplace.updateSale(currentSaleId, ether('2'), { from: minter });
    });

    it('should update sale price correctly', async () => {
      const saleAfterUpdate = await this.privateMarketplace.sale(currentSaleId);

      expect(saleBeforeUpdate.sellingPrice).to.bignumber.be.lt(saleAfterUpdate.sellingPrice);
      expect(saleAfterUpdate.sellingPrice).to.bignumber.be.eq(ether('2'));
    });

    it('should revert when non-seller tries to update the sale', async () => {
      await expectRevert(
        this.privateMarketplace.updateSale(currentSaleId, ether('2'), { from: user1 }),
        'Market:ONLY_SELLER_CAN_UPDATE',
      );
    });

    it('should revert when seller tries to update the sale with zero price', async () => {
      await expectRevert(
        this.privateMarketplace.updateSale(currentSaleId, ether('0'), { from: minter }),
        'Market: INVALID_SELLING_PRICE',
      );
    });

    it('should revert when seller tries to update the sale with same price', async () => {
      await expectRevert(
        this.privateMarketplace.updateSale(currentSaleId, ether('2'), { from: minter }),
        'Market: INVALID_SELLING_PRICE',
      );
    });

    it('should revert when seller tries to update the sale with invalid sale id', async () => {
      await expectRevert(
        this.privateMarketplace.updateSale(15, ether('5'), { from: minter }),
        'Market: INVALID_SALE_ID',
      );
    });

    it('should revert when seller tries to update the sale which is ended already', async () => {
      // buy nft from sale to close sale
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user1 });
      await this.privateMarketplace.buyNFT(currentSaleId, { from: user1 });

      await expectRevert(
        this.privateMarketplace.updateSale(currentSaleId, ether('3'), { from: minter }),
        'Market: SALE_ALREADY_ENDED',
      );
    });
  });

  describe('updateAuction()', () => {
    let currentAuctionId;
    let auctionBeforeUpdate;

    before('update current auction', async () => {
      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();
      auctionBeforeUpdate = await this.privateMarketplace.auction(currentAuctionId);

      // update auction
      await this.privateMarketplace.updateAuction(currentAuctionId, ether('2'), String(time.duration.days('1')), {
        from: minter,
      });
    });

    it('should update the initial price and duration correctly', async () => {
      const auctionAfter = await this.privateMarketplace.auction(currentAuctionId);

      expect(auctionAfter.initialPrice).to.bignumber.be.eq(ether('2'));
      expect(auctionAfter.duration).to.bignumber.be.eq(String(time.duration.days('3')));
      expect(auctionAfter.initialPrice).to.bignumber.be.gt(auctionBeforeUpdate.initialPrice);
      expect(auctionAfter.duration).to.bignumber.be.gt(auctionBeforeUpdate.duration);
    });

    it('should revert when non-seller tries to update the auction', async () => {
      await expectRevert(
        this.privateMarketplace.updateAuction(currentAuctionId, ether('2'), String(time.duration.days('1')), {
          from: user1,
        }),
        'Market:ONLY_SELLER_CAN_UPDATE',
      );
    });

    it('should revert when seller tries to update the auction with zero initial price', async () => {
      await expectRevert(
        this.privateMarketplace.updateAuction(currentAuctionId, ether('0'), String(time.duration.days('1')), {
          from: minter,
        }),
        'Market: INVALID_INITIAL_PRICE',
      );
    });

    it('should revert when seller tries to update the auction with same initial price', async () => {
      await expectRevert(
        this.privateMarketplace.updateAuction(currentAuctionId, ether('2'), String(time.duration.days('1')), {
          from: minter,
        }),
        'Market: INVALID_INITIAL_PRICE',
      );
    });

    it('should revert when seller tries to update the auction with invalid auction id', async () => {
      await expectRevert(
        this.privateMarketplace.updateAuction(4, ether('5'), String(time.duration.days('1')), {
          from: minter,
        }),
        'Market: INVALID_AUCTION_ID',
      );
    });

    it('should revert when seller tries to update the auction with non-zero bids', async () => {
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
    });
    it('should revert when seller tries to update the canceled auction', async () => {
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

      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

      // cancel auction
      await this.privateMarketplace.cancelAuction(currentAuctionId, { from: minter });

      await expectRevert(
        this.privateMarketplace.updateAuction(currentAuctionId, ether('3'), String(time.duration.days('1')), {
          from: minter,
        }),
        'Market:ONLY_SELLER_CAN_UPDATE',
      );
    });
  });

  describe('canceleSale()', () => {
    let currentNftId;
    let currentSaleId;
    let privateMarketNFTBalBefore;
    let privateMarketNFTBalAfter;

    before('cancel sale', async () => {
      // create a sale
      await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 10, { from: minter });

      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentSaleId = await this.privateMarketplace.getCurrentSaleId();

      privateMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);
    });

    it('should revert if non-seller tries to cancel the sale', async () => {
      await expectRevert(
        this.privateMarketplace.cancelSale(currentSaleId, { from: user2 }),
        'PrivateMarketplace: MINTER_ROLE_REQUIRED',
      );

      it('should delete sale details correctly', async () => {
        // cancel sale
        await this.privateMarketplace.cancelSale(currentSaleId, { from: minter });

        privateMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

        expect(privateMarketNFTBalBefore).to.bignumber.be.eq(new BN('10'));
        expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));

        const sale = await this.privateMarketplace.sale(currentSaleId);

        expect(sale.seller).to.be.eq(ZERO_ADDRESS);
        expect(sale.buyer).to.be.eq(ZERO_ADDRESS);
        expect(sale.currency).to.be.eq(ZERO_ADDRESS);
        expect(sale.nftId).to.bignumber.be.eq(new BN('0'));
        expect(sale.totalCopies).to.bignumber.be.eq(new BN('0'));
        expect(sale.remainingCopies).to.bignumber.be.eq(new BN('0'));
        expect(sale.sellingPrice).to.bignumber.be.eq(new BN(ether('0')));
        expect(sale.sellTimeStamp).to.bignumber.be.eq(new BN('0'));
        expect(sale.cancelTimeStamp).to.bignumber.be.eq(new BN('0'));
      });

      it('should not cancel canceled sale', async () => {
        // cancel the sale again
        await expectRevert(
          this.privateMarketplace.cancelSale(currentSaleId, { from: minter }),
          'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_SALE',
        );
      });
    });

    it('should not cancel sale if some of the copies of NFT are sold in sale', async () => {
      // create another sale
      await this.privateMarketplace.createAndSellNFT(ether('2'), this.sampleToken.address, url, 10, { from: minter });

      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentSaleId = await this.privateMarketplace.getCurrentSaleId();

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
  });

  describe('cancelAuction()', () => {
    let currentNftId;
    let currentAuctionId;
    let privateMarketNFTBalBefore;
    let privateMarketNFTBalAfter;
    before('cancel the auction', async () => {
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

      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();
      privateMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

      // cancel auction
      await this.privateMarketplace.cancelAuction(currentAuctionId, { from: minter });
    });

    it('shoud delete the auction data after canceling auction', async () => {
      privateMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

      expect(privateMarketNFTBalBefore).to.bignumber.be.eq(new BN('1'));
      expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));

      const auction = await this.privateMarketplace.auction(currentAuctionId);

      expect(auction.nftId).to.bignumber.be.eq(new BN('0'));
      expect(auction.sellerAddress).to.be.eq(ZERO_ADDRESS);
      expect(auction.initialPrice).to.bignumber.be.eq(ether('0'));
      expect(auction.currency).to.be.eq(ZERO_ADDRESS);
      expect(auction.startBlock).to.bignumber.be.eq(new BN('0'));
      expect(auction.duration).to.bignumber.be.eq(new BN('0'));
      expect(auction.status).to.bignumber.be.eq(new BN('0'));
      expect(auction.winningBidId).to.bignumber.be.eq(new BN('0'));
      expect(auction.cancelTimeStamp).to.bignumber.be.eq(new BN('0'));
      expect(auction.buyTimestamp).to.bignumber.be.eq(new BN('0'));
    });

    it('should revert when non-seller tries to cancel the canceled auction', async () => {
      // cancel auction again
      await expectRevert(
        this.privateMarketplace.cancelAuction(currentAuctionId, { from: minter }),
        'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_AUCTION',
      );
    });

    it('should not cancel auction with non-zero bids', async () => {
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

      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

      // place bid
      await this.privateMarketplace.placeBid(currentAuctionId, ether('4'), { from: user1 });

      await expectRevert(
        this.privateMarketplace.cancelAuction(currentAuctionId, { from: minter }),
        'PrivateMarketplace: CANNOT_CANCEL_AUCTION',
      );
    });

    it('should revert when non-seller tries to cancel the auction', async () => {
      await expectRevert(
        this.privateMarketplace.cancelAuction(currentAuctionId, { from: user2 }),
        'PrivateMarketplace: MINTER_ROLE_REQUIRED',
      );
    });

    it('should revert when seller tries to cancel resolved auction', async () => {
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

    it('should revert when seller tries to cancel auction with invalid auction id', async () => {
      await expectRevert(this.privateMarketplace.cancelAuction(9, { from: minter }), 'Market: INVALID_AUCTION_ID');
    });
  });

  describe('buyNFT()', () => {
    let currentNftId;
    let currentSaleId;
    let privateMarketNFTBalBefore;
    let privateMarketNFTBalAfter;
    before('buy nft from sale', async () => {
      // create sale
      await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 1, { from: minter });

      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentSaleId = await this.privateMarketplace.getCurrentSaleId();
      privateMarketNFTBalBefore = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

      // buy nft from sale
      await this.privateMarketplace.buyNFT(currentSaleId, { from: user1 });
    });

    it('should reflect nft in user wallet correctly', async () => {
      privateMarketNFTBalAfter = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);

      const user1NFTBal = await this.ERC1155NFT.balanceOf(user1, currentNftId);

      expect(user1NFTBal).to.bignumber.be.eq(new BN('1'));
      expect(privateMarketNFTBalBefore).to.bignumber.be.eq(new BN('1'));
      expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));
    });

    it('should revert when seller tries to cancel inactive sale', async () => {
      // cancel sale
      await expectRevert(
        this.privateMarketplace.cancelSale(currentSaleId, { from: minter }),
        'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_SALE',
      );
    });

    it('should revert when user tries to buy from invalid sale', async () => {
      await expectRevert(this.privateMarketplace.buyNFT(15, { from: user1 }), 'Market: INVALID_SALE_ID');
    });

    it('should revert when user tries to buy from inactive sale', async () => {
      await expectRevert(
        this.privateMarketplace.buyNFT(currentSaleId, { from: user1 }),
        'Market: CANNOT_BUY_FROM_INACTIVE_SALE',
      );
    });
  });

  describe('moveNftInSale()', () => {
    let currentNftId;
    let currentSaleId;
    let currentAuctionId;

    before('moveNftInSale', async () => {
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

      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();
      currentNftId = await this.ERC1155NFT.getCurrentNftId();
    });

    it('should store sale details and cancel the exisiting auction correctly', async () => {
      // move nft from auction to sale
      this.tx = await this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: minter });

      currentSaleId = await this.privateMarketplace.getCurrentSaleId();

      const auction = await this.privateMarketplace.auction(currentAuctionId);
      expect(auction.status).to.bignumber.be.eq(new BN('2'));

      const sale = await this.privateMarketplace.sale(currentSaleId);

      expect(sale.seller).to.be.eq(minter);
      expect(sale.buyer).to.be.eq(ZERO_ADDRESS);
      expect(sale.currency).to.be.eq(this.sampleToken.address);
      expect(sale.nftId).to.bignumber.be.eq(currentNftId);
      expect(sale.totalCopies).to.bignumber.be.eq(new BN('1'));
      expect(sale.remainingCopies).to.bignumber.be.eq(new BN('1'));
      expect(sale.sellingPrice).to.bignumber.be.eq(new BN(ether('2')));
      expect(sale.sellTimeStamp).to.bignumber.be.eq(new BN('0'));
      expect(sale.cancelTimeStamp).to.bignumber.be.eq(new BN('0'));
    });

    it('should revert when seller tries to move nft from inactive auction to sale', async () => {
      await expectRevert(
        this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: minter }),
        'Market: CANNOT_MOVE_NFT_FROM_INACTIVE_AUCTION',
      );
    });

    it('should revert when seller tries to move nft from auction to sale with non zero bids', async () => {
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

      // place bid
      await this.privateMarketplace.placeBid(currentAuctionId, ether('4'), { from: user1 });

      await expectRevert(
        this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: minter }),
        'Market: CANNOT_UPDATE_AUCTION',
      );
    });

    it('should revert when non-seller tries to move nft from auction to sale', async () => {
      await expectRevert(
        this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), { from: user3 }),
        'Market: CALLER_NOT_THE_AUCTION_CREATOR',
      );
    });

    it('should revert when seller tries to move nft from auction to sale with 0 selling price', async () => {
      await expectRevert(
        this.privateMarketplace.moveNftInSale(currentAuctionId, ether('0'), { from: minter }),
        'Market: INVALID_SELLING_PRICE',
      );
    });
  });

  describe('addSupportedToken()', () => {
    let isSupportedBefore;
    before('add supported token', async () => {
      isSupportedBefore = await this.privateMarketplace.isSupportedToken(ZERO_ADDRESS);

      // add supported token
      await this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, { from: owner });
    });

    it('should add supported token correctly', async () => {
      const isSupportedAfter = await this.privateMarketplace.isSupportedToken(ZERO_ADDRESS);

      expect(isSupportedBefore[0]).to.be.eq(false);
      expect(isSupportedAfter[0]).to.be.eq(true);
    });

    it('should revert when admin tries to add token which is already supported', async () => {
      await expectRevert(
        this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, { from: owner }),
        'Market: TOKEN_ALREADY_ADDED',
      );
    });

    it('should revert when non-admin tries to add the supported token', async () => {
      await expectRevert(
        this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, { from: user2 }),
        'Market: ONLY_ADMIN_CAN_CALL',
      );
    });
  });

  describe('removeSupportedToken()', () => {
    let isSupportedBefore;
    before('remove supported token', async () => {
      isSupportedBefore = await this.privateMarketplace.isSupportedToken(ZERO_ADDRESS);

      // remove supported token
      await this.privateMarketplace.removeSupportedToken(ZERO_ADDRESS, { from: owner });
    });

    it('should remove supported token correctly', async () => {
      const isSupportedAfter = await this.privateMarketplace.isSupportedToken(ZERO_ADDRESS);

      expect(isSupportedBefore[0]).to.be.eq(true);
      expect(isSupportedAfter[0]).to.be.eq(false);
    });

    it('should revert when admin tries to remove token which does not supports already', async () => {
      await expectRevert(
        this.privateMarketplace.removeSupportedToken(ZERO_ADDRESS, { from: owner }),
        'Market: TOKEN_DOES_NOT_EXISTS',
      );
    });

    it('should revert when non-admin tries to remove the supported token', async () => {
      await expectRevert(
        this.privateMarketplace.removeSupportedToken(ZERO_ADDRESS, { from: minter }),
        'Market: ONLY_ADMIN_CAN_CALL',
      );
    });
  });

  describe('updateMinimumDuration()', async () => {
    let minimumDurationBefore;

    before('update minimum duration', async () => {
      minimumDurationBefore = await this.privateMarketplace.minDuration();

      // update minimum duration
      await this.privateMarketplace.updateMinimumDuration(String(time.duration.days('4')), { from: owner });
    });
    after('reset minimum duration to 1 days', async () => {
      // update minimum duration
      await this.privateMarketplace.updateMinimumDuration(String(time.duration.days('1')), { from: owner });
    });

    it('update minimum duration correctly', async () => {
      const minDurationAfter = await this.privateMarketplace.minDuration();
      expect(minDurationAfter).to.bignumber.be.eq(new BN('345600'));
    });

    it('should revert when admin tries to update minimum duration with same duration', async () => {
      await expectRevert(
        this.privateMarketplace.updateMinimumDuration(String(time.duration.days('4')), { from: owner }),
        'MintingStatoin: INVALID_MINIMUM_DURATION',
      );
    });

    it('should revert when admin tries to update minimum duration to zero', async () => {
      await expectRevert(
        this.privateMarketplace.updateMinimumDuration(String(time.duration.days('0')), { from: owner }),
        'MintingStatoin: INVALID_MINIMUM_DURATION',
      );
    });
    it('should revert when non-admin tries to update minimum duration', async () => {
      await expectRevert(
        this.privateMarketplace.updateMinimumDuration(String(time.duration.days('3')), { from: user2 }),
        'Market: ONLY_ADMIN_CAN_CALL',
      );
    });
  });

  describe('placeBid()', async () => {
    let currentAuctionId;
    let currentNftId;
    let user1BalanceBefore;
    let user1BalanceAfter;
    let currentBidId;
    before('create auction', async () => {
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

      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

      user1BalanceBefore = await this.sampleToken.balanceOf(user1);

      // place bid for user1
      await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), { from: user1 });

      currentBidId = await this.privateMarketplace.getCurrentBidId();
    });

    it('should set store bid details correctly', async () => {
      user1BalanceAfter = await this.sampleToken.balanceOf(user1);

      expect(user1BalanceBefore).to.bignumber.be.gt(user1BalanceAfter);

      const auction = await this.privateMarketplace.auction(currentAuctionId);
      expect(auction.winningBidId).to.bignumber.be.eq(currentBidId);

      const bid = await this.privateMarketplace.bid(currentBidId);

      expect(bid.auctionId).to.bignumber.be.eq(currentAuctionId);
      expect(bid.bidAmount).to.bignumber.be.eq(ether('2'));
      expect(bid.bidderAddress).to.be.eq(user1);
    });

    it('should return the tokens to previous bidder when someone places new bid', async () => {
      await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, { from: user2 });

      const user2BalBefore = await this.sampleToken.balanceOf(user2);

      // place bid for user2
      await this.privateMarketplace.placeBid(currentAuctionId, ether('3'), { from: user2 });

      currentBidId = await this.privateMarketplace.getCurrentBidId();

      const user2BalAfter = await this.sampleToken.balanceOf(user2);
      user1BalanceAfter = await this.sampleToken.balanceOf(user1);

      expect(user2BalBefore).to.bignumber.be.gt(user2BalAfter);
      expect(user1BalanceAfter).to.bignumber.be.eq(user1BalanceBefore);

      const auction = await this.privateMarketplace.auction(currentAuctionId);
      expect(auction.winningBidId).to.bignumber.be.eq(currentBidId);
    });

    it('should revert if tokens are not approved before placing bid', async () => {
      await this.sampleToken.mint(accounts[6], ether('7'), { from: owner });

      await expectRevert(
        this.privateMarketplace.placeBid(currentAuctionId, ether('7'), { from: accounts[6] }),
        'ERC20: transfer amount exceeds allowance',
      );
    });

    it('should revert when auction creator tries to place bid', async () => {
      await expectRevert(
        this.privateMarketplace.placeBid(currentAuctionId, ether('3'), { from: minter }),
        'Market: OWNER_CANNOT_PLACE_BID',
      );
    });

    it('should revert when bidder tries to place bid with same bidamount', async () => {
      await expectRevert(
        this.privateMarketplace.placeBid(currentAuctionId, ether('3'), { from: user1 }),
        'Market: INVALID_BID_AMOUNT',
      );
    });

    it('should revert when bidder tries to place bid with less than initial auction price', async () => {
      await expectRevert(
        this.privateMarketplace.placeBid(currentAuctionId, '500000000000000000', { from: user1 }),
        'Market: INVALID_BID_AMOUNT',
      );
    });

    it('should revert when bidder tries to bid after auction period', async () => {
      // advance time
      await time.increase(String(time.duration.days('3')));

      await expectRevert(
        this.privateMarketplace.placeBid(currentAuctionId, ether('5'), { from: user1 }),
        'Market: CANNOT_BID_AFTER_AUCTION_ENDS.',
      );
    });

    it('should revert when bidder tries to bid on inactive auction', async () => {
      // resolve auction
      await this.privateMarketplace.resolveAuction(currentAuctionId);

      await expectRevert(
        this.privateMarketplace.placeBid(currentAuctionId, ether('6'), { from: user2 }),
        'Market: CANNOT_BID_ON_INACTIVE_AUCTION',
      );
    });

    it('should revert when bidder tries to bid with invalid auction id', async () => {
      await expectRevert(
        this.privateMarketplace.placeBid(15, ether('6'), { from: user2 }),
        'Market: INVALID_AUCTION_ID',
      );
    });
  });

  describe('resolveAuction()', () => {
    let currentAuctionId;
    let currentNftId;
    let contractBalanceBefore;
    let currentBidId;
    let user1NFTBalanceBefore;
    let contractNFTBalanceBefore;
    before('resolve auction', async () => {
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

      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

      // place bid for user1
      await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), { from: user1 });

      currentBidId = await this.privateMarketplace.getCurrentBidId();

      user1NFTBalanceBefore = await this.ERC1155NFT.balanceOf(user1, currentNftId);
      contractNFTBalanceBefore = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);
      contractBalanceBefore = await this.sampleToken.balanceOf(this.privateMarketplace.address);
    });

    it('should revert when anyone tries to resolve auction before auction end time', async () => {
      await expectRevert(
        this.privateMarketplace.resolveAuction(currentAuctionId),
        'Market: CANNOT_RESOLVE_DURING_AUCTION',
      );
    });

    it('should resolve the auction and update the auction status to close', async () => {
      // advance time to finish auction phase
      await time.increase(String(time.duration.days('3')));

      // resolve auction
      await this.privateMarketplace.resolveAuction(currentAuctionId);

      const auction = await this.privateMarketplace.auction(currentAuctionId);

      const user1NFTBalanceAfter = await this.ERC1155NFT.balanceOf(user1, currentNftId);
      const contractNFTBalanceAfter = await this.ERC1155NFT.balanceOf(this.privateMarketplace.address, currentNftId);
      const contractBalanceAfter = await this.sampleToken.balanceOf(this.privateMarketplace.address);

      expect(auction.status).to.bignumber.be.eq(new BN('0'));
      expect(user1NFTBalanceBefore).to.bignumber.be.eq(new BN('0'));
      expect(contractNFTBalanceBefore).to.bignumber.be.eq(new BN('1'));
      expect(user1NFTBalanceAfter).to.bignumber.be.eq(new BN('1'));
      expect(contractNFTBalanceAfter).to.bignumber.be.eq(new BN('0'));
      expect(contractBalanceBefore).to.bignumber.be.gt(contractBalanceAfter);
    });

    it('should revert when anyone tries to resolve auction which already resolved', async () => {
      await expectRevert(
        this.privateMarketplace.resolveAuction(currentAuctionId),
        'Market: CANNOT_RESOLVE_INACTIVE_AUCTION',
      );
    });

    it('should revert when anyone tries to resolve auction with no bids', async () => {
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

      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

      // advance time to finish auction phase
      await time.increase(String(time.duration.days('3')));

      await expectRevert(
        this.privateMarketplace.resolveAuction(currentAuctionId),
        'Market: CANNOT_RESOLVE_AUCTION_WITH_NO_BIDS',
      );
    });
  });

  describe('getAuctionWinningBid()', () => {
    let currentAuctionId;
    let currentBidId;
    let currentNftId;
    let bid;
    before('get auction winning bid', async () => {
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

      currentNftId = await this.ERC1155NFT.getCurrentNftId();
      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

      // place bid for user1
      await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), { from: user1 });

      currentBidId = await this.privateMarketplace.getCurrentBidId();

      // get winning bid
      bid = await this.privateMarketplace.getAuctionWinningBid(currentAuctionId);
    });

    it('should get winning bid id correctly', async () => {
      expect(bid.bidderAddress).to.be.eq(user1);
      expect(bid.bidAmount).to.bignumber.be.eq(ether('2'));
      expect(bid.auctionId).to.bignumber.be.eq(currentAuctionId);

      const auction = await this.privateMarketplace.auction(currentAuctionId);

      expect(auction.winningBidId).to.bignumber.be.eq(currentBidId);
    });

    it('should revert when anyone tries to get winning bid with invalid auction id', async () => {
      await expectRevert(this.privateMarketplace.getAuctionWinningBid(18), 'Market: INVALID_AUCTION_ID');
    });
  });

  describe('getters', () => {
    let currentAuctionId;
    let currentAuctionIdBefore;
    before('create auction', async () => {
      currentAuctionIdBefore = await this.privateMarketplace.getCurrentAuctionId();
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

      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();
    });

    it('should get current auction id correctly', async () => {
      currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();
      expect(currentAuctionId).to.bignumber.be.gt(currentAuctionIdBefore);
    });

    it('should get current bid id correctly', async () => {
      // get current bidId
      const currentBidId = await this.privateMarketplace.getCurrentBidId();

      // place bid
      await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), { from: user2 });

      // get current bidId
      const bidId = await this.privateMarketplace.getCurrentBidId();

      expect(bidId).to.bignumber.be.gt(currentBidId);
    });

    it('should get current sale id correctly', async () => {
      const currentSaleIdBefore = await this.privateMarketplace.getCurrentSaleId();

      // create sale
      await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 10, { from: minter });

      const currentSaleIdAfter = await this.privateMarketplace.getCurrentSaleId();
      expect(currentSaleIdAfter).to.bignumber.be.gt(currentSaleIdBefore);
    });

    it('should return isActiveSale correctly', async () => {
      // create sale
      await this.privateMarketplace.createAndSellNFT(ether('1'), this.sampleToken.address, url, 10, { from: minter });

      const currentSaleId = await this.privateMarketplace.getCurrentSaleId();

      let isActive = await this.privateMarketplace.isActiveSale(currentSaleId);

      expect(isActive).to.be.eq(true);

      // cancel sale
      await this.privateMarketplace.cancelSale(currentSaleId, { from: minter });

      isActive = await this.privateMarketplace.isActiveSale(currentSaleId);
      expect(isActive).to.be.eq(false);
    });

    it('should revert when anyone gets the sale status with invalid sale id', async () => {
      await expectRevert(this.privateMarketplace.isActiveSale('15'), 'Market: INVALID_SALE_ID');
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
