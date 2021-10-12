require('chai').should();

const {expect} = require('chai');
const {expectRevert, BN} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');
const {ZERO_ADDRESS} = require('@openzeppelin/test-helpers/src/constants');

const {caviar_1, caviar_2, caviar_3} = require('./svgs/Caviar');

const IngredientNFT = artifacts.require('IngredientsNFT');
const IngredientsNFTV2 = artifacts.require('IngredientsNFTV2');

const url = 'https://token-cdn-domain/{id}.json';

contract('IngredientsNFT', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];

	before(async () => {
		this.Ingredient = await deployProxy(IngredientNFT, [url], {initializer: 'initialize'});
	});

	it('should initialize the contract correctly', async () => {
		const uri = await this.Ingredient.uri(1);
		expect(uri).to.be.eq(url);
	});

	it('should give the deployer the minter role', async () => {
		const minterRole = await this.Ingredient.MINTER_ROLE();
		const isMinter = await this.Ingredient.hasRole(minterRole, owner);

		expect(isMinter).to.be.eq(true);
	});

	it('should assign the minter role correctly', async () => {
		const minterRole = await this.Ingredient.MINTER_ROLE();

		const isMinterBefore = await this.Ingredient.hasRole(minterRole, minter);

		// grant minter role
		await this.Ingredient.grantRole(minterRole, minter);

		const isMinterAfter = await this.Ingredient.hasRole(minterRole, minter);

		expect(isMinterBefore).to.be.eq(false);
		expect(isMinterAfter).to.be.eq(true);
	});

	describe('addIngredient()', () => {
		let currentBaseIngredientID;
		let currentIngredientId;
		before('add ingredients', async () => {
			this.addIngredientTX = await this.Ingredient.addIngredient('pepper', url, '100', {
				from: owner
			});
			//console.log('add ingredient: ', this.addIngredientTX);

			currentIngredientId = await this.Ingredient.getCurrentNftId();
		});

		it('should add ingredient details correctly', async () => {
			const ingredient = await this.Ingredient.ingredients(currentIngredientId);
			const ipfsHash = await this.Ingredient.getIpfsHash(currentIngredientId);

			expect(currentIngredientId).to.bignumber.be.eq(new BN('1'));
			expect(ingredient.id).to.bignumber.be.eq(new BN('1'));
			expect(ingredient.name).to.be.eq('pepper');
			expect(ingredient.fat).to.bignumber.be.eq(new BN('100'));
			expect(ipfsHash).to.be.eq(url);
		});

		it('should revert when non-owner tries to add the ingredients', async () => {
			await expectRevert(
				this.Ingredient.addIngredient('pepper', url, '100', {
					from: minter
				}),
				'ERC1155NFT: ONLY_ADMIN_CAN_CALL'
			);
		});
		it('should revert when owner tries to add ingredient without name', async () => {
			await expectRevert(
				this.Ingredient.addIngredient('', url, '100', {
					from: owner
				}),
				'IngredientNFT: INVALID_INGREDIENT_NAME'
			);
		});
		it('should revert when owner tries to add ingredient without ipfsHash', async () => {
			await expectRevert(
				this.Ingredient.addIngredient('pepper', '', '100', {
					from: owner
				}),
				'IngredientNFT: INVALID_IPFS_HASH'
			);
		});

		it('should revert when owner tries to add ingredient without fats', async () => {
			await expectRevert(
				this.Ingredient.addIngredient('pepper', url, '0', {
					from: owner
				}),
				'IngredientNFT: INVALID_FAT'
			);
		});
	});

	describe('addIngredientVariation()', () => {
		let currentIngredientId;
		let totalDefsBefore;
		let totalVariationsBefore;
		before('add variation svg', async () => {
			currentIngredientId = await this.Ingredient.getCurrentNftId();
			totalDefsBefore = await this.Ingredient.getCurrentDefs();

			const ingredient = await this.Ingredient.ingredients(currentIngredientId);

			totalVariationsBefore = ingredient.totalVariations;

			// add variation
			this.addVariationTx = await this.Ingredient.addIngredientVariation(
				currentIngredientId,
				caviar_1,
				{from: owner}
			);

			//	console.log('add ingredient variation: ', this.addVariationTx);
		});

		it('should add the ingredient variation correctly', async () => {
			const totalDefsNow = await this.Ingredient.getCurrentDefs();

			const ingredient = await this.Ingredient.ingredients(currentIngredientId);
			const variation = await this.Ingredient.defs(totalDefsNow);

			const totalVariationsNow = ingredient.totalVariations;

			expect(totalDefsBefore).to.bignumber.be.eq(new BN('0'));
			expect(totalVariationsBefore).to.bignumber.be.eq(new BN('0'));
			expect(totalDefsNow).to.bignumber.be.eq(new BN('1'));
			expect(totalVariationsNow).to.bignumber.be.eq(new BN('1'));
			expect(variation).to.be.eq(caviar_1);
		});

		it('should revert when non-owner tries to add the variation', async () => {
			await expectRevert(
				this.Ingredient.addIngredientVariation(currentIngredientId, caviar_1, {from: minter}),
				'ERC1155NFT: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert when owner tries to add ingredient without svg', async () => {
			await expectRevert(
				this.Ingredient.addIngredientVariation(currentIngredientId, '', {from: owner}),
				'IngredientNFT: INVALID_VARIATION'
			);
		});
	});

	describe('updateIngredient()', () => {
		let currentIngredientId;
		before('update ingredients', async () => {
			currentIngredientId = await this.Ingredient.getCurrentNftId();

			await this.Ingredient.updateIngredient(currentIngredientId, 'pepperIngredient', url, '200', {
				from: owner
			});
		});

		it('should update ingredient details correctly', async () => {
			const ingredient = await this.Ingredient.ingredients(currentIngredientId);
			const ipfsHash = await this.Ingredient.getIpfsHash(currentIngredientId);

			expect(currentIngredientId).to.bignumber.be.eq(new BN('1'));
			expect(ingredient.id).to.bignumber.be.eq(new BN('1'));
			expect(ingredient.name).to.be.eq('pepperIngredient');
			expect(ingredient.fat).to.bignumber.be.eq(new BN('200'));
			expect(ipfsHash).to.be.eq(url);
		});

		it('should revert when non-owner tries to update the ingredients', async () => {
			await expectRevert(
				this.Ingredient.updateIngredient(currentIngredientId, 'pepperIngredient', url, '200', {
					from: minter
				}),
				'ERC1155NFT: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert when owner tries to update ingredient without name', async () => {
			await expectRevert(
				this.Ingredient.updateIngredient(currentIngredientId, '', url, '200', {
					from: owner
				}),
				'IngredientNFT: INVALID_INGREDIENT_NAME'
			);
		});

		it('should revert when owner tries to update ingredient without ipfsHash', async () => {
			await expectRevert(
				this.Ingredient.updateIngredient(currentIngredientId, 'pepper', '', '200', {
					from: owner
				}),
				'IngredientNFT: INVALID_IPFS_HASH'
			);
		});

		it('should revert when owner tries to update ingredient without fats', async () => {
			await expectRevert(
				this.Ingredient.updateIngredient(currentIngredientId, 'pepper', url, '0', {
					from: owner
				}),
				'IngredientNFT: INVALID_FAT'
			);
		});
	});

	describe('mint()', () => {
		let currentIngredientId;
		let user1IngredientsBefore;
		before('mint ingredients to users', async () => {
			currentIngredientId = await this.Ingredient.getCurrentNftId();

			// grant minter role to minter
			const minterRole = await this.Ingredient.MINTER_ROLE();
			await this.Ingredient.grantRole(minterRole, minter, {from: owner});

			user1IngredientsBefore = await this.Ingredient.balanceOf(user1, currentIngredientId);

			// mint ingredients to user
			await this.Ingredient.mint(user1, currentIngredientId, 1, {from: minter});
		});

		it('should mint the ingredients to users correctly', async () => {
			const user1IngredientsAfter = await this.Ingredient.balanceOf(user1, currentIngredientId);
			const totalSupplyOfIngredient = await this.Ingredient.totalSupply(currentIngredientId);

			expect(user1IngredientsBefore).to.be.bignumber.eq(new BN('0'));
			expect(user1IngredientsAfter).to.be.bignumber.eq(new BN('1'));
			expect(totalSupplyOfIngredient).to.be.bignumber.eq(new BN('1'));
		});

		it('should revert when non-minter tries to mint the ingredients to user', async () => {
			await expectRevert(
				this.Ingredient.mint(user1, currentIngredientId, 1, {from: user2}),
				'ERC1155NFT: ONLY_MINTER_CAN_CALL'
			);
		});

		it('should revert when minter tries to mint the multiple ingredients to user', async () => {
			await expectRevert(
				this.Ingredient.mint(accounts[4], currentIngredientId, 2, {from: minter}),
				'ERC1155NFT: USER_CAN_TRANSFER_ONLY_ONE_TOKEN'
			);
		});

		it('should revert when minter tries to mint the ingredients to user with invalid ingredient id', async () => {
			await expectRevert(
				this.Ingredient.mint(user1, 3, 1, {from: minter}),
				'ERC1155: INVALID_NFT_ID'
			);
		});
	});

	describe('burn()', () => {
		let currentIngredientId;
		let user1IngredientsBefore;
		before('burn ingredients from users', async () => {
			currentIngredientId = await this.Ingredient.getCurrentNftId();

			user1IngredientsBefore = await this.Ingredient.balanceOf(user1, currentIngredientId);

			// burn ingredients to user
			await this.Ingredient.burn(user1, currentIngredientId, 1, {from: minter});
		});

		it('should burn the ingredients from users correctly', async () => {
			const user1IngredientsAfter = await this.Ingredient.balanceOf(user1, currentIngredientId);
			const totalSupplyOfIngredient = await this.Ingredient.totalSupply(currentIngredientId);

			expect(user1IngredientsBefore).to.be.bignumber.eq(new BN('1'));
			expect(user1IngredientsAfter).to.be.bignumber.eq(new BN('0'));
			expect(totalSupplyOfIngredient).to.be.bignumber.eq(new BN('0'));
		});

		it('should revert when non-minter tries to burn the ingredients from user', async () => {
			await expectRevert(
				this.Ingredient.burn(user1, currentIngredientId, 1, {from: user2}),
				'ERC1155NFT: ONLY_MINTER_CAN_CALL'
			);
		});

		it('should revert when minter tries to mint the ingredients to user with invalid ingredient id', async () => {
			await expectRevert(
				this.Ingredient.burn(user1, 5, 1, {from: minter}),
				'ERC1155: INVALID_NFT_ID'
			);
		});
	});

	describe('addExceptedAddress()', () => {
		before('add excepted contract address', async () => {
			await this.Ingredient.addExceptedAddress(user1, {from: owner});
		});

		it('should add user1 as excepted address', async () => {
			const isUser1Excepted = await this.Ingredient.isExceptedAddress(user1);
			expect(isUser1Excepted[0]).to.be.eq(true);
		});

		it('should revert when non-owner tries to add address as excepted address', async () => {
			await expectRevert(
				this.Ingredient.addExceptedAddress(user1, {from: minter}),
				'ERC1155NFT: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert when owner tries to add zero address as excepted address', async () => {
			await expectRevert(
				this.Ingredient.addExceptedAddress(ZERO_ADDRESS, {from: owner}),
				'ERC1155NFT: CANNOT_EXCEPT_ZERO_ADDRESS'
			);
		});

		it('should revert when owner tries to except already excepted address', async () => {
			await expectRevert(
				this.Ingredient.addExceptedAddress(user1, {from: owner}),
				'ERC1155: ALREADY_EXCEPTED_ADDRESS'
			);
		});
	});

	describe('addExceptedFromAddress()', () => {
		before('add exceptedFrom address', async () => {
			await this.Ingredient.addExceptedFromAddress(user2, {from: owner});
		});

		it('should add user1 as excepted address', async () => {
			const isUser1Excepted = await this.Ingredient.isExceptedFromAddress(user2);
			expect(isUser1Excepted[0]).to.be.eq(true);
		});

		it('should revert when non-owner tries to add address as excepted address', async () => {
			await expectRevert(
				this.Ingredient.addExceptedFromAddress(user3, {from: minter}),
				'ERC1155NFT: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert when owner tries to add zero address as excepted address', async () => {
			await expectRevert(
				this.Ingredient.addExceptedFromAddress(ZERO_ADDRESS, {from: owner}),
				'ERC1155NFT: CANNOT_EXCEPT_ZERO_ADDRESS'
			);
		});

		it('should revert when owner tries to except already excepted address', async () => {
			await expectRevert(
				this.Ingredient.addExceptedFromAddress(user2, {from: owner}),
				'ERC1155: ALREADY_EXCEPTED_ADDRESS'
			);
		});
	});

	describe('removeExceptedAddress()', () => {
		it('should revert when owner tries to remove non-excepted address', async () => {
			await expectRevert(
				this.Ingredient.removeExceptedAddress(user3, {from: owner}),
				'ERC1155NFT: CANNOT_FIND_USER'
			);
		});

		it('should revert when owner tries to remove zero address ', async () => {
			await expectRevert(
				this.Ingredient.removeExceptedAddress('0x0000000000000000000000000000000000000000', {
					from: owner
				}),
				'ERC1155NFT: CANNOT_REMOVE_ZERO_ADDRESS'
			);
		});

		it('should revert when non-owner tries to remove excepted address ', async () => {
			await expectRevert(
				this.Ingredient.removeExceptedAddress(user1, {from: minter}),
				'ERC1155NFT: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should remove user from excepted addresses list correctly', async () => {
			await this.Ingredient.removeExceptedAddress(user1, {from: owner});

			const isUser1Excepted = await this.Ingredient.isExceptedAddress(user1);

			expect(isUser1Excepted[0]).to.be.eq(false);
		});

		it('should revert when owner tries to remove excepted address from empty list', async () => {
			await expectRevert(
				this.Ingredient.removeExceptedAddress(user1, {from: owner}),
				'ERC1155NFT: CANNOT_REMOVE_FROM_EMPTY_LIST'
			);
		});
	});

	describe('removeExceptedFromAddress()', () => {
		it('should revert when owner tries to remove non-excepted address', async () => {
			await expectRevert(
				this.Ingredient.removeExceptedFromAddress(user3, {from: owner}),
				'ERC1155NFT: CANNOT_FIND_USER'
			);
		});

		it('should revert when owner tries to remove zero address ', async () => {
			await expectRevert(
				this.Ingredient.removeExceptedFromAddress(ZERO_ADDRESS, {from: owner}),
				'ERC1155NFT: CANNOT_REMOVE_ZERO_ADDRESS'
			);
		});

		it('should revert when non-owner tries to remove excepted address ', async () => {
			await expectRevert(
				this.Ingredient.removeExceptedFromAddress(user1, {from: minter}),
				'ERC1155NFT: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should remove user from excepted addresses list correctly', async () => {
			await this.Ingredient.removeExceptedFromAddress(user2, {from: owner});

			const isUser1Excepted = await this.Ingredient.isExceptedFromAddress(user1);

			expect(isUser1Excepted[0]).to.be.eq(false);
		});

		it('should revert when owner tries to remove excepted address from empty list', async () => {
			await expectRevert(
				this.Ingredient.removeExceptedFromAddress(user2, {from: owner}),
				'ERC1155NFT: CANNOT_REMOVE_FROM_EMPTY_LIST'
			);
		});
	});

	describe('safeTransferFrom()', () => {
		let currentIngredientId;
		let user2BalanceBefore;
		before(async () => {
			// add excepted address to receive multiple tokens
			await this.Ingredient.addExceptedAddress(minter);

			currentIngredientId = await this.Ingredient.getCurrentNftId();

			await this.Ingredient.mint(user1, currentIngredientId, 1, {from: minter});
			await this.Ingredient.mint(minter, currentIngredientId, 1, {from: minter});

			user2BalanceBefore = await this.Ingredient.balanceOf(user2, currentIngredientId);

			// transfer nft
			await this.Ingredient.safeTransferFrom(user1, user2, currentIngredientId, 1, '0x837', {
				from: user1
			});
		});

		it('should transfer ingredient nfts correctly', async () => {
			const user2BalanceAfter = await this.Ingredient.balanceOf(user2, currentIngredientId);

			expect(user2BalanceBefore).to.bignumber.be.eq(new BN('0'));
			expect(user2BalanceAfter).to.bignumber.be.eq(new BN('1'));
		});

		it('should revert when user tries to recieve multiple nfts of same nft type', async () => {
			// mint ingredient to user1 again
			await this.Ingredient.mint(user1, currentIngredientId, 1, {from: minter});

			await expectRevert(
				this.Ingredient.safeTransferFrom(user1, user2, currentIngredientId, 1, '0x837', {
					from: user1
				}),
				'ERC1155NFT: TOKEN_ALREADY_EXIST'
			);
		});

		it('should recieve multiple nfts correctly when nft is sent from exceptedFrom address', async () => {
			//add minter as exceptedFrom address so that user2 can receive multiple tokens of same ingredient
			await this.Ingredient.addExceptedFromAddress(minter, {from: owner});

			// transfer same ingredient to user2
			await this.Ingredient.safeTransferFrom(minter, user2, currentIngredientId, 1, '0x837', {
				from: minter
			});

			const user2Balance = await this.Ingredient.balanceOf(user2, currentIngredientId);
			expect(user2Balance).to.bignumber.be.eq(new BN('2'));
		});

		it('should revert when user tries to transfer multiple nfts to another user', async () => {
			await expectRevert(
				this.Ingredient.safeTransferFrom(user2, accounts[5], currentIngredientId, 2, '0x837', {
					from: user2
				}),
				'ERC1155NFT: USER_CAN_TRANSFER_ONLY_ONE_TOKEN'
			);
		});
	});

	describe('pause() and unpause()', () => {
		let currentIngredientId;
		before(async () => {
			currentIngredientId = await this.Ingredient.getCurrentNftId();
		});
		it('should not allow transfers in case of paused contract', async () => {
			currentIngredientId = await this.Ingredient.getCurrentNftId();

			// grant pauser role to minter
			const pauserRole = await this.Ingredient.PAUSER_ROLE();

			await expectRevert(
				this.Ingredient.pause({from: minter}),
				'ERC1155NFT: must have pauser role to pause'
			);

			// make minter a pauser as well
			await this.Ingredient.grantRole(pauserRole, minter);

			// should pause correctly
			await this.Ingredient.pause({from: minter});

			await expectRevert(
				this.Ingredient.safeTransferFrom(user2, accounts[6], currentIngredientId, 1, '0x837', {
					from: user2
				}),
				'ERC1155Pausable: token transfer while paused'
			);
			// also burning is not allowed in this case
			await expectRevert(
				this.Ingredient.burn(user2, currentIngredientId, 1),
				'ERC1155Pausable: token transfer while paused'
			);

			// should unpause correctly
			await expectRevert(
				this.Ingredient.unpause({from: user1}),
				'ERC1155NFT: must have pauser role to unpause'
			);
			await this.Ingredient.unpause({from: minter});

			await this.Ingredient.safeTransferFrom(user2, accounts[7], currentIngredientId, 1, '0x837', {
				from: user2
			});

			const user1Balance = await this.Ingredient.balanceOf(user1, currentIngredientId);
			expect(user1Balance).to.bignumber.be.eq(new BN('1'));
		});

		it('should not allow mints in case of paused contract', async () => {
			// should pause correctly
			await this.Ingredient.pause({from: minter});

			await expectRevert(
				this.Ingredient.mint(accounts[4], currentIngredientId, 1, {from: minter}),
				'ERC1155Pausable: token transfer while paused'
			);
		});

		it('should not allow a non pauser to pause', async () => {
			await expectRevert(
				this.Ingredient.pause({from: user2}),
				'ERC1155NFT: must have pauser role to pause'
			);
		});

		it('should not allow a non pauser to unpause', async () => {
			await expectRevert(
				this.Ingredient.unpause({from: user2}),
				'ERC1155NFT: must have pauser role to unpause'
			);
			await this.Ingredient.unpause({from: minter});
		});
	});

	describe('approve()', () => {
		it('should approve tokens correctly', async () => {
			const currentIngredientId = await this.Ingredient.getCurrentNftId();

			const isApprovalForAllBefore = await this.Ingredient.isApprovedForAll(user2, minter);

			// get type2 nft from minter
			await expectRevert(
				this.Ingredient.safeTransferFrom(user2, minter, currentIngredientId, 1, '0x837', {
					from: minter
				}),
				'ERC1155: caller is not owner nor approved'
			);

			// approve nft
			await this.Ingredient.setApprovalForAll(minter, true, {from: user2});

			const isApprovalForAllAfter = await this.Ingredient.isApprovedForAll(user2, minter);

			expect(isApprovalForAllBefore).to.be.eq(false);
			expect(isApprovalForAllAfter).to.be.eq(true);

			// get type2 nft from minter
			await this.Ingredient.safeTransferFrom(user2, minter, currentIngredientId, 1, '0x837', {
				from: minter
			});

			await expectRevert(
				this.Ingredient.safeTransferFrom(user2, minter, currentIngredientId, 1, '0x837', {
					from: minter
				}),
				'ERC1155: insufficient balance for transfer'
			);
		});
	});

	describe('Getters', () => {
		it('should get current nft id correctly', async () => {
			const currentNftId = await this.Ingredient.getCurrentNftId();

			expect(currentNftId).to.bignumber.be.eq(new BN('1'));
		});

		it('should get nft url correctly', async () => {
			const tokenURI = await this.Ingredient.getIpfsHash('1');

			expect(tokenURI).to.be.eq(url);
		});
	});

	describe('upgradeProxy()', () => {
		let versionBeforeUpgrade;
		before('upgradeProxy', async () => {
			versionBeforeUpgrade = await this.Ingredient.getVersionNumber();

			// upgrade contract
			await upgradeProxy(this.Ingredient.address, IngredientsNFTV2);
		});

		it('should upgrade contract correctly', async () => {
			const versionAfterUpgrade = await this.Ingredient.getVersionNumber();

			expect(versionBeforeUpgrade['0']).to.bignumber.be.eq(new BN('1'));
			expect(versionBeforeUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionBeforeUpgrade['2']).to.bignumber.be.eq(new BN('0'));

			expect(versionAfterUpgrade['0']).to.bignumber.be.eq(new BN('2'));
			expect(versionAfterUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionAfterUpgrade['2']).to.bignumber.be.eq(new BN('0'));
		});
	});
});