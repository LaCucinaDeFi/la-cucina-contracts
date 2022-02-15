require('chai').should();
const {expect} = require('chai');
const {expectRevert, ether, BN, time, expectEvent} = require('@openzeppelin/test-helpers');
const {ZERO_ADDRESS, MAX_UINT256} = require('@openzeppelin/test-helpers/src/constants');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const papayas = require('../data/ingredients/papaya');
const caviar = require('../data/ingredients/caviar');
const leaves = require('../data/ingredients/leaves');
const venom = require('../data/ingredients/venom');
const antEggs = require('../data/ingredients/antEggs');

const IngredientsNFT = artifacts.require('IngredientsNFT');
const PrivateMarketplace = artifacts.require('PrivateMarketplace');
const PublicMarketplace = artifacts.require('PublicMarketplace');
const PublicMarketplaceV2 = artifacts.require('PublicMarketplaceV2');

const {Talien} = require('./helper/talien');

const SampleToken = artifacts.require('SampleToken');

const url = 'https://token-cdn-domain/{id}.json';
const ipfsHash = 'bafybeihabfo2rluufjg22a5v33jojcamglrj4ucgcw7on6v33sc6blnxcm';
const GAS_LIMIT = 85000000;

contract('PublicMarketplace', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];
	const fundReceiver = accounts[5];
	const operator = accounts[6];
	const royaltyReceiver = accounts[8];
	const royaltyFee = '100';
	const stash = accounts[9];
	let currentNftId;
	let nutritionHash;
	before('Deploy ERC-1155 and Marketplace contracts', async () => {
		// deploy Lac token
		this.sampleToken = await SampleToken.new();

		// deploy NFT token
		this.Ingredient = await deployProxy(IngredientsNFT, [url, royaltyReceiver, royaltyFee], {
			initializer: 'initialize'
		});

		// deploy NFT token
		this.TalienContract = new Talien(operator, owner);
		this.Talien = await this.TalienContract.setup(
			fundReceiver,
			royaltyReceiver,
			this.sampleToken.address
		);
		// deploy private marketplace
		this.privateMarketplace = await deployProxy(
			PrivateMarketplace,
			[this.Ingredient.address, this.Talien.address, time.duration.days('0'), fundReceiver],
			{
				initializer: 'initialize'
			}
		);

		// deploy Public marketplace
		this.publicMarketplace = await deployProxy(PublicMarketplace, [this.Ingredient.address], {
			initializer: 'initialize'
		});

		// add privateMarket as minter in ERC1155 contract.
		const minterRole = await this.Ingredient.MINTER_ROLE();
		await this.Ingredient.grantRole(minterRole, this.privateMarketplace.address);
		await this.Ingredient.grantRole(minterRole, minter);

		// grant updator role to talion contract
		const OPERATOR_ROLE = await this.Ingredient.OPERATOR_ROLE();
		await this.Ingredient.grantRole(OPERATOR_ROLE, operator, {from: owner});
		await this.privateMarketplace.grantRole(OPERATOR_ROLE, operator, {from: owner});

		// add excepted address
		await this.Ingredient.addExceptedAddress(this.privateMarketplace.address, {from: operator});
		// add excepted address
		await this.Ingredient.addExceptedAddress(this.publicMarketplace.address, {from: operator});
		// add stash as excepted address
		await this.Ingredient.addExceptedAddress(stash, {from: operator});

		// add minter in privateMarketplace
		await this.privateMarketplace.grantRole(minterRole, minter);

		// add minter in publicMarketplace
		await this.publicMarketplace.grantRole(minterRole, minter);
		// add minter in publicMarketplace
		await this.publicMarketplace.grantRole(OPERATOR_ROLE, operator, {from: owner});

		// add supported token
		await this.privateMarketplace.addSupportedToken(this.sampleToken.address, {from: operator});
		await this.publicMarketplace.addSupportedToken(this.sampleToken.address, {from: operator});

		// mint tokens to users
		await this.sampleToken.mint(user1, ether('100'));
		await this.sampleToken.mint(user2, ether('100'));
		await this.sampleToken.mint(user3, ether('100'));
	});

	describe('initialize()', () => {
		before('add ingredients', async () => {
			// add owner as excepted address
			await this.Ingredient.addExceptedAddress(owner, {from: operator});

			nutritionHash = await this.Ingredient.getNutritionHash([14, 50, 20, 4, 6, 39, 25]);

			// add ingredient with variation
			await this.Ingredient.addIngredientWithVariations(
				owner,
				10,
				'Papaya',
				nutritionHash,
				ipfsHash,
				[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
				[papayas[0].svg, papayas[1].svg, papayas[2].svg],
				[papayas[0].name, papayas[1].name, papayas[2].name],
				{
					from: minter
				}
			);

			// add ingredient with variation
			await this.Ingredient.addIngredientWithVariations(
				owner,
				10,
				'Caviar',
				nutritionHash,
				ipfsHash,
				[caviar[0].keyword, caviar[0].keyword],
				[caviar[0].svg],
				[caviar[0].name],
				{
					from: minter,
					gas: GAS_LIMIT
				}
			);

			// add ingredient with variation
			await this.Ingredient.addIngredientWithVariations(
				owner,
				10,
				'Leaves',
				nutritionHash,
				ipfsHash,
				[leaves[0].keyword, leaves[1].keyword, leaves[2].keyword],
				[leaves[0].svg, leaves[1].svg, leaves[2].svg],
				[leaves[0].name, leaves[1].name, leaves[2].name],
				{
					from: minter,
					gas: GAS_LIMIT
				}
			);

			// add ingredient with variation
			await this.Ingredient.addIngredientWithVariations(
				owner,
				10,
				'Venom',
				nutritionHash,
				ipfsHash,
				[venom[0].keyword, venom[1].keyword, venom[2].keyword],
				[venom[0].svg, venom[1].svg, venom[2].svg],
				[venom[0].name, venom[1].name, venom[2].name],
				{
					from: minter,
					gas: GAS_LIMIT
				}
			);

			// add ingredient with variation
			await this.Ingredient.addIngredientWithVariations(
				owner,
				10,
				'Ant_Eggs',
				nutritionHash,
				ipfsHash,
				[antEggs[0].keyword, antEggs[0].keyword],
				[antEggs[0].svg],
				[antEggs[0].name],
				{
					from: minter,
					gas: GAS_LIMIT
				}
			);

			currentNftId = await this.Ingredient.getCurrentNftId();
		});
		it('should initialize the min duration correctly', async () => {
			const minDuration = await this.publicMarketplace.minDuration();
			expect(minDuration).to.bignumber.be.eq(new BN('86400'));
		});

		it('should initialize the NFT contract address correctly', async () => {
			const nftContractAddress = await this.publicMarketplace.nftContract();
			expect(this.Ingredient.address).to.be.eq(nftContractAddress);
		});
	});

	describe('sellNFT()', () => {
		let currentPrivateSaleId;
		let currentSaleId;

		before('create and sell NFT to user1', async () => {
			// create the NFT and list for sale
			this.saleTx = await this.privateMarketplace.createAndSellNFT(
				ether('1'),
				this.sampleToken.address,
				10,
				'Papaya',
				nutritionHash,
				ipfsHash,
				[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
				[papayas[0].svg, papayas[1].svg, papayas[2].svg],
				[papayas[0].name, papayas[1].name, papayas[2].name],
				{
					from: minter
				}
			);
			currentNftId = await this.Ingredient.getCurrentNftId();

			currentPrivateSaleId = await this.privateMarketplace.getCurrentSaleId();

			// buy nft from sale to close sale
			await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, {from: user1});

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			this.user1NftBal = await this.Ingredient.balanceOf(user1, currentNftId);

			// approve nft to PublicMarketplace contract
			await this.Ingredient.setApprovalForAll(this.publicMarketplace.address, true, {
				from: user1
			});

			// create sale for the nft
			this.sale1 = await this.publicMarketplace.sellNFT(
				currentNftId,
				ether('2'),
				this.sampleToken.address,
				{
					from: user1
				}
			);
		});

		it('should generate sale id correctly', async () => {
			currentSaleId = await this.publicMarketplace.getCurrentSaleId();

			const userSaleIds = await this.publicMarketplace.userSaleIds(user1, 0);

			expect(userSaleIds).to.bignumber.be.eq(new BN('1'));
			expect(currentSaleId).to.bignumber.be.eq(new BN('1'));
		});

		it('should store sale details correctly', async () => {
			// get sale details
			const sale = await this.publicMarketplace.sale(currentSaleId);
			const userTotalSales = await this.publicMarketplace.userTotalSales(user1);

			expect(sale.seller).to.be.eq(user1);
			expect(sale.buyer).to.be.eq(ZERO_ADDRESS);
			expect(sale.currency).to.be.eq(this.sampleToken.address);
			expect(sale.nftId).to.bignumber.be.eq(currentNftId);
			expect(sale.totalCopies).to.bignumber.be.eq(new BN('1'));
			expect(sale.remainingCopies).to.bignumber.be.eq(new BN('1'));
			expect(sale.sellingPrice).to.bignumber.be.eq(new BN(ether('2')));
			expect(sale.sellTimeStamp).to.bignumber.be.eq(new BN('0'));
			expect(sale.cancelTimeStamp).to.bignumber.be.eq(new BN('0'));
			expect(userTotalSales).to.bignumber.be.eq(new BN('1'));
		});

		it('should revert when seller tries to create NFT sale with unsupported tokens', async () => {
			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			await expectRevert(
				this.publicMarketplace.sellNFT(currentNftId, ether('2'), ZERO_ADDRESS, {from: user1}),
				'Market: UNSUPPORTED_TOKEN'
			);
		});

		it('should revert when seller tries to create NFT sale with 0 initial price', async () => {
			await expectRevert(
				this.publicMarketplace.sellNFT(currentNftId, ether('0'), this.sampleToken.address, {
					from: user1
				}),
				'PublicMarket: INVALID_NFT_PRICE'
			);
		});

		it('should emit event after successfully creating nft sale', async () => {
			await expectEvent(this.sale1, 'NewNFTListing', [user1, '1']);
		});
	});

	describe('createNFTAuction()', () => {
		let currentPrivateSaleId;
		let currentAuctionId;

		before('create and auction NFT', async () => {
			currentPrivateSaleId = await this.privateMarketplace.getCurrentSaleId();

			// approve nft to PublicMarketplace contract
			await this.Ingredient.setApprovalForAll(this.publicMarketplace.address, true, {
				from: user1
			});

			// create auction
			this.auction1 = await this.publicMarketplace.createNFTAuction(
				currentNftId,
				ether('1'),
				this.sampleToken.address,
				String(time.duration.days('2')),
				{
					from: user1
				}
			);
		});

		it('should generate auction id correctly', async () => {
			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

			const userAuctionIds = await this.publicMarketplace.userAuctionIds(user1, 0);

			expect(currentAuctionId).to.bignumber.be.eq(new BN('1'));
			expect(userAuctionIds).to.bignumber.be.eq(new BN('1'));
		});

		it('should store auction details correctly', async () => {
			// get auction details
			const auction = await this.publicMarketplace.auction(currentAuctionId);
			const userTotalAuctions = await this.publicMarketplace.userTotalAuctions(user1);

			expect(auction.nftId).to.bignumber.be.eq(currentNftId);
			expect(auction.sellerAddress).to.be.eq(user1);
			expect(auction.initialPrice).to.bignumber.be.eq(ether('1'));
			expect(auction.currency).to.be.eq(this.sampleToken.address);
			expect(auction.duration).to.bignumber.be.eq(new BN(String(time.duration.days('2'))));
			expect(auction.status).to.bignumber.be.eq(new BN('1'));
			expect(auction.winningBidId).to.bignumber.be.eq(new BN('0'));
			expect(auction.cancelTimeStamp).to.bignumber.be.eq(new BN('0'));
			expect(auction.buyTimestamp).to.bignumber.be.eq(new BN('0'));

			expect(userTotalAuctions).to.bignumber.be.eq(new BN('1'));
		});
		it('should revert when seller tries to create auction with invalid duration', async () => {
			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			await expectRevert(
				this.publicMarketplace.createNFTAuction(
					currentNftId,
					ether('1'),
					this.sampleToken.address,
					'100',
					{
						from: user1
					}
				),
				'Market: INVALID_DURATION'
			);
		});

		it('should revert when seller tries to create NFT and auction with unsupported tokens', async () => {
			await expectRevert(
				this.publicMarketplace.createNFTAuction(
					currentNftId,
					ether('1'),
					ZERO_ADDRESS,
					String(time.duration.days('2')),
					{
						from: user1
					}
				),
				'Market: UNSUPPORTED_TOKEN'
			);
		});

		it('should revert when minter tries to create NFT and auction with 0 initial price', async () => {
			await expectRevert(
				this.publicMarketplace.createNFTAuction(
					currentNftId,
					ether('0'),
					this.sampleToken.address,
					String(time.duration.days('2')),
					{
						from: user1
					}
				),
				'PublicMarket: INVALID_INITIAL_NFT_PRICE'
			);
		});

		it('should emit event after successfully creating nft auction', async () => {
			await expectEvent(this.auction1, 'NFTAuction', [user1, '1']);
		});
	});

	describe('updateSale()', () => {
		let saleBeforeUpdate;

		let currentSaleId;
		before('update current sale', async () => {
			currentSaleId = await this.publicMarketplace.getCurrentSaleId();

			saleBeforeUpdate = await this.publicMarketplace.sale(currentSaleId);

			// update sale
			await this.publicMarketplace.updateSale(currentSaleId, ether('3'), {from: user1});
		});

		it('should update sale price correctly', async () => {
			const saleAfterUpdate = await this.publicMarketplace.sale(currentSaleId);

			expect(saleAfterUpdate.sellingPrice).to.bignumber.be.gt(saleBeforeUpdate.sellingPrice);
			expect(saleAfterUpdate.sellingPrice).to.bignumber.be.eq(ether('3'));
		});

		it('should revert when non-seller tries to update the sale', async () => {
			await expectRevert(
				this.publicMarketplace.updateSale(currentSaleId, ether('2'), {from: user2}),
				'Market:ONLY_SELLER_CAN_UPDATE'
			);
		});

		it('should revert when seller tries to update the sale with zero price', async () => {
			await expectRevert(
				this.publicMarketplace.updateSale(currentSaleId, ether('0'), {from: user1}),
				'Market: INVALID_SELLING_PRICE'
			);
		});

		it('should revert when seller tries to update the sale with same price', async () => {
			await expectRevert(
				this.publicMarketplace.updateSale(currentSaleId, ether('3'), {from: user1}),
				'Market: INVALID_SELLING_PRICE'
			);
		});

		it('should revert when seller tries to update the sale with invalid sale id', async () => {
			await expectRevert(
				this.publicMarketplace.updateSale(15, ether('5'), {from: user1}),
				'Market: INVALID_SALE_ID'
			);
		});

		it('should revert when seller tries to update the sale which is ended already', async () => {
			// buy nft from sale to close sale
			await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, {from: user2});
			await this.publicMarketplace.buyNFT(currentSaleId, {from: user2});

			await expectRevert(
				this.publicMarketplace.updateSale(currentSaleId, ether('4'), {from: user1}),
				'Market: SALE_ALREADY_ENDED'
			);
		});
	});

	describe('updateAuction()', () => {
		let currentAuctionId;
		let auctionBeforeUpdate;

		before('update current auction', async () => {
			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();
			auctionBeforeUpdate = await this.publicMarketplace.auction(currentAuctionId);

			// update auction
			await this.publicMarketplace.updateAuction(
				currentAuctionId,
				ether('2'),
				String(time.duration.days('1')),
				{
					from: user1
				}
			);
		});

		it('should update the initial price and duration correctly', async () => {
			const auctionAfterUpdate = await this.publicMarketplace.auction(currentAuctionId);

			expect(auctionBeforeUpdate.initialPrice).to.bignumber.be.eq(ether('1'));
			expect(auctionBeforeUpdate.duration).to.bignumber.be.eq(String(time.duration.days('2')));
			expect(auctionAfterUpdate.initialPrice).to.bignumber.be.eq(ether('2'));
			expect(auctionAfterUpdate.duration).to.bignumber.be.eq(String(time.duration.days('3')));
		});

		it('should revert when non-seller tries to update the auction', async () => {
			await expectRevert(
				this.publicMarketplace.updateAuction(
					currentAuctionId,
					ether('3'),
					String(time.duration.days('3')),
					{
						from: user3
					}
				),
				'Market:ONLY_SELLER_CAN_UPDATE'
			);
		});

		it('should revert when seller tries to update the auction with zero initial price', async () => {
			await expectRevert(
				this.publicMarketplace.updateAuction(
					currentAuctionId,
					ether('0'),
					String(time.duration.days('1')),
					{
						from: user1
					}
				),
				'Market: INVALID_INITIAL_PRICE'
			);
		});

		it('should revert when seller tries to update the auction with same initial price', async () => {
			await expectRevert(
				this.publicMarketplace.updateAuction(
					currentAuctionId,
					ether('2'),
					String(time.duration.days('1')),
					{
						from: user1
					}
				),
				'Market: INVALID_INITIAL_PRICE'
			);
		});

		it('should revert when seller tries to update the auction with invalid auction id', async () => {
			await expectRevert(
				this.publicMarketplace.updateAuction(9, ether('5'), String(time.duration.days('1')), {
					from: user1
				}),
				'Market: INVALID_AUCTION_ID'
			);
		});

		it('should revert when seller tries to update the auction with non-zero bids', async () => {
			// approve tokens
			await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, {from: user2});

			// place bid
			this.bidTx = await this.publicMarketplace.placeBid(currentAuctionId, ether('2'), {
				from: user2
			});

			await expectRevert(
				this.publicMarketplace.updateAuction(
					currentAuctionId,
					ether('3'),
					String(time.duration.days('1')),
					{
						from: user1
					}
				),
				'Market: CANNOT_UPDATE_AUCTION_WITH_NON_ZERO_BIDS'
			);
		});

		it('should emit PlaceBid event when user places bid', async () => {
			await expectEvent(this.bidTx, 'PlaceBid');
		});

		it('should revert when seller tries to update the inactive auction', async () => {
			// advance time
			await time.increase(String(time.duration.days('3')));
			// stash tokens
			await this.Ingredient.safeTransferFrom(user2, stash, currentNftId, 1, '0x384', {from: user2});

			// resolve auction
			await this.publicMarketplace.resolveAuction(currentAuctionId);

			await expectRevert(
				this.publicMarketplace.updateAuction(
					currentAuctionId,
					ether('3'),
					String(time.duration.days('1')),
					{
						from: user1
					}
				),
				'Market: CANNOT_UPDATE_INACTIVE_AUCTION'
			);
		});
	});

	describe('cancelSaleAndClaimNFT()', () => {
		let currentPrivateSaleId;
		let currentSaleId;
		let saleBeforeCancel;
		let user1NFTBalBefore;
		before('cancelSaleAndClaimNFT', async () => {
			currentPrivateSaleId = await this.privateMarketplace.getCurrentSaleId();
			// stash tokens
			await this.Ingredient.safeTransferFrom(user1, stash, currentNftId, 1, '0x384', {from: user1});

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			// create sale for the nft
			await this.publicMarketplace.sellNFT(currentNftId, ether('2'), this.sampleToken.address, {
				from: user1
			});

			currentSaleId = await this.publicMarketplace.getCurrentSaleId();
			saleBeforeCancel = await this.publicMarketplace.sale(currentSaleId);
			user1NFTBalBefore = await this.Ingredient.balanceOf(user1, currentNftId);

			// cancel sale
			await this.publicMarketplace.cancelSaleAndClaimToken(currentSaleId, {from: user1});
		});

		it('should update sale status to canceled correctly', async () => {
			const user1NFTBalAfter = await this.Ingredient.balanceOf(user1, currentNftId);

			const saleAfter = await this.publicMarketplace.sale(currentSaleId);

			const isActiveSale = await this.publicMarketplace.isActiveSale(currentSaleId);

			expect(user1NFTBalBefore).to.bignumber.be.eq(new BN('0'));
			expect(user1NFTBalAfter).to.bignumber.be.eq(new BN('1'));
			expect(saleBeforeCancel.cancelTimeStamp).to.bignumber.be.eq(new BN('0'));
			expect(saleAfter.cancelTimeStamp).to.bignumber.be.gt(new BN('0'));
			expect(isActiveSale).to.be.eq(false);
		});

		it('should revert if non-seller tries to cancel the sale', async () => {
			await expectRevert(
				this.publicMarketplace.cancelSaleAndClaimToken(currentSaleId, {from: user3}),
				'PublicMarket: ONLY_SELLER_CAN_CANCEL'
			);
		});

		it('should revert if non-seller tries to cancel the inactive sale', async () => {
			await expectRevert(
				this.publicMarketplace.cancelSaleAndClaimToken(currentSaleId, {from: user1}),
				'PublicMarket: CANNOT_CANCEL_INACTIVE_SALE'
			);
		});
	});

	describe('cancelAuctionAndClaimNFT()', () => {
		let currentPrivateSaleId;

		let currentAuctionId;
		let AuctionBeforeCancel;
		let user1NFTBalBefore;
		before('cancel auction and claim nft', async () => {
			currentPrivateSaleId = await this.privateMarketplace.getCurrentSaleId();
			// stash tokens
			await this.Ingredient.safeTransferFrom(user1, stash, currentNftId, 1, '0x384', {from: user1});

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			// create auction
			await this.publicMarketplace.createNFTAuction(
				currentNftId,
				ether('1'),
				this.sampleToken.address,
				String(time.duration.days('2')),
				{
					from: user1
				}
			);

			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();
			AuctionBeforeCancel = await this.publicMarketplace.auction(currentAuctionId);
			user1NFTBalBefore = await this.Ingredient.balanceOf(user1, currentNftId);
		});

		it('should transfer nft back to user after cancelling auction', async () => {
			// cancel sale
			await this.publicMarketplace.cancelAuctionAndClaimToken(currentAuctionId, {from: user1});

			const AuctionAfterCancel = await this.publicMarketplace.auction(currentAuctionId);
			const user1NFTBalAfter = await this.Ingredient.balanceOf(user1, currentNftId);

			expect(AuctionBeforeCancel.status).to.bignumber.be.eq(new BN('1'));
			expect(AuctionAfterCancel.status).to.bignumber.be.eq(new BN('2'));
			expect(user1NFTBalBefore).to.bignumber.be.eq(new BN('0'));
			expect(user1NFTBalAfter).to.bignumber.be.eq(new BN('1'));
		});

		it('should revert when non-seller tries to cancel the canceled auction', async () => {
			// cancel auction again
			await expectRevert(
				this.publicMarketplace.cancelAuctionAndClaimToken(currentAuctionId, {from: user1}),
				'PublicMarket: CANNOT_CANCEL_INACTIVE_AUCTION'
			);
		});

		it('should not cancel auction with non-zero bids', async () => {
			// create auction
			await this.publicMarketplace.createNFTAuction(
				currentNftId,
				ether('1'),
				this.sampleToken.address,
				String(time.duration.days('2')),
				{
					from: user1
				}
			);

			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

			// place bid
			await this.publicMarketplace.placeBid(currentAuctionId, ether('3'), {from: user2});

			await expectRevert(
				this.publicMarketplace.cancelAuctionAndClaimToken(currentAuctionId, {from: user1}),
				'PublicMarket: CANNOT_CANCEL_AUCTION_WITH_NON_ZERO_BIDS'
			);
		});

		it('should revert when non-seller tries to cancel the auction', async () => {
			await expectRevert(
				this.publicMarketplace.cancelAuctionAndClaimToken(currentAuctionId, {from: user3}),
				'PublicMarket: ONLY_NFT_SELLER_CAN_CANCEL'
			);
		});

		it('should revert when seller tries to cancel auction with invalid auction id', async () => {
			await expectRevert(
				this.publicMarketplace.cancelAuctionAndClaimToken(16, {from: user1}),
				'Market: INVALID_AUCTION_ID'
			);
		});
	});

	describe('buyNFT()', () => {
		let currentPrivateSaleId;
		let royaltyReceiverBalBefore;
		let currentSaleId;
		let publicMarketNFTBalBefore;
		let publicMarketNFTBalAfter;
		let user2NFTBalBefore;
		before('buy nft from sale', async () => {
			currentPrivateSaleId = await this.privateMarketplace.getCurrentSaleId();

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			// create sale for the nft
			await this.publicMarketplace.sellNFT(currentNftId, ether('10'), this.sampleToken.address, {
				from: user1
			});
			// stash tokens
			await this.Ingredient.safeTransferFrom(user2, stash, currentNftId, 1, '0x384', {from: user2});

			currentSaleId = await this.publicMarketplace.getCurrentSaleId();

			royaltyReceiverBalBefore = await this.sampleToken.balanceOf(royaltyReceiver);

			user2NFTBalBefore = await this.Ingredient.balanceOf(user2, currentNftId);
			publicMarketNFTBalBefore = await this.Ingredient.balanceOf(
				this.publicMarketplace.address,
				currentNftId
			);

			// buy nft from sale
			this.buyNFTTx = await this.publicMarketplace.buyNFT(currentSaleId, {from: user2});
		});

		it('should reflect nft in user wallet and close the sale correctly', async () => {
			publicMarketNFTBalAfter = await this.Ingredient.balanceOf(
				this.publicMarketplace.address,
				currentNftId
			);

			const user2NFTBalAfter = await this.Ingredient.balanceOf(user2, currentNftId);

			expect(user2NFTBalBefore).to.bignumber.be.eq(new BN('0'));
			expect(user2NFTBalAfter).to.bignumber.be.eq(new BN('1'));
			expect(publicMarketNFTBalBefore).to.bignumber.be.eq(new BN('2'));
			expect(publicMarketNFTBalAfter).to.bignumber.be.eq(new BN('1'));
		});

		it('should transfer the royalty amount to royalty receiver correctly', async () => {
			const royalty = await this.Ingredient.royaltyInfo(currentNftId, ether('10'));

			// get balance of royalty receiver
			const royaltyReceiverBalAfter = await this.sampleToken.balanceOf(royaltyReceiver);

			// royalty receiver should get the 10% of total saleprice
			expect(royaltyReceiverBalAfter.sub(royaltyReceiverBalBefore)).to.bignumber.be.eq(ether('1'));

			expect(new BN(royalty[1])).to.bignumber.be.eq(ether('1'));
		});

		it('should emit BuySaleNFT event when user buys NFT from sale', async () => {
			await expectEvent(this.buyNFTTx, 'BuySaleNFT');
		});

		it('should revert when user tries to buy from invalid sale', async () => {
			await expectRevert(
				this.publicMarketplace.buyNFT(15, {from: user2}),
				'Market: INVALID_SALE_ID'
			);
		});

		it('should revert when user tries to buy from inactive sale', async () => {
			await expectRevert(
				this.publicMarketplace.buyNFT(currentSaleId, {from: user2}),
				'Market: CANNOT_BUY_FROM_INACTIVE_SALE'
			);
		});
	});

	describe('moveNftInSale()', () => {
		let currentPrivateSaleId;

		let currentSaleId;
		let currentAuctionId;

		before('moveNftInSale', async () => {
			currentPrivateSaleId = await this.privateMarketplace.getCurrentSaleId();

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			// create auction
			await this.publicMarketplace.createNFTAuction(
				currentNftId,
				ether('1'),
				this.sampleToken.address,
				String(time.duration.days('2')),
				{
					from: user1
				}
			);

			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();
		});

		it('should store sale details and cancel the exisiting auction correctly', async () => {
			// move nft from auction to sale
			this.tx = await this.publicMarketplace.moveNftInSale(currentAuctionId, ether('2'), {
				from: user1
			});

			currentSaleId = await this.publicMarketplace.getCurrentSaleId();

			const auction = await this.publicMarketplace.auction(currentAuctionId);
			expect(auction.status).to.bignumber.be.eq(new BN('2'));

			const sale = await this.publicMarketplace.sale(currentSaleId);

			expect(sale.seller).to.be.eq(user1);
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
				this.publicMarketplace.moveNftInSale(currentAuctionId, ether('2'), {from: user1}),
				'Market: CANNOT_MOVE_NFT_FROM_INACTIVE_AUCTION'
			);
		});

		it('should revert when seller tries to move nft from auction to sale with non zero bids', async () => {
			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			// create auction
			await this.publicMarketplace.createNFTAuction(
				currentNftId,
				ether('1'),
				this.sampleToken.address,
				String(time.duration.days('2')),
				{
					from: user1
				}
			);

			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

			// place bid
			await this.publicMarketplace.placeBid(currentAuctionId, ether('4'), {from: user2});

			await expectRevert(
				this.publicMarketplace.moveNftInSale(currentAuctionId, ether('2'), {from: user1}),
				'Market: CANNOT_UPDATE_AUCTION'
			);
		});

		it('should revert when non-seller tries to move nft from auction to sale', async () => {
			await expectRevert(
				this.publicMarketplace.moveNftInSale(currentAuctionId, ether('2'), {from: user3}),
				'Market: CALLER_NOT_THE_AUCTION_CREATOR'
			);
		});

		it('should revert when seller tries to move nft from auction to sale with 0 selling price', async () => {
			await expectRevert(
				this.publicMarketplace.moveNftInSale(currentAuctionId, ether('0'), {from: minter}),
				'Market: INVALID_SELLING_PRICE'
			);
		});
	});

	describe('addSupportedToken()', () => {
		let isSupportedBefore;
		before('add supported token', async () => {
			isSupportedBefore = await this.publicMarketplace.supportedTokens(ZERO_ADDRESS);

			// add supported token
			await this.publicMarketplace.addSupportedToken(ZERO_ADDRESS, {from: operator});
		});

		it('should add supported token correctly', async () => {
			const isSupportedAfter = await this.publicMarketplace.supportedTokens(ZERO_ADDRESS);

			expect(isSupportedBefore).to.be.eq(false);
			expect(isSupportedAfter).to.be.eq(true);
		});

		it('should revert when admin tries to add token which is already supported', async () => {
			await expectRevert(
				this.publicMarketplace.addSupportedToken(ZERO_ADDRESS, {from: operator}),
				'Market: TOKEN_ALREADY_ADDED'
			);
		});

		it('should revert when non-admin tries to add the supported token', async () => {
			await expectRevert(
				this.publicMarketplace.addSupportedToken(ZERO_ADDRESS, {from: user2}),
				'Market: ONLY_OPERATOR_CAN_CALL'
			);
		});
	});

	describe('removeSupportedToken()', () => {
		let isSupportedBefore;
		before('remove supported token', async () => {
			isSupportedBefore = await this.publicMarketplace.supportedTokens(ZERO_ADDRESS);

			// add supported token
			await this.publicMarketplace.addSupportedToken(this.privateMarketplace.address, {
				from: operator
			});

			// remove supported token
			await this.publicMarketplace.removeSupportedToken(ZERO_ADDRESS, {from: operator});

			// remove supported token
			await this.publicMarketplace.removeSupportedToken(this.privateMarketplace.address, {
				from: operator
			});
		});

		it('should remove supported token correctly', async () => {
			const isSupportedAfter = await this.publicMarketplace.supportedTokens(ZERO_ADDRESS);
			const isSupportedAfter1 = await this.publicMarketplace.supportedTokens(
				this.privateMarketplace.address
			);

			expect(isSupportedBefore).to.be.eq(true);
			expect(isSupportedAfter).to.be.eq(false);
			expect(isSupportedAfter1).to.be.eq(false);
		});

		it('should revert when admin tries to remove token which does not supports already', async () => {
			await expectRevert(
				this.publicMarketplace.removeSupportedToken(ZERO_ADDRESS, {from: operator}),
				'Market: TOKEN_DOES_NOT_EXISTS'
			);
		});

		it('should revert when non-admin tries to remove the supported token', async () => {
			await expectRevert(
				this.publicMarketplace.removeSupportedToken(ZERO_ADDRESS, {from: minter}),
				'Market: ONLY_OPERATOR_CAN_CALL'
			);
		});
	});

	describe('updateMinimumDuration()', async () => {
		let minimumDurationBefore;

		before('update minimum duration', async () => {
			minimumDurationBefore = await this.publicMarketplace.minDuration();

			// update minimum duration
			await this.publicMarketplace.updateMinimumDuration(String(time.duration.days('4')), {
				from: operator
			});
		});
		after('reset minimum duration to 1 days', async () => {
			// update minimum duration
			await this.publicMarketplace.updateMinimumDuration(String(time.duration.days('1')), {
				from: operator
			});
		});

		it('update minimum duration correctly', async () => {
			const minDurationAfter = await this.publicMarketplace.minDuration();
			expect(minDurationAfter).to.bignumber.be.eq(new BN('345600'));
		});

		it('should revert when admin tries to update minimum duration with same duration', async () => {
			await expectRevert(
				this.publicMarketplace.updateMinimumDuration(String(time.duration.days('4')), {
					from: operator
				}),
				'MintingStatoin: INVALID_MINIMUM_DURATION'
			);
		});

		it('should revert when admin tries to update minimum duration to zero', async () => {
			await expectRevert(
				this.publicMarketplace.updateMinimumDuration(String(time.duration.days('0')), {
					from: operator
				}),
				'MintingStatoin: INVALID_MINIMUM_DURATION'
			);
		});
		it('should revert when non-admin tries to update minimum duration', async () => {
			await expectRevert(
				this.publicMarketplace.updateMinimumDuration(String(time.duration.days('3')), {
					from: user2
				}),
				'Market: ONLY_OPERATOR_CAN_CALL'
			);
		});
	});

	describe('placeBid()', async () => {
		let currentAuctionId;

		let user2BalanceBefore;
		let user2BalanceAfter;
		let currentBidId;
		let currentPrivateSaleId;

		before('create auction', async () => {
			// create the NFT and list for sale
			await this.privateMarketplace.createAndSellNFT(
				ether('1'),
				this.sampleToken.address,
				10,
				'Papaya',
				nutritionHash,
				ipfsHash,
				[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
				[papayas[0].svg, papayas[1].svg, papayas[2].svg],
				[papayas[0].name, papayas[1].name, papayas[2].name],
				{
					from: minter
				}
			);
			currentNftId = await this.Ingredient.getCurrentNftId();

			currentPrivateSaleId = await this.privateMarketplace.getCurrentSaleId();

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			// create auction
			await this.publicMarketplace.createNFTAuction(
				currentNftId,
				ether('1'),
				this.sampleToken.address,
				String(time.duration.days('2')),
				{
					from: user1
				}
			);

			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();
			user2BalanceBefore = await this.sampleToken.balanceOf(user2);

			// place bid for user1
			await this.publicMarketplace.placeBid(currentAuctionId, ether('2'), {from: user2});

			currentBidId = await this.publicMarketplace.getCurrentBidId();
		});

		it('should set store bid details correctly', async () => {
			user2BalanceAfter = await this.sampleToken.balanceOf(user2);
			expect(user2BalanceBefore).to.bignumber.be.gt(user2BalanceAfter);

			const userTotalBids = await this.publicMarketplace.userTotalBids(user2);
			expect(userTotalBids).to.bignumber.be.eq(new BN('4'));

			const auction = await this.publicMarketplace.auction(currentAuctionId);
			expect(auction.winningBidId).to.bignumber.be.eq(currentBidId);

			const bid = await this.publicMarketplace.bid(currentBidId);

			expect(bid.auctionId).to.bignumber.be.eq(currentAuctionId);
			expect(bid.bidAmount).to.bignumber.be.eq(ether('2'));
			expect(bid.bidderAddress).to.be.eq(user2);
		});

		it('should return the tokens to previous bidder when someone places new bid', async () => {
			await this.sampleToken.approve(this.publicMarketplace.address, MAX_UINT256, {from: user3});

			const user3BalBefore = await this.sampleToken.balanceOf(user3);

			// place bid for user3
			await this.publicMarketplace.placeBid(currentAuctionId, ether('3'), {from: user3});

			currentBidId = await this.publicMarketplace.getCurrentBidId();

			const user3BalAfter = await this.sampleToken.balanceOf(user3);
			user2BalanceAfter = await this.sampleToken.balanceOf(user2);

			expect(user3BalBefore).to.bignumber.be.gt(user3BalAfter);
			expect(user2BalanceAfter).to.bignumber.be.eq(user2BalanceBefore);

			const auction = await this.publicMarketplace.auction(currentAuctionId);
			expect(auction.winningBidId).to.bignumber.be.eq(currentBidId);
		});

		it('should get the total bids on auction correctly', async () => {
			const totalBids = await this.publicMarketplace.getTotalBidsOfAuction(currentAuctionId);
			expect(totalBids).to.bignumber.be.eq(new BN('2'));
		});

		it('should revert if tokens are not approved before placing bid', async () => {
			await this.sampleToken.mint(accounts[6], ether('7'), {from: owner});

			await expectRevert(
				this.publicMarketplace.placeBid(currentAuctionId, ether('7'), {from: accounts[6]}),
				'ERC20: transfer amount exceeds allowance'
			);
		});

		it('should revert when auction creator tries to place bid', async () => {
			await expectRevert(
				this.publicMarketplace.placeBid(currentAuctionId, ether('5'), {from: user1}),
				'Market: OWNER_CANNOT_PLACE_BID'
			);
		});

		it('should revert when bidder tries to place bid with same bidamount', async () => {
			await expectRevert(
				this.publicMarketplace.placeBid(currentAuctionId, ether('3'), {from: user2}),
				'Market: INVALID_BID_AMOUNT'
			);
		});

		it('should revert when bidder tries to place bid with less than initial auction price', async () => {
			await expectRevert(
				this.publicMarketplace.placeBid(currentAuctionId, '500000000000000000', {from: user2}),
				'Market: INVALID_BID_AMOUNT'
			);
		});

		it('should revert when bidder tries to bid after auction period', async () => {
			// advance time
			await time.increase(String(time.duration.days('3')));

			await expectRevert(
				this.publicMarketplace.placeBid(currentAuctionId, ether('5'), {from: user2}),
				'Market: CANNOT_BID_AFTER_AUCTION_ENDS.'
			);
		});

		it('should revert when bidder tries to bid on inactive auction', async () => {
			// resolve auction
			await this.publicMarketplace.resolveAuction(currentAuctionId);

			await expectRevert(
				this.publicMarketplace.placeBid(currentAuctionId, ether('6'), {from: user3}),
				'Market: CANNOT_BID_ON_INACTIVE_AUCTION'
			);
		});

		it('should revert when bidder tries to bid with invalid auction id', async () => {
			await expectRevert(
				this.publicMarketplace.placeBid(15, ether('6'), {from: user2}),
				'Market: INVALID_AUCTION_ID'
			);
		});
	});

	describe('resolveAuction()', () => {
		let currentPrivateSaleId;
		let currentAuctionId;
		let royaltyReceiverBalBefore;
		let contractBalanceBefore;
		let currentBidId;
		let user2NFTBalanceBefore;
		let contractNFTBalanceBefore;
		before('resolve auction', async () => {
			// create the NFT and list for sale
			await this.privateMarketplace.createAndSellNFT(
				ether('1'),
				this.sampleToken.address,
				10,
				'Papaya',
				nutritionHash,
				ipfsHash,
				[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
				[papayas[0].svg, papayas[1].svg, papayas[2].svg],
				[papayas[0].name, papayas[1].name, papayas[2].name],
				{
					from: minter
				}
			);
			currentNftId = await this.Ingredient.getCurrentNftId();

			currentPrivateSaleId = await this.privateMarketplace.getCurrentSaleId();
			royaltyReceiverBalBefore = await this.sampleToken.balanceOf(royaltyReceiver);

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			// create auction
			await this.publicMarketplace.createNFTAuction(
				currentNftId,
				ether('1'),
				this.sampleToken.address,
				String(time.duration.days('2')),
				{
					from: user1
				}
			);

			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

			// place bid for user2
			await this.publicMarketplace.placeBid(currentAuctionId, ether('2'), {from: user2});

			currentBidId = await this.publicMarketplace.getCurrentBidId();

			user2NFTBalanceBefore = await this.Ingredient.balanceOf(user2, currentNftId);
			contractNFTBalanceBefore = await this.Ingredient.balanceOf(
				this.publicMarketplace.address,
				currentNftId
			);
			contractBalanceBefore = await this.sampleToken.balanceOf(this.publicMarketplace.address);
		});

		it('should revert when anyone tries to resolve auction before auction end time', async () => {
			await expectRevert(
				this.publicMarketplace.resolveAuction(currentAuctionId),
				'Market: CANNOT_RESOLVE_DURING_AUCTION'
			);
		});

		it('should resolve the auction and update the auction status to close', async () => {
			// advance time to finish auction phase
			await time.increase(String(time.duration.days('3')));

			// resolve auction
			this.resolveTx = await this.publicMarketplace.resolveAuction(currentAuctionId);

			const auction = await this.publicMarketplace.auction(currentAuctionId);

			const user2NFTBalanceAfter = await this.Ingredient.balanceOf(user2, currentNftId);
			const contractNFTBalanceAfter = await this.Ingredient.balanceOf(
				this.publicMarketplace.address,
				currentNftId
			);
			const contractBalanceAfter = await this.sampleToken.balanceOf(this.publicMarketplace.address);

			expect(auction.status).to.bignumber.be.eq(new BN('0'));
			expect(user2NFTBalanceBefore).to.bignumber.be.eq(new BN('0'));
			expect(contractNFTBalanceBefore).to.bignumber.be.eq(new BN('1'));
			expect(user2NFTBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(contractNFTBalanceAfter).to.bignumber.be.eq(new BN('0'));
			expect(contractBalanceBefore).to.bignumber.be.gt(contractBalanceAfter);
		});
		it('should transfer the royalty amount to royalty receiver correctly', async () => {
			const royalty = await this.Ingredient.royaltyInfo(currentNftId, ether('10'));

			// get balance of royalty receiver
			const royaltyReceiverBalAfter = await this.sampleToken.balanceOf(royaltyReceiver);

			// royalty receiver should get the 10% of total saleprice
			expect(royaltyReceiverBalAfter.sub(royaltyReceiverBalBefore)).to.bignumber.be.eq(
				ether('0.2')
			);

			expect(new BN(royalty[1])).to.bignumber.be.eq(ether('1'));
		});
		it('should emit BuyAuctionNFT event when user resolves the auction', async () => {
			await expectEvent(this.resolveTx, 'BuyAuctionNFT');
		});

		it('should revert when anyone tries to resolve auction which already resolved', async () => {
			await expectRevert(
				this.publicMarketplace.resolveAuction(currentAuctionId),
				'Market: CANNOT_RESOLVE_INACTIVE_AUCTION'
			);
		});

		it('should revert when anyone tries to resolve auction with no bids', async () => {
			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			// create auction
			await this.publicMarketplace.createNFTAuction(
				currentNftId,
				ether('1'),
				this.sampleToken.address,
				String(time.duration.days('2')),
				{
					from: user1
				}
			);

			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

			// advance time to finish auction phase
			await time.increase(String(time.duration.days('3')));

			await expectRevert(
				this.publicMarketplace.resolveAuction(currentAuctionId),
				'Market: CANNOT_RESOLVE_AUCTION_WITH_NO_BIDS'
			);
		});
	});

	describe('getAuctionWinningBid()', () => {
		let currentPrivateSaleId;
		let currentAuctionId;
		let currentBidId;

		let bid;
		before('get auction winning bid', async () => {
			// create the NFT and list for sale
			await this.privateMarketplace.createAndSellNFT(
				ether('1'),
				this.sampleToken.address,
				10,
				'Papaya',
				nutritionHash,
				ipfsHash,
				[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
				[papayas[0].svg, papayas[1].svg, papayas[2].svg],
				[papayas[0].name, papayas[1].name, papayas[2].name],
				{
					from: minter
				}
			);
			currentNftId = await this.Ingredient.getCurrentNftId();

			currentPrivateSaleId = await this.privateMarketplace.getCurrentSaleId();

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			// create auction
			await this.publicMarketplace.createNFTAuction(
				currentNftId,
				ether('1'),
				this.sampleToken.address,
				String(time.duration.days('2')),
				{
					from: user1
				}
			);

			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();

			// place bid for user2
			await this.publicMarketplace.placeBid(currentAuctionId, ether('2'), {from: user2});

			currentBidId = await this.publicMarketplace.getCurrentBidId();

			// get winning bid
			bid = await this.publicMarketplace.getAuctionWinningBid(currentAuctionId);
		});

		it('should get winning bid id correctly', async () => {
			expect(bid.bidderAddress).to.be.eq(user2);
			expect(bid.bidAmount).to.bignumber.be.eq(ether('2'));
			expect(bid.auctionId).to.bignumber.be.eq(currentAuctionId);

			const auction = await this.publicMarketplace.auction(currentAuctionId);

			expect(auction.winningBidId).to.bignumber.be.eq(currentBidId);
		});
	});

	describe('getters', () => {
		let currentPrivateSaleId;

		let currentAuctionId;
		let currentAuctionIdBefore;

		before('create auction', async () => {
			currentAuctionIdBefore = await this.publicMarketplace.getCurrentAuctionId();
			// create the NFT and list for sale
			await this.privateMarketplace.createAndSellNFT(
				ether('1'),
				this.sampleToken.address,
				10,
				'Papaya',
				nutritionHash,
				ipfsHash,
				[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
				[papayas[0].svg, papayas[1].svg, papayas[2].svg],
				[papayas[0].name, papayas[1].name, papayas[2].name],
				{
					from: minter
				}
			);

			currentNftId = await this.Ingredient.getCurrentNftId();
			currentPrivateSaleId = await this.privateMarketplace.getCurrentSaleId();

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user1});

			// create auction
			await this.publicMarketplace.createNFTAuction(
				currentNftId,
				ether('1'),
				this.sampleToken.address,
				String(time.duration.days('2')),
				{
					from: user1
				}
			);

			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();
		});

		it('should get current auction id correctly', async () => {
			currentAuctionId = await this.publicMarketplace.getCurrentAuctionId();
			expect(currentAuctionId).to.bignumber.be.gt(currentAuctionIdBefore);
		});

		it('should get current bid id correctly', async () => {
			// get current bidId
			const currentBidId = await this.publicMarketplace.getCurrentBidId();

			// place bid
			await this.publicMarketplace.placeBid(currentAuctionId, ether('2'), {from: user2});

			// get current bidId
			const bidId = await this.publicMarketplace.getCurrentBidId();

			expect(bidId).to.bignumber.be.gt(currentBidId);
		});

		it('should get current sale id correctly', async () => {
			const currentSaleIdBefore = await this.publicMarketplace.getCurrentSaleId();

			await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, {from: user2});

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentPrivateSaleId, {from: user2});

			// approve nft to PublicMarketplace contract
			await this.Ingredient.setApprovalForAll(this.publicMarketplace.address, true, {
				from: user2
			});

			// create sale for the nft
			await this.publicMarketplace.sellNFT(currentNftId, ether('2'), this.sampleToken.address, {
				from: user2
			});

			const currentSaleIdAfter = await this.publicMarketplace.getCurrentSaleId();
			expect(currentSaleIdAfter).to.bignumber.be.gt(currentSaleIdBefore);
		});

		it('should return isActiveSale correctly', async () => {
			const currentSaleId = await this.publicMarketplace.getCurrentSaleId();

			let isActive = await this.publicMarketplace.isActiveSale(currentSaleId);

			expect(isActive).to.be.eq(true);

			// cancel sale
			await this.publicMarketplace.cancelSaleAndClaimToken(currentSaleId, {from: user2});

			isActive = await this.publicMarketplace.isActiveSale(currentSaleId);
			expect(isActive).to.be.eq(false);
		});

		it('should return isSupported token correctly', async () => {
			let isSupported = await this.publicMarketplace.supportedTokens(this.sampleToken.address);
			expect(isSupported).to.be.eq(true);

			await this.publicMarketplace.removeSupportedToken(this.sampleToken.address, {from: operator});

			isSupported = await this.publicMarketplace.supportedTokens(this.sampleToken.address);
			expect(isSupported).to.be.eq(false);
		});
	});

	describe('upgradeProxy()', () => {
		let versionBeforeUpgrade;
		before('upgradeProxy', async () => {
			versionBeforeUpgrade = await this.publicMarketplace.getVersionNumber();
			// upgrade contract
			await upgradeProxy(this.publicMarketplace.address, PublicMarketplaceV2);
		});

		it('should upgrade contract correctly', async () => {
			const versionAfterUpgrade = await this.publicMarketplace.getVersionNumber();

			expect(versionBeforeUpgrade['0']).to.bignumber.be.eq(new BN('1'));
			expect(versionBeforeUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionBeforeUpgrade['2']).to.bignumber.be.eq(new BN('0'));

			expect(versionAfterUpgrade['0']).to.bignumber.be.eq(new BN('2'));
			expect(versionAfterUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionAfterUpgrade['2']).to.bignumber.be.eq(new BN('0'));
		});
	});
});
