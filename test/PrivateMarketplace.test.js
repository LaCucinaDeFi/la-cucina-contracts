require('chai').should();
const {expect} = require('chai');
const {expectRevert, ether, BN, time, expectEvent} = require('@openzeppelin/test-helpers');
const {ZERO_ADDRESS, MAX_UINT256} = require('@openzeppelin/test-helpers/src/constants');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const IngredientNFT = artifacts.require('IngredientsNFT');
const PrivateMarketplace = artifacts.require('PrivateMarketplace');
const PrivateMarketplaceV2 = artifacts.require('PrivateMarketplaceV2');

const {GAS_LIMIT, gasToEth} = require('./helper/utils');
const {Talien} = require('./helper/talien');
const papayas = require('../data/ingredients/papaya');

const SampleToken = artifacts.require('SampleToken');

const url = 'https://token-cdn-domain/{id}.json';
const ipfsHash = 'bafybeihabfo2rluufjg22a5v33jojcamglrj4ucgcw7on6v33sc6blnxcm';

contract('PrivateMarketplace', (accounts) => {
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
	let nutritionHash;

	before('Deploy ERC-1155 and Marketplace contracts', async () => {
		// deploy Lac token
		this.sampleToken = await SampleToken.new();

		// deploy NFT token
		this.Ingredient = await deployProxy(IngredientNFT, [url, royaltyReceiver, royaltyFee], {
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

		// add privateMarket as minter in ERC1155 contract.
		const minterRole = await this.Ingredient.MINTER_ROLE();
		await this.Ingredient.grantRole(minterRole, this.privateMarketplace.address);

		// grant updator role to talion contract
		const OPERATOR_ROLE = await this.Ingredient.OPERATOR_ROLE();
		await this.Ingredient.grantRole(OPERATOR_ROLE, operator, {from: owner});

		// add excepted address
		await this.Ingredient.addExceptedAddress(this.privateMarketplace.address, {from: operator});

		// add stash as excepted address
		await this.Ingredient.addExceptedAddress(stash, {from: operator});

		// add minter in privateMarketplace
		await this.privateMarketplace.grantRole(minterRole, minter, {from: owner});
		// add minter in privateMarketplace
		await this.privateMarketplace.grantRole(OPERATOR_ROLE, operator, {from: owner});

		// mint tokens to users
		await this.sampleToken.mint(user1, ether('100'), {from: owner});
		await this.sampleToken.mint(user2, ether('100'), {from: owner});
		await this.sampleToken.mint(user3, ether('100'), {from: owner});
	});

	describe('initialize()', () => {
		it('should initialize the min duration correctly', async () => {
			const minDuration = await this.privateMarketplace.minDuration();
			expect(minDuration).to.bignumber.be.eq(new BN('86400'));
		});

		it('should initialize the NFT contract address correctly', async () => {
			const nftContractAddress = await this.privateMarketplace.nftContract();
			expect(this.Ingredient.address).to.be.eq(nftContractAddress);
		});
	});

	describe('createAndSellNFT()', () => {
		let currentSaleId;
		let currentNftId;
		before('create and sell NFT', async () => {
			// add supported token
			await this.privateMarketplace.addSupportedToken(this.sampleToken.address, {from: operator});
			// add owner as excepted address
			await this.Ingredient.addExceptedAddress(owner, {from: operator});

			// ****************************************************************************

			// add ingredients
			// here ingredient name should be strictly like this. variationName = name_variationId. ex. Caviar_1, Tuna_2
			// NOTE: svg id and the name_variationId should be same. <g id= "Caviar_1">, <g id = "Tuna_2">

			nutritionHash = await this.Ingredient.getNutritionHash([14, 50, 20, 4, 6, 39, 25]);

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

			console.log(
				'gas cost for creating sale in new & exciting marketplace: ',
				gasToEth(this.saleTx.receipt.cumulativeGasUsed)
			);

			currentNftId = await this.Ingredient.getCurrentNftId();
		});

		it('should generate sale id and nft id correctly', async () => {
			currentSaleId = await this.privateMarketplace.getCurrentSaleId();

			const userSaleIds = await this.privateMarketplace.userSaleIds(minter, 0);

			expect(userSaleIds).to.bignumber.be.eq(new BN('1'));
			expect(currentNftId).to.bignumber.be.eq(new BN('1'));
			expect(currentSaleId).to.bignumber.be.eq(new BN('1'));
		});

		it('should store sale details correctly', async () => {
			// get sale details
			const sale = await this.privateMarketplace.sale(currentSaleId);
			const userTotalSales = await this.privateMarketplace.userTotalSales(minter);

			expect(sale.seller).to.be.eq(minter);
			expect(sale.buyer).to.be.eq(ZERO_ADDRESS);
			expect(sale.currency).to.be.eq(this.sampleToken.address);
			expect(sale.nftId).to.bignumber.be.eq(new BN('1'));
			expect(sale.totalCopies).to.bignumber.be.eq(new BN('10'));
			expect(sale.remainingCopies).to.bignumber.be.eq(new BN('10'));
			expect(sale.sellingPrice).to.bignumber.be.eq(new BN(ether('1')));
			expect(sale.sellTimeStamp).to.bignumber.be.eq(new BN('0'));
			expect(sale.cancelTimeStamp).to.bignumber.be.eq(new BN('0'));
			expect(userTotalSales).to.bignumber.be.eq(new BN('1'));
		});

		it('should revert when Non-Minter tries to create NFT and lists for sale', async () => {
			await expectRevert(
				this.privateMarketplace.createAndSellNFT(
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
						from: user1
					}
				),
				'PrivateMarketplace: MINTER_ROLE_REQUIRED'
			);
		});
		it('should revert when minter tries to create NFT sale with unsupported tokens', async () => {
			await expectRevert(
				this.privateMarketplace.createAndSellNFT(
					ether('1'),
					ZERO_ADDRESS,
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
				),
				'Market: UNSUPPORTED_TOKEN'
			);
		});
		it('should revert when minter tries to create NFT sale with 0 copies', async () => {
			await expectRevert(
				this.privateMarketplace.createAndSellNFT(
					ether('1'),
					this.sampleToken.address,
					0,
					'Papaya',
					nutritionHash,
					ipfsHash,
					[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
					[papayas[0].svg, papayas[1].svg, papayas[2].svg],
					[papayas[0].name, papayas[1].name, papayas[2].name],
					{
						from: minter
					}
				),
				'PrivateMarketplace: INVALID_NUMBER_OF_COPIES'
			);
		});
		it('should revert when minter tries to create NFT sale with 0 initial price', async () => {
			await expectRevert(
				this.privateMarketplace.createAndSellNFT(
					ether('0'),
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
				),
				'PrivateMarketplace: INVALID_NFT_PRICE'
			);
		});
		it('should emit event after successfully creating nft sale', async () => {
			await expectEvent(this.saleTx, 'NewNFTListing', [minter, '1']);
		});
	});

	describe('createAndAuctionNFT()', () => {
		let currentAuctionId;
		let currentNftId;
		before('create and auction NFT', async () => {
			// create auction
			this.auctionTx = await this.privateMarketplace.createAndAuctionNFT(
				ether('1'),
				this.sampleToken.address,
				time.duration.days('2'),
				false,
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

			console.log(
				'gas cost for creating auction in new & exciting marketplace: ',
				gasToEth(this.auctionTx.receipt.cumulativeGasUsed)
			);
			currentNftId = await this.Ingredient.getCurrentNftId();
		});

		it('should generate auction id and nft id correctly', async () => {
			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

			const userAuctionIds = await this.privateMarketplace.userAuctionIds(minter, 0);

			expect(currentNftId).to.bignumber.be.eq(new BN('2'));
			expect(currentAuctionId).to.bignumber.be.eq(new BN('1'));
			expect(userAuctionIds).to.bignumber.be.eq(new BN('1'));
		});

		it('should store auction details correctly', async () => {
			// get auction details
			const auction = await this.privateMarketplace.auction(currentAuctionId);
			const userTotalAuctions = await this.privateMarketplace.userTotalAuctions(minter);

			expect(auction.nftId).to.bignumber.be.eq(currentNftId);
			expect(auction.sellerAddress).to.be.eq(minter);
			expect(auction.initialPrice).to.bignumber.be.eq(ether('1'));
			expect(auction.currency).to.be.eq(this.sampleToken.address);
			expect(auction.duration).to.bignumber.be.eq(new BN(String(time.duration.days('2'))));
			expect(auction.status).to.bignumber.be.eq(new BN('1'));
			expect(auction.winningBidId).to.bignumber.be.eq(new BN('0'));
			expect(auction.cancelTimeStamp).to.bignumber.be.eq(new BN('0'));
			expect(auction.buyTimestamp).to.bignumber.be.eq(new BN('0'));
			expect(userTotalAuctions).to.bignumber.be.eq(new BN('1'));
		});
		it('should revert when Non-Minter tries to create NFT and lists for auction', async () => {
			await expectRevert(
				this.privateMarketplace.createAndAuctionNFT(
					ether('1'),
					this.sampleToken.address,
					String(time.duration.days('2')),
					false,
					'Papaya',
					nutritionHash,
					ipfsHash,
					[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
					[papayas[0].svg, papayas[1].svg, papayas[2].svg],
					[papayas[0].name, papayas[1].name, papayas[2].name],
					{
						from: user1
					}
				),
				'PrivateMarketplace: MINTER_ROLE_REQUIRED'
			);
		});

		it('should revert when minter tries to create NFT and auction with unsupported tokens', async () => {
			await expectRevert(
				this.privateMarketplace.createAndAuctionNFT(
					ether('1'),
					ZERO_ADDRESS,
					String(time.duration.days('2')),
					false,
					'Papaya',
					nutritionHash,
					ipfsHash,
					[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
					[papayas[0].svg, papayas[1].svg, papayas[2].svg],
					[papayas[0].name, papayas[1].name, papayas[2].name],
					{
						from: minter
					}
				),
				'Market: UNSUPPORTED_TOKEN'
			);
		});

		it('should revert when minter tries to create NFT and auction with 0 initial price', async () => {
			await expectRevert(
				this.privateMarketplace.createAndAuctionNFT(
					ether('0'),
					this.sampleToken.address,
					String(time.duration.days('2')),
					false,
					'Papaya',
					nutritionHash,
					ipfsHash,
					[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
					[papayas[0].svg, papayas[1].svg, papayas[2].svg],
					[papayas[0].name, papayas[1].name, papayas[2].name],
					{
						from: minter
					}
				),
				'PrivateMarketplace: INVALID_INITIAL_NFT_PRICE'
			);
		});
		it('should revert when minter tries to create NFT and auction for invalid duration', async () => {
			await expectRevert(
				this.privateMarketplace.createAndAuctionNFT(
					ether('1'),
					this.sampleToken.address,
					'0',
					false,
					'Papaya',
					nutritionHash,
					ipfsHash,
					[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
					[papayas[0].svg, papayas[1].svg, papayas[2].svg],
					[papayas[0].name, papayas[1].name, papayas[2].name],
					{
						from: minter
					}
				),
				'Market: INVALID_DURATION'
			);
		});

		it('should emit event after successfully creating nft auction', async () => {
			await expectEvent(this.auctionTx, 'NFTAuction', [minter, '1']);
		});
	});

	describe('updateSale()', () => {
		let currentNftId;
		let currentSaleId;
		let saleBeforeUpdate;
		before('update current sale', async () => {
			currentNftId = await this.Ingredient.getCurrentNftId();

			// create the NFT and list for sale
			await this.privateMarketplace.createAndSellNFT(
				ether('1'),
				this.sampleToken.address,
				1,
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

			currentSaleId = await this.privateMarketplace.getCurrentSaleId();

			saleBeforeUpdate = await this.privateMarketplace.sale(currentSaleId);

			// update sale
			await this.privateMarketplace.updateSale(currentSaleId, ether('2'), {from: minter});
		});

		it('should update sale price correctly', async () => {
			const saleAfterUpdate = await this.privateMarketplace.sale(currentSaleId);

			expect(saleBeforeUpdate.sellingPrice).to.bignumber.be.lt(saleAfterUpdate.sellingPrice);
			expect(saleAfterUpdate.sellingPrice).to.bignumber.be.eq(ether('2'));
		});

		it('should revert when non-seller tries to update the sale', async () => {
			await expectRevert(
				this.privateMarketplace.updateSale(currentSaleId, ether('2'), {from: user1}),
				'Market:ONLY_SELLER_CAN_UPDATE'
			);
		});

		it('should revert when seller tries to update the sale with zero price', async () => {
			await expectRevert(
				this.privateMarketplace.updateSale(currentSaleId, ether('0'), {from: minter}),
				'Market: INVALID_SELLING_PRICE'
			);
		});

		it('should revert when seller tries to update the sale with same price', async () => {
			await expectRevert(
				this.privateMarketplace.updateSale(currentSaleId, ether('2'), {from: minter}),
				'Market: INVALID_SELLING_PRICE'
			);
		});

		it('should revert when seller tries to update the sale with invalid sale id', async () => {
			await expectRevert(
				this.privateMarketplace.updateSale(15, ether('5'), {from: minter}),
				'Market: INVALID_SALE_ID'
			);
		});

		it('should revert when seller tries to update the sale which is ended already', async () => {
			// buy nft from sale to close sale
			await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, {from: user1});
			await this.privateMarketplace.buyNFT(currentSaleId, {from: user1});

			await expectRevert(
				this.privateMarketplace.updateSale(currentSaleId, ether('3'), {from: minter}),
				'Market: SALE_ALREADY_ENDED'
			);
		});
	});

	describe('updateAuction()', () => {
		let currentNftId;
		let currentAuctionId;
		let auctionBeforeUpdate;

		before('update current auction', async () => {
			currentNftId = await this.Ingredient.getCurrentNftId();

			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();
			auctionBeforeUpdate = await this.privateMarketplace.auction(currentAuctionId);

			// update auction
			await this.privateMarketplace.updateAuction(
				currentAuctionId,
				ether('2'),
				String(time.duration.days('1')),
				{
					from: minter
				}
			);
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
				this.privateMarketplace.updateAuction(
					currentAuctionId,
					ether('2'),
					String(time.duration.days('1')),
					{
						from: user1
					}
				),
				'Market:ONLY_SELLER_CAN_UPDATE'
			);
		});

		it('should revert when seller tries to update the auction with zero initial price', async () => {
			await expectRevert(
				this.privateMarketplace.updateAuction(
					currentAuctionId,
					ether('0'),
					String(time.duration.days('1')),
					{
						from: minter
					}
				),
				'Market: INVALID_INITIAL_PRICE'
			);
		});

		it('should revert when seller tries to update the auction with same initial price', async () => {
			await expectRevert(
				this.privateMarketplace.updateAuction(
					currentAuctionId,
					ether('2'),
					String(time.duration.days('1')),
					{
						from: minter
					}
				),
				'Market: INVALID_INITIAL_PRICE'
			);
		});

		it('should revert when seller tries to update the auction with invalid auction id', async () => {
			await expectRevert(
				this.privateMarketplace.updateAuction(4, ether('5'), String(time.duration.days('1')), {
					from: minter
				}),
				'Market: INVALID_AUCTION_ID'
			);
		});

		it('should revert when seller tries to update the auction with non-zero bids', async () => {
			// approve tokens
			await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, {from: user1});

			// place bid
			this.bidTx = await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), {
				from: user1
			});

			await expectRevert(
				this.privateMarketplace.updateAuction(
					currentAuctionId,
					ether('3'),
					String(time.duration.days('1')),
					{
						from: minter
					}
				),
				'Market: CANNOT_UPDATE_AUCTION_WITH_NON_ZERO_BIDS'
			);
		});

		it('should emit PlaceBid event when user places bid', async () => {
			await expectEvent(this.bidTx, 'PlaceBid');
		});

		it('should revert when seller tries to update the canceled auction', async () => {
			// create new Auction
			await this.privateMarketplace.createAndAuctionNFT(
				ether('1'),
				this.sampleToken.address,
				time.duration.days('2'),
				false,
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

			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

			// cancel auction
			await this.privateMarketplace.cancelAuction(currentAuctionId, {from: minter});

			await expectRevert(
				this.privateMarketplace.updateAuction(
					currentAuctionId,
					ether('3'),
					String(time.duration.days('1')),
					{
						from: minter
					}
				),
				'Market:ONLY_SELLER_CAN_UPDATE'
			);
		});
	});

	describe('canceleSale()', () => {
		let currentNftId;
		let currentSaleId;
		let privateMarketNFTBalBefore;
		let privateMarketNFTBalAfter;

		before('cancel sale', async () => {
			currentNftId = await this.Ingredient.getCurrentNftId();

			// create a sale
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

			currentSaleId = await this.privateMarketplace.getCurrentSaleId();

			privateMarketNFTBalBefore = await this.Ingredient.balanceOf(
				this.privateMarketplace.address,
				currentNftId
			);
		});

		it('should revert if non-seller tries to cancel the sale', async () => {
			await expectRevert(
				this.privateMarketplace.cancelSale(currentSaleId, {from: user2}),
				'PrivateMarketplace: MINTER_ROLE_REQUIRED'
			);

			it('should delete sale details correctly', async () => {
				// cancel sale
				await this.privateMarketplace.cancelSale(currentSaleId, {from: minter});

				privateMarketNFTBalAfter = await this.Ingredient.balanceOf(
					this.privateMarketplace.address,
					currentNftId
				);

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
					this.privateMarketplace.cancelSale(currentSaleId, {from: minter}),
					'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_SALE'
				);
			});
		});

		it('should not cancel sale if some of the copies of NFT are sold in sale', async () => {
			// create another sale
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
			currentSaleId = await this.privateMarketplace.getCurrentSaleId();

			// approve tokens
			await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, {from: user1});

			// buy nft from sale
			await this.privateMarketplace.buyNFT(currentSaleId, {from: user1});

			privateMarketNFTBalAfter = await this.Ingredient.balanceOf(
				this.privateMarketplace.address,
				currentNftId
			);

			expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('9'));

			await expectRevert(
				this.privateMarketplace.cancelSale(currentSaleId, {from: minter}),
				'PrivateMarketplace: CANNOT_CANCEL_SALE'
			);
		});
	});

	describe('cancelAuction()', () => {
		let currentNftId;
		let currentAuctionId;
		let privateMarketNFTBalBefore;
		let privateMarketNFTBalAfter;
		before('cancel the auction', async () => {
			currentNftId = await this.Ingredient.getCurrentNftId();

			// create auction
			await this.privateMarketplace.createAndAuctionNFT(
				ether('1'),
				this.sampleToken.address,
				time.duration.days('2'),
				false,
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

			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();
			privateMarketNFTBalBefore = await this.Ingredient.balanceOf(
				this.privateMarketplace.address,
				currentNftId
			);

			// cancel auction
			this.cancelAuctionTx = await this.privateMarketplace.cancelAuction(currentAuctionId, {
				from: minter
			});

			console.log(
				'gas cost for canceling auction in new & exciting marketplace: ',
				gasToEth(this.cancelAuctionTx.receipt.cumulativeGasUsed)
			);
		});

		it('shoud delete the auction data after canceling auction', async () => {
			privateMarketNFTBalAfter = await this.Ingredient.balanceOf(
				this.privateMarketplace.address,
				currentNftId
			);

			expect(privateMarketNFTBalBefore).to.bignumber.be.eq(new BN('9'));
			expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('9'));

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
				this.privateMarketplace.cancelAuction(currentAuctionId, {from: minter}),
				'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_AUCTION'
			);
		});

		it('should not cancel auction with non-zero bids', async () => {
			// create auction
			await this.privateMarketplace.createAndAuctionNFT(
				ether('1'),
				this.sampleToken.address,
				time.duration.days('2'),
				false,
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
			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

			// place bid
			await this.privateMarketplace.placeBid(currentAuctionId, ether('4'), {from: user1});

			await expectRevert(
				this.privateMarketplace.cancelAuction(currentAuctionId, {from: minter}),
				'PrivateMarketplace: CANNOT_CANCEL_AUCTION'
			);
		});

		it('should revert when non-seller tries to cancel the auction', async () => {
			await expectRevert(
				this.privateMarketplace.cancelAuction(currentAuctionId, {from: user2}),
				'PrivateMarketplace: MINTER_ROLE_REQUIRED'
			);
		});

		it('should revert when seller tries to cancel resolved auction', async () => {
			privateMarketNFTBalBefore = await this.Ingredient.balanceOf(
				this.privateMarketplace.address,
				currentNftId
			);

			// end auction
			await time.increase(String(time.duration.days('3')));

			// resolve auction
			await this.privateMarketplace.resolveAuction(currentAuctionId);

			privateMarketNFTBalAfter = await this.Ingredient.balanceOf(
				this.privateMarketplace.address,
				currentNftId
			);

			expect(privateMarketNFTBalBefore).to.bignumber.be.eq(new BN('1'));
			expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('0'));

			await expectRevert(
				this.privateMarketplace.cancelAuction(currentAuctionId, {from: minter}),
				'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_AUCTION'
			);
		});

		it('should revert when seller tries to cancel auction with invalid auction id', async () => {
			await expectRevert(
				this.privateMarketplace.cancelAuction(9, {from: minter}),
				'Market: INVALID_AUCTION_ID'
			);
		});
	});

	describe('buyNFT()', () => {
		let currentNftId;
		let currentSaleId;
		let privateMarketNFTBalBefore;
		let privateMarketNFTBalAfter;
		before('buy nft from sale', async () => {
			// create sale
			await this.privateMarketplace.createAndSellNFT(
				ether('1'),
				this.sampleToken.address,
				2,
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

			currentSaleId = await this.privateMarketplace.getCurrentSaleId();
			privateMarketNFTBalBefore = await this.Ingredient.balanceOf(
				this.privateMarketplace.address,
				currentNftId
			);

			// update early access time
			await this.privateMarketplace.updateEarlyAccessTime(time.duration.days('1'), {
				from: operator
			});
		});

		it('should revert when non-vip member try to get eary access to new ingredients', async () => {
			await expectRevert(
				this.privateMarketplace.buyNFT(currentSaleId, {from: user1}),
				'Market: EARLY_ACCESS_REQUIRED'
			);
		});

		it('should give early access to vip members for buying ingredients', async () => {
			// approve tokens to Cooker
			await this.sampleToken.approve(this.Talien.address, MAX_UINT256, {from: user1});
			// approve tokens to Cooker
			await this.sampleToken.approve(this.Talien.address, MAX_UINT256, {from: user3});

			// get talien for user1
			await this.Talien.generateItem(1, 1, true, {from: user1});

			const fundReceiverBalanceBefore = await this.sampleToken.balanceOf(fundReceiver);

			// buy nft from sale
			this.buyNFTTx = await this.privateMarketplace.buyNFT(currentSaleId, {from: user1});

			const fundReceiverBalanceAfter = await this.sampleToken.balanceOf(fundReceiver);

			console.log(
				'gas cost for buying nft from new & exciting marketplace: ',
				gasToEth(this.buyNFTTx.receipt.cumulativeGasUsed)
			);

			expect(fundReceiverBalanceAfter).to.bignumber.be.eq(
				fundReceiverBalanceBefore.add(ether('1'))
			);
		});

		it('should revert when user with normal talien tries to get early access to ingredients', async () => {
			// approve tokens to Cooker
			await this.sampleToken.approve(this.Talien.address, MAX_UINT256, {from: user2});

			await expectRevert(
				this.privateMarketplace.buyNFT(currentSaleId, {from: user2}),
				'Market: EARLY_ACCESS_REQUIRED'
			);
		});

		it('should reflect nft in user wallet correctly', async () => {
			privateMarketNFTBalAfter = await this.Ingredient.balanceOf(
				this.privateMarketplace.address,
				currentNftId
			);

			const user1NFTBal = await this.Ingredient.balanceOf(user1, currentNftId);

			expect(user1NFTBal).to.bignumber.be.eq(new BN('1'));
			expect(privateMarketNFTBalBefore).to.bignumber.be.eq(new BN('2'));
			expect(privateMarketNFTBalAfter).to.bignumber.be.eq(new BN('1'));
		});

		it('should emit BuySaleNFT event when user buys NFT from sale', async () => {
			await expectEvent(this.buyNFTTx, 'BuySaleNFT');
		});

		it('should revert when seller tries to cancel inactive sale', async () => {
			// stash tokens
			await this.Ingredient.safeTransferFrom(user1, stash, currentNftId, 1, '0x384', {
				from: user1
			});

			const fundReceiverBalanceBefore = await this.sampleToken.balanceOf(fundReceiver);

			// buy nft from sale
			this.buyNFTTx = await this.privateMarketplace.buyNFT(currentSaleId, {from: user1});

			const fundReceiverBalanceAfter = await this.sampleToken.balanceOf(fundReceiver);

			expect(fundReceiverBalanceAfter).to.bignumber.be.eq(
				fundReceiverBalanceBefore.add(ether('1'))
			);
			// cancel sale
			await expectRevert(
				this.privateMarketplace.cancelSale(currentSaleId, {from: minter}),
				'PrivateMarketplace: CANNOT_CANCEL_INACTIVE_SALE'
			);
		});

		it('should revert when user tries to buy from invalid sale', async () => {
			await expectRevert(
				this.privateMarketplace.buyNFT(15, {from: user1}),
				'Market: INVALID_SALE_ID'
			);
		});

		it('should revert when user tries to buy from inactive sale', async () => {
			await expectRevert(
				this.privateMarketplace.buyNFT(currentSaleId, {from: user1}),
				'Market: CANNOT_BUY_FROM_INACTIVE_SALE'
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
				time.duration.days('2'),
				false,
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

			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();
		});

		it('should store sale details and cancel the exisiting auction correctly', async () => {
			// move nft from auction to sale
			this.tx = await this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), {
				from: minter
			});

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
				this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), {from: minter}),
				'Market: CANNOT_MOVE_NFT_FROM_INACTIVE_AUCTION'
			);
		});

		it('should revert when seller tries to move nft from auction to sale with non zero bids', async () => {
			// create another auction
			await this.privateMarketplace.createAndAuctionNFT(
				ether('1'),
				this.sampleToken.address,
				time.duration.days('2'),
				false,
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

			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

			// place bid
			await this.privateMarketplace.placeBid(currentAuctionId, ether('4'), {from: user1});

			await expectRevert(
				this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), {from: minter}),
				'Market: CANNOT_UPDATE_AUCTION'
			);
		});

		it('should revert when non-seller tries to move nft from auction to sale', async () => {
			await expectRevert(
				this.privateMarketplace.moveNftInSale(currentAuctionId, ether('2'), {from: user3}),
				'Market: CALLER_NOT_THE_AUCTION_CREATOR'
			);
		});

		it('should revert when seller tries to move nft from auction to sale with 0 selling price', async () => {
			await expectRevert(
				this.privateMarketplace.moveNftInSale(currentAuctionId, ether('0'), {from: minter}),
				'Market: INVALID_SELLING_PRICE'
			);
		});
	});

	describe('addSupportedToken()', () => {
		let isSupportedBefore;
		before('add supported token', async () => {
			isSupportedBefore = await this.privateMarketplace.supportedTokens(ZERO_ADDRESS);

			// add supported token
			await this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, {from: operator});
		});

		it('should add supported token correctly', async () => {
			const isSupportedAfter = await this.privateMarketplace.supportedTokens(ZERO_ADDRESS);

			expect(isSupportedBefore).to.be.eq(false);
			expect(isSupportedAfter).to.be.eq(true);
		});

		it('should revert when admin tries to add token which is already supported', async () => {
			await expectRevert(
				this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, {from: operator}),
				'Market: TOKEN_ALREADY_ADDED'
			);
		});

		it('should revert when non-admin tries to add the supported token', async () => {
			await expectRevert(
				this.privateMarketplace.addSupportedToken(ZERO_ADDRESS, {from: user2}),
				'Market: ONLY_OPERATOR_CAN_CALL'
			);
		});
	});

	describe('removeSupportedToken()', () => {
		let isSupportedBefore;
		before('remove supported token', async () => {
			isSupportedBefore = await this.privateMarketplace.supportedTokens(ZERO_ADDRESS);

			// remove supported token
			await this.privateMarketplace.removeSupportedToken(ZERO_ADDRESS, {from: operator});
		});

		it('should remove supported token correctly', async () => {
			const isSupportedAfter = await this.privateMarketplace.supportedTokens(ZERO_ADDRESS);

			expect(isSupportedBefore).to.be.eq(true);
			expect(isSupportedAfter).to.be.eq(false);
		});

		it('should revert when admin tries to remove token which does not supports already', async () => {
			await expectRevert(
				this.privateMarketplace.removeSupportedToken(ZERO_ADDRESS, {from: operator}),
				'Market: TOKEN_DOES_NOT_EXISTS'
			);
		});

		it('should revert when non-admin tries to remove the supported token', async () => {
			await expectRevert(
				this.privateMarketplace.removeSupportedToken(ZERO_ADDRESS, {from: minter}),
				'Market: ONLY_OPERATOR_CAN_CALL'
			);
		});
	});

	describe('updateMinimumDuration()', async () => {
		let minimumDurationBefore;

		before('update minimum duration', async () => {
			minimumDurationBefore = await this.privateMarketplace.minDuration();

			// update minimum duration
			await this.privateMarketplace.updateMinimumDuration(String(time.duration.days('4')), {
				from: operator
			});
		});
		after('reset minimum duration to 1 days', async () => {
			// update minimum duration
			await this.privateMarketplace.updateMinimumDuration(String(time.duration.days('1')), {
				from: operator
			});
		});

		it('update minimum duration correctly', async () => {
			const minDurationAfter = await this.privateMarketplace.minDuration();
			expect(minDurationAfter).to.bignumber.be.eq(new BN('345600'));
		});

		it('should revert when admin tries to update minimum duration with same duration', async () => {
			await expectRevert(
				this.privateMarketplace.updateMinimumDuration(String(time.duration.days('4')), {
					from: operator
				}),
				'Market: INVALID_MINIMUM_DURATION'
			);
		});

		it('should revert when admin tries to update minimum duration to zero', async () => {
			await expectRevert(
				this.privateMarketplace.updateMinimumDuration(String(time.duration.days('0')), {
					from: operator
				}),
				'Market: INVALID_MINIMUM_DURATION'
			);
		});
		it('should revert when non-admin tries to update minimum duration', async () => {
			await expectRevert(
				this.privateMarketplace.updateMinimumDuration(String(time.duration.days('3')), {
					from: user2
				}),
				'Market: ONLY_OPERATOR_CAN_CALL'
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
				time.duration.days('2'),
				false,
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

			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

			user1BalanceBefore = await this.sampleToken.balanceOf(user1);

			// place bid for user1
			this.placeBidTx = await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), {
				from: user1
			});

			console.log(
				'gas cost for place bid in new & exciting marketplace: ',
				gasToEth(this.placeBidTx.receipt.cumulativeGasUsed)
			);

			currentBidId = await this.privateMarketplace.getCurrentBidId();
		});

		it('should set store bid details correctly', async () => {
			user1BalanceAfter = await this.sampleToken.balanceOf(user1);
			expect(user1BalanceBefore).to.bignumber.be.gt(user1BalanceAfter);

			const userTotalBids = await this.privateMarketplace.userTotalBids(user1);
			expect(userTotalBids).to.bignumber.be.eq(new BN('4'));

			const auction = await this.privateMarketplace.auction(currentAuctionId);
			expect(auction.winningBidId).to.bignumber.be.eq(currentBidId);

			const bid = await this.privateMarketplace.bid(currentBidId);

			expect(bid.auctionId).to.bignumber.be.eq(currentAuctionId);
			expect(bid.bidAmount).to.bignumber.be.eq(ether('2'));
			expect(bid.bidderAddress).to.be.eq(user1);
		});

		it('should return the tokens to previous bidder when someone places new bid', async () => {
			await this.sampleToken.approve(this.privateMarketplace.address, MAX_UINT256, {from: user2});

			const user2BalBefore = await this.sampleToken.balanceOf(user2);

			// place bid for user2
			await this.privateMarketplace.placeBid(currentAuctionId, ether('3'), {from: user2});

			currentBidId = await this.privateMarketplace.getCurrentBidId();

			const user2BalAfter = await this.sampleToken.balanceOf(user2);
			user1BalanceAfter = await this.sampleToken.balanceOf(user1);

			expect(user2BalBefore).to.bignumber.be.gt(user2BalAfter);
			expect(user1BalanceAfter).to.bignumber.be.eq(user1BalanceBefore);

			const auction = await this.privateMarketplace.auction(currentAuctionId);
			expect(auction.winningBidId).to.bignumber.be.eq(currentBidId);
		});

		it('should get the total bids on auction correctly', async () => {
			const totalBids = await this.privateMarketplace.getTotalBidsOfAuction(currentAuctionId);
			expect(totalBids).to.bignumber.be.eq(new BN('2'));

			await expectRevert(
				this.privateMarketplace.getTotalBidsOfAuction(20),
				'Market: INVALID_AUCTION_ID'
			);
		});

		it('should get the bid id of auction correctly', async () => {
			const bidId = await this.privateMarketplace.getBidIdOfAuction(currentAuctionId, 1);
			expect(bidId).to.bignumber.be.eq(currentBidId);

			await expectRevert(
				this.privateMarketplace.getBidIdOfAuction(20, 0),
				'Market: INVALID_AUCTION_ID'
			);
			await expectRevert(
				this.privateMarketplace.getBidIdOfAuction(currentAuctionId, 2),
				'Market: INVALID_INDEX'
			);
		});

		it('should revert if tokens are not approved before placing bid', async () => {
			await this.sampleToken.mint(accounts[6], ether('7'), {from: owner});

			await expectRevert(
				this.privateMarketplace.placeBid(currentAuctionId, ether('7'), {from: accounts[6]}),
				'ERC20: transfer amount exceeds allowance'
			);
		});

		it('should revert when auction creator tries to place bid', async () => {
			await expectRevert(
				this.privateMarketplace.placeBid(currentAuctionId, ether('3'), {from: minter}),
				'Market: OWNER_CANNOT_PLACE_BID'
			);
		});

		it('should revert when bidder tries to place bid with same bidamount', async () => {
			await expectRevert(
				this.privateMarketplace.placeBid(currentAuctionId, ether('3'), {from: user1}),
				'Market: INVALID_BID_AMOUNT'
			);
		});

		it('should revert when bidder tries to place bid with less than initial auction price', async () => {
			await expectRevert(
				this.privateMarketplace.placeBid(currentAuctionId, '500000000000000000', {from: user1}),
				'Market: INVALID_BID_AMOUNT'
			);
		});

		it('should revert when bidder tries to bid after auction period', async () => {
			// advance time
			await time.increase(String(time.duration.days('3')));

			await expectRevert(
				this.privateMarketplace.placeBid(currentAuctionId, ether('5'), {from: user1}),
				'Market: CANNOT_BID_AFTER_AUCTION_ENDS.'
			);
		});

		it('should revert when bidder tries to bid on inactive auction', async () => {
			const fundReceiverBalanceBefore = await this.sampleToken.balanceOf(fundReceiver);

			// resolve auction
			await this.privateMarketplace.resolveAuction(currentAuctionId);

			const fundReceiverBalanceAfter = await this.sampleToken.balanceOf(fundReceiver);

			expect(fundReceiverBalanceAfter).to.bignumber.be.eq(
				fundReceiverBalanceBefore.add(ether('3'))
			);

			await expectRevert(
				this.privateMarketplace.placeBid(currentAuctionId, ether('6'), {from: user2}),
				'Market: CANNOT_BID_ON_INACTIVE_AUCTION'
			);
		});

		it('should revert when bidder tries to bid with invalid auction id', async () => {
			await expectRevert(
				this.privateMarketplace.placeBid(15, ether('6'), {from: user2}),
				'Market: INVALID_AUCTION_ID'
			);
		});

		it('should revert when non-vip members tries to place bid on vip auctions', async () => {
			//create vip auction
			await this.privateMarketplace.createAndAuctionNFT(
				ether('1'),
				this.sampleToken.address,
				time.duration.days('3'),
				true,
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

			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

			const isVipUser = await this.privateMarketplace.doesUserHasTalien(user2);
			expect(isVipUser['1']).to.be.eq(false);

			await expectRevert(
				this.privateMarketplace.placeBid(currentAuctionId, ether('2'), {from: user2}),
				'PrivateMarketplace: ONLY_VIP_MEMBERS_CAN_BID'
			);
		});

		it('should allow only vip members to bid', async () => {
			let isVipUser = await this.privateMarketplace.doesUserHasTalien(user1);
			expect(isVipUser[1]).to.be.eq(true);

			// user1 places bid on vip auction
			await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), {from: user1});
		});

		it('should resolve the vip auction correctly', async () => {
			// increase duration
			await time.increase(time.duration.days('4'));

			currentBidId = await this.privateMarketplace.getCurrentBidId();

			// resolve auction
			await this.privateMarketplace.resolveAuction(currentAuctionId);

			const auction = await this.privateMarketplace.auction(currentAuctionId);

			expect(currentBidId).to.bignumber.be.eq(auction.winningBidId);
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
				time.duration.days('2'),
				false,
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

			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

			// place bid for user1
			await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), {from: user1});

			currentBidId = await this.privateMarketplace.getCurrentBidId();

			user1NFTBalanceBefore = await this.Ingredient.balanceOf(user1, currentNftId);
			contractNFTBalanceBefore = await this.Ingredient.balanceOf(
				this.privateMarketplace.address,
				currentNftId
			);
			contractBalanceBefore = await this.sampleToken.balanceOf(this.privateMarketplace.address);
		});

		it('should revert when anyone tries to resolve auction before auction end time', async () => {
			await expectRevert(
				this.privateMarketplace.resolveAuction(currentAuctionId),
				'Market: CANNOT_RESOLVE_DURING_AUCTION'
			);
		});

		it('should resolve the auction and update the auction status to close', async () => {
			// advance time to finish auction phase
			await time.increase(String(time.duration.days('3')));

			// resolve auction
			this.resolveTx = await this.privateMarketplace.resolveAuction(currentAuctionId);

			console.log(
				'gas cost for resolving auction in new & exciting marketplace: ',
				gasToEth(this.resolveTx.receipt.cumulativeGasUsed)
			);

			const auction = await this.privateMarketplace.auction(currentAuctionId);

			const user1NFTBalanceAfter = await this.Ingredient.balanceOf(user1, currentNftId);
			const contractNFTBalanceAfter = await this.Ingredient.balanceOf(
				this.privateMarketplace.address,
				currentNftId
			);
			const contractBalanceAfter = await this.sampleToken.balanceOf(
				this.privateMarketplace.address
			);

			expect(auction.status).to.bignumber.be.eq(new BN('0'));
			expect(user1NFTBalanceBefore).to.bignumber.be.eq(new BN('0'));
			expect(contractNFTBalanceBefore).to.bignumber.be.eq(new BN('1'));
			expect(user1NFTBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(contractNFTBalanceAfter).to.bignumber.be.eq(new BN('0'));
			expect(contractBalanceBefore).to.bignumber.be.gt(contractBalanceAfter);
		});

		it('should emit BuyAuctionNFT event when user resolves the auction', async () => {
			await expectEvent(this.resolveTx, 'BuyAuctionNFT');
		});

		it('should revert when anyone tries to resolve auction which already resolved', async () => {
			await expectRevert(
				this.privateMarketplace.resolveAuction(currentAuctionId),
				'Market: CANNOT_RESOLVE_INACTIVE_AUCTION'
			);
		});

		it('should revert when anyone tries to resolve auction with no bids', async () => {
			// create another auction
			await this.privateMarketplace.createAndAuctionNFT(
				ether('1'),
				this.sampleToken.address,
				time.duration.days('2'),
				false,
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

			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

			// advance time to finish auction phase
			await time.increase(String(time.duration.days('3')));

			await expectRevert(
				this.privateMarketplace.resolveAuction(currentAuctionId),
				'Market: CANNOT_RESOLVE_AUCTION_WITH_NO_BIDS'
			);
		});
	});

	describe('getAuctionWinningBid()', () => {
		let currentAuctionId;
		let currentBidId;
		let currentNftId;
		let bid;
		before('get auction winning bid', async () => {
			currentNftId = await this.Ingredient.getCurrentNftId();

			// create auction
			await this.privateMarketplace.createAndAuctionNFT(
				ether('1'),
				this.sampleToken.address,
				time.duration.days('2'),
				false,
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
			currentAuctionId = await this.privateMarketplace.getCurrentAuctionId();

			// place bid for user1
			await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), {from: user1});

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
	});

	describe('getters', () => {
		let currentNftId;
		let currentAuctionId;
		let currentAuctionIdBefore;
		before('create auction', async () => {
			currentNftId = await this.Ingredient.getCurrentNftId();

			currentAuctionIdBefore = await this.privateMarketplace.getCurrentAuctionId();
			// create auction
			await this.privateMarketplace.createAndAuctionNFT(
				ether('1'),
				this.sampleToken.address,
				time.duration.days('2'),
				false,
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
			await this.privateMarketplace.placeBid(currentAuctionId, ether('2'), {from: user2});

			// get current bidId
			const bidId = await this.privateMarketplace.getCurrentBidId();

			expect(bidId).to.bignumber.be.gt(currentBidId);
		});

		it('should get current sale id correctly', async () => {
			const currentSaleIdBefore = await this.privateMarketplace.getCurrentSaleId();

			// create sale
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

			const currentSaleIdAfter = await this.privateMarketplace.getCurrentSaleId();
			expect(currentSaleIdAfter).to.bignumber.be.gt(currentSaleIdBefore);
		});

		it('should return isActiveSale correctly', async () => {
			// create sale
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

			const currentSaleId = await this.privateMarketplace.getCurrentSaleId();

			let isActive = await this.privateMarketplace.isActiveSale(currentSaleId);

			expect(isActive).to.be.eq(true);

			// cancel sale
			this.cancelSaleTx = await this.privateMarketplace.cancelSale(currentSaleId, {from: minter});

			console.log(
				'gas cost for canceling sale in new & exciting marketplace: ',
				gasToEth(this.cancelSaleTx.receipt.cumulativeGasUsed)
			);

			isActive = await this.privateMarketplace.isActiveSale(currentSaleId);
			expect(isActive).to.be.eq(false);
		});

		it('should return isSupported token correctly', async () => {
			let isSupported = await this.privateMarketplace.supportedTokens(this.sampleToken.address);
			expect(isSupported).to.be.eq(true);

			await this.privateMarketplace.removeSupportedToken(this.sampleToken.address, {
				from: operator
			});

			isSupported = await this.privateMarketplace.supportedTokens(this.sampleToken.address);
			expect(isSupported).to.be.eq(false);
		});

		it('should get the total bids of auction correctly', async () => {
			const totalBids = await this.privateMarketplace.getTotalBidsOfAuction(1);
			expect(totalBids).to.bignumber.be.eq(totalBids);
		});
	});

	describe('upgradeProxy()', () => {
		let versionBeforeUpgrade;
		before('upgradeProxy', async () => {
			versionBeforeUpgrade = await this.privateMarketplace.getVersionNumber();
			// upgrade contract
			await upgradeProxy(this.privateMarketplace.address, PrivateMarketplaceV2);
		});

		it('should upgrade contract correctly', async () => {
			const versionAfterUpgrade = await this.privateMarketplace.getVersionNumber();

			expect(versionBeforeUpgrade['0']).to.bignumber.be.eq(new BN('1'));
			expect(versionBeforeUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionBeforeUpgrade['2']).to.bignumber.be.eq(new BN('0'));

			expect(versionAfterUpgrade['0']).to.bignumber.be.eq(new BN('2'));
			expect(versionAfterUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionAfterUpgrade['2']).to.bignumber.be.eq(new BN('0'));
		});
	});
});
