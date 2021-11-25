require('chai').should();
const {expect} = require('chai');
const {expectRevert, BN, time, ether} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const fs = require('fs');
const path = require('path');
const {MAX_UINT256, ZERO_ADDRESS} = require('@openzeppelin/test-helpers/src/constants');
const {Talien} = require('./helper/talien');

const doughs = require('../data/dough');
const sauces = require('../data/sauce');
const cheeses = require('../data/cheese');

const papayas = require('../data/ingredients/papaya');
const caviar = require('../data/ingredients/caviar');
const leaves = require('../data/ingredients/leaves');
const venom = require('../data/ingredients/venom');
const antEggs = require('../data/ingredients/antEggs');

const Cooker = artifacts.require('Cooker');
const CookerV2 = artifacts.require('CookerV2');

const DishesNFT = artifacts.require('DishesNFT');
const IngredientNFT = artifacts.require('IngredientsNFT');
const Kitchen = artifacts.require('Kitchen');
const SampleToken = artifacts.require('SampleToken');
const TalienContract = artifacts.require('Talien');

const url = 'https://token-cdn-domain/{id}.json';
const ipfsHash = 'bafybeihabfo2rluufjg22a5v33jojcamglrj4ucgcw7on6v33sc6blnxcm';
const GAS_LIMIT = 85000000;

contract.only('Cooker', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];
	const fundReceiver = accounts[8];
	const royaltyReceiver = accounts[9];
	const royaltyFee = '100';
	let nutritionHash;
	let dishId = 1;

	before('Deploy Contracts', async () => {
		this.SampleToken = await SampleToken.new();

		this.Ingredient = await deployProxy(IngredientNFT, [url, royaltyReceiver, royaltyFee], {
			initializer: 'initialize'
		});

		this.Kitchen = await deployProxy(Kitchen, [], {
			initializer: 'initialize'
		});

		this.Dish = await deployProxy(
			DishesNFT,
			['DishesNFT', 'Dish', url, this.Ingredient.address, this.Kitchen.address],
			{
				initializer: 'initialize'
			}
		);

		// deploy NFT token
		this.Talien = await deployProxy(
			TalienContract,
			[
				'La Cucina Taliens',
				'TALIEN',
				url,
				fundReceiver,
				this.SampleToken.address,
				ether('10'),
				royaltyReceiver,
				'100',
				'Mokoto Glitch Regular'
			],
			{
				initializer: 'initialize'
			}
		);

		this.TalienObj = new Talien(this.Talien);

		await this.TalienObj.setup(owner);

		this.Cooker = await deployProxy(
			Cooker,
			[
				this.Ingredient.address,
				this.Dish.address,
				this.SampleToken.address,
				this.Talien.address,
				ether('5'),
				3,
				2
			],
			{
				initializer: 'initialize'
			}
		);

		// add minter in ingredient contract
		const minterRole = await this.Ingredient.MINTER_ROLE();
		await this.Ingredient.grantRole(minterRole, minter, {from: owner});

		// add Cooker contract as exceptedFrom address in ingredient
		await this.Ingredient.addExceptedFromAddress(this.Cooker.address, {from: owner});

		// add Cooker contract as excepted address in ingredient
		await this.Ingredient.addExceptedAddress(this.Cooker.address, {from: owner});

		//mint tokens to users
		await this.SampleToken.mint(user1, ether('1000'), {from: owner});
		await this.SampleToken.mint(user2, ether('1000'), {from: owner});
		await this.SampleToken.mint(user3, ether('1000'), {from: owner});
	});

	describe('initialize()', () => {
		it('should initialize contracts correctly', async () => {
			const ingredientAddress = await this.Cooker.ingredientNft();
			const dishesAddress = await this.Cooker.dishesNft();
			const sampleTokenAddress = await this.Cooker.lacToken();

			expect(ingredientAddress).to.be.eq(this.Ingredient.address);
			expect(dishesAddress).to.be.eq(this.Dish.address);
			expect(sampleTokenAddress).to.be.eq(this.SampleToken.address);
		});

		it('should grant the admin role to deployer', async () => {
			const adminRole = await this.Cooker.DEFAULT_ADMIN_ROLE();

			const isAdmin = await this.Cooker.hasRole(adminRole, owner);
			expect(isAdmin).to.be.eq(true);
		});
	});

	describe('addFlame()', () => {
		let currentFlameId;
		before('add flames', async () => {
			// add normal flame
			await this.Cooker.addFlame('Normal', time.duration.minutes('15'), ether('0'), {from: owner});

			// add High flame
			await this.Cooker.addFlame('High', time.duration.minutes('5'), ether('5'), {from: owner});

			// add Radiation flame
			await this.Cooker.addFlame('Radiation', time.duration.minutes('1'), ether('10'), {
				from: owner
			});

			// add Laser flame
			await this.Cooker.addFlame('laser', time.duration.seconds('3'), ether('60'), {from: owner});
		});

		it('should get the the flame id correctly', async () => {
			currentFlameId = await this.Cooker.getCurrentFlameId();
			expect(currentFlameId).to.bignumber.be.eq(new BN('4'));
		});

		it('should get the flame details correctly', async () => {
			const flame = await this.Cooker.flames(currentFlameId);
			expect(flame.flameType).to.be.eq('laser');
			expect(flame.preparationDuration).to.bignumber.be.eq(new BN('3'));
			expect(flame.lacCharge).to.bignumber.be.eq(ether('60'));
		});

		it('should revert when invalid flame type name is given', async () => {
			await expectRevert(
				this.Cooker.addFlame('', time.duration.seconds('3'), ether('50'), {from: owner}),
				'Cooker: INVALID_FLAME_TYPE'
			);
		});

		it('should revert when non-admin tries to add the flame', async () => {
			await expectRevert(
				this.Cooker.addFlame(
					'laser',
					time.duration.seconds('3'),
					ether('50'),

					{from: minter}
				),
				'Cooker: ONLY_ADMIN_CAN_CALL'
			);
		});
	});

	describe('updateFlameDetail()', async () => {
		let currentFlameId;
		before('update the flame details', async () => {
			currentFlameId = await this.Cooker.getCurrentFlameId();

			// update flame details
			await this.Cooker.updateFlameDetail(
				currentFlameId,
				'laser blaster',
				time.duration.seconds('3'),
				ether('50'),
				{from: owner}
			);
		});

		it('should update the flame details correctly', async () => {
			const flame = await this.Cooker.flames(currentFlameId);
			expect(flame.flameType).to.be.eq('laser blaster');
			expect(flame.preparationDuration).to.bignumber.be.eq(new BN('3'));
			expect(flame.lacCharge).to.bignumber.be.eq(ether('50'));
		});

		it('should revert when invalid flame type name is given', async () => {
			await expectRevert(
				this.Cooker.updateFlameDetail(currentFlameId, '', time.duration.seconds('3'), ether('50'), {
					from: owner
				}),
				'Cooker: INVALID_FLAME_TYPE'
			);
		});

		it('should revert when invalid flame id is given', async () => {
			await expectRevert(
				this.Cooker.updateFlameDetail(0, 'laser', time.duration.seconds('3'), ether('50'), {
					from: owner
				}),
				'Cooker: INVALID_FLAME'
			);
			await expectRevert(
				this.Cooker.updateFlameDetail(9, 'laser', time.duration.seconds('3'), ether('50'), {
					from: owner
				}),
				'Cooker: INVALID_FLAME'
			);
		});

		it('should revert when non-admin tries to update the flame detail', async () => {
			await expectRevert(
				this.Cooker.updateFlameDetail(
					currentFlameId,
					'laser',
					time.duration.seconds('3'),
					ether('50'),
					{
						from: minter
					}
				),
				'Cooker: ONLY_ADMIN_CAN_CALL'
			);
		});
	});

	describe('New Pizza Dish', () => {
		let user1CaviarBalance;
		let user1TunaBalance;
		let user1GoldBalance;
		let user1BeefBalance;
		let user1TruffleBalance;

		let ovenCaviarBalance;
		let ovenTunaBalance;
		let ovenGoldBalance;
		let ovenBeefBalance;
		let ovenTruffleBalance;

		let currentDishIdBefore;
		before('add pizza base and ingredients', async () => {
			// grant Cooker role to Cooker contract in Dish contract
			const CookerRole = await this.Dish.OVEN_ROLE();

			await this.Dish.grantRole(CookerRole, this.Cooker.address, {from: owner});

			// approve ingredients to CookerContract
			await this.Ingredient.setApprovalForAll(this.Cooker.address, true, {from: user1});

			// ****************************************************************************

			// add dish in kitchen
			this.addDishTx = await this.Kitchen.addDishType(
				'Pizza',
				[205, 250, 270, 170, 210, 160, 120],
				[190, 195, 220, 225, 240, 260, 280],
				{from: owner}
			);
			currentDishId = await this.Kitchen.getCurrentDishTypeId();

			// add base Ingredients for dish
			const addDough = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Dough', {
				from: owner
			});
			const addSauce = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Sauce', {
				from: owner
			});
			const addCheese = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Cheese', {
				from: owner
			});

			// add owner as excepted address
			await this.Ingredient.addExceptedAddress(owner);
		});

		// ************************** IMPORTANT ************************** //
		// add variations for base ingredients
		// here variation name should be strictly like this. variationName = IngredientName_variationName. ex. Slice_1, Cheese_2
		// NOTE: svg id and the IngredientName_variationName should be same. <g id= "Slice_One">, <g id = "Cheese_Two">
		// ************************** IMPORTANT ************************** //
		before('Add base variations for Pizza Dough', async () => {
			for (let dough of doughs) {
				await this.Kitchen.addBaseIngredientVariation(1, dough.name, dough.svg, {
					from: owner,
					gas: GAS_LIMIT
				});
			}
		});

		before('Add base variations for Pizza Sauce', async () => {
			for (let sauce of sauces) {
				await this.Kitchen.addBaseIngredientVariation(2, sauce.name, sauce.svg, {
					from: owner,
					gas: GAS_LIMIT
				});
			}
		});

		before('Add base variations for Pizza Cheese', async () => {
			for (let cheese of cheeses) {
				await this.Kitchen.addBaseIngredientVariation(3, cheese.name, cheese.svg, {
					from: owner,
					gas: GAS_LIMIT
				});
			}
		});

		before('add ingredients', async () => {
			// add ingredients
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
					from: owner,
					gas: GAS_LIMIT
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
					from: owner,
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
					from: owner,
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
					from: owner,
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
					from: owner,
					gas: GAS_LIMIT
				}
			);

			// transfer ingredients to the user1
			await this.Ingredient.safeTransferFrom(owner, user1, 1, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 2, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 3, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 4, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 5, 1, '0x384', {from: owner});

			user1CaviarBalance = await this.Ingredient.balanceOf(user1, 1);
			user1TunaBalance = await this.Ingredient.balanceOf(user1, 2);
			user1GoldBalance = await this.Ingredient.balanceOf(user1, 3);
			user1BeefBalance = await this.Ingredient.balanceOf(user1, 4);
			user1TruffleBalance = await this.Ingredient.balanceOf(user1, 5);

			ovenCaviarBalance = await this.Ingredient.balanceOf(this.Cooker.address, 1);
			ovenTunaBalance = await this.Ingredient.balanceOf(this.Cooker.address, 2);
			ovenGoldBalance = await this.Ingredient.balanceOf(this.Cooker.address, 3);
			ovenBeefBalance = await this.Ingredient.balanceOf(this.Cooker.address, 4);
			ovenTruffleBalance = await this.Ingredient.balanceOf(this.Cooker.address, 5);

			//get current dish id
			currentDishIdBefore = await this.Dish.getCurrentTokenId();
		});

		it('should revert if user tries to prepare dish with 4 ingredients without having Talien', async () => {
			await expectRevert(
				this.Cooker.cookDish(1, 1, [1, 2, 3, 4, 5], {from: user1}),
				'Cooker: USER_DONT_HAVE_TALIEN'
			);
		});

		it('should revert if user tries to prepare dish with 6 ingredients without having Talien', async () => {
			await expectRevert(
				this.Cooker.cookDish(1, 1, [1, 2, 3, 4, 5, 6], {from: user1}),
				'Cooker: INVALID_NUMBER_OF_INGREDIENTS'
			);
		});

		it('should make pizza with all ingredients', async () => {
			// approve tokens to Cooker
			await this.SampleToken.approve(this.Talien.address, MAX_UINT256, {from: user1});
			// generate talien for user1
			await this.Talien.generateTalien({from: user1});

			// prepare the dish
			this.prepareDish1Tx = await this.Cooker.cookDish(1, 1, [1, 2, 3, 4, 5], {from: user1});

			const currentDishId = await this.Dish.getCurrentTokenId();

			//get dish details
			const dishDetail = await this.Dish.dish(currentDishId);
			const dishName = await this.Dish.dishNames(currentDishId);

			expect(dishDetail.dishOwner).to.be.eq(user1);
			expect(dishDetail.cooked).to.be.eq(true);
			expect(dishDetail.totalIngredients).bignumber.to.be.eq(new BN('5'));
			expect(dishDetail.totalBaseIngredients).bignumber.to.be.eq(new BN('3'));
			expect(dishDetail.flameType).bignumber.to.be.eq(new BN('1'));
			expect(dishName).to.be.eq(`${papayas[0].keyword} ${caviar[0].keyword} Pizza`);

			// get users ingredient balance
			const user1CaviarBalanceAfter = await this.Ingredient.balanceOf(user1, 1);
			const user1TunaBalanceAfter = await this.Ingredient.balanceOf(user1, 2);
			const user1GoldBalanceAfter = await this.Ingredient.balanceOf(user1, 3);
			const user1BeefBalanceAfter = await this.Ingredient.balanceOf(user1, 4);
			const user1TruffleBalanceAfter = await this.Ingredient.balanceOf(user1, 5);

			// get Cooker contract`s ingredient balance
			const ovenCaviarBalanceAfter = await this.Ingredient.balanceOf(this.Cooker.address, 1);
			const ovenTunaBalanceAfter = await this.Ingredient.balanceOf(this.Cooker.address, 2);
			const ovenGoldBalanceAfter = await this.Ingredient.balanceOf(this.Cooker.address, 3);
			const ovenBeefBalanceAfter = await this.Ingredient.balanceOf(this.Cooker.address, 4);
			const ovenTruffleBalanceAfter = await this.Ingredient.balanceOf(this.Cooker.address, 5);

			expect(user1CaviarBalance).to.bignumber.be.eq(new BN('1'));
			expect(user1TunaBalance).to.bignumber.be.eq(new BN('1'));
			expect(user1GoldBalance).to.bignumber.be.eq(new BN('1'));
			expect(user1BeefBalance).to.bignumber.be.eq(new BN('1'));
			expect(user1TruffleBalance).to.bignumber.be.eq(new BN('1'));

			expect(user1CaviarBalanceAfter).to.bignumber.be.eq(new BN('0'));
			expect(user1TunaBalanceAfter).to.bignumber.be.eq(new BN('0'));
			expect(user1GoldBalanceAfter).to.bignumber.be.eq(new BN('0'));
			expect(user1BeefBalanceAfter).to.bignumber.be.eq(new BN('0'));
			expect(user1TruffleBalanceAfter).to.bignumber.be.eq(new BN('0'));

			expect(ovenCaviarBalance).to.bignumber.be.eq(new BN('0'));
			expect(ovenTunaBalance).to.bignumber.be.eq(new BN('0'));
			expect(ovenGoldBalance).to.bignumber.be.eq(new BN('0'));
			expect(ovenBeefBalance).to.bignumber.be.eq(new BN('0'));
			expect(ovenTruffleBalance).to.bignumber.be.eq(new BN('0'));

			expect(ovenCaviarBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(ovenTunaBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(ovenGoldBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(ovenBeefBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(ovenTruffleBalanceAfter).to.bignumber.be.eq(new BN('1'));

			//get current dish id
			const preparedDishId = await this.Dish.getCurrentTokenId();

			//get dish owner
			const dishOwner = await this.Dish.ownerOf(preparedDishId);

			expect(dishOwner).to.be.eq(user1);
			expect(currentDishIdBefore).to.bignumber.be.eq(new BN('0'));
			expect(preparedDishId).to.bignumber.be.eq(new BN('1'));
		});

		it('should serve the prepared dish correctly', async () => {
			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: GAS_LIMIT});

			const addresssPath = await path.join(
				'generated/ovens',
				'pizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});

		it('should prepare pizza using caviar and tuna only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.safeTransferFrom(owner, user1, 1, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 2, 1, '0x384', {from: owner});

			// prepare the dish
			this.prepareDish2Tx = await this.Cooker.cookDish(1, 1, [1, 2], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get dish owner
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: GAS_LIMIT});

			const addresssPath = await path.join(
				'generated/ovens',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});

		it('should prepare pizza using caviar and gold only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.safeTransferFrom(owner, user1, 1, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 3, 1, '0x384', {from: owner});

			// prepare the dish
			await this.Cooker.cookDish(1, 1, [1, 3], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: GAS_LIMIT});

			const addresssPath = await path.join(
				'generated/ovens',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using caviar and beef only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.safeTransferFrom(owner, user1, 1, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 4, 1, '0x384', {from: owner});

			// prepare the dish
			await this.Cooker.cookDish(1, 1, [1, 4], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: GAS_LIMIT});

			const addresssPath = await path.join(
				'generated/ovens',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using cheese and beef only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.safeTransferFrom(owner, user1, 1, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 5, 1, '0x384', {from: owner});

			// prepare the dish
			await this.Cooker.cookDish(1, 1, [1, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: GAS_LIMIT});

			const addresssPath = await path.join(
				'generated/ovens',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using tuna and Truffle only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.safeTransferFrom(owner, user1, 2, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 5, 1, '0x384', {from: owner});

			// prepare the dish
			await this.Cooker.cookDish(1, 1, [2, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: GAS_LIMIT});

			const addresssPath = await path.join(
				'generated/ovens',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using caviar and tuna and truffle only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.safeTransferFrom(owner, user1, 1, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 2, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 5, 1, '0x384', {from: owner});

			// prepare the dish
			this.prepareDish3Tx = await this.Cooker.cookDish(1, 1, [1, 2, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: GAS_LIMIT});

			const addresssPath = await path.join(
				'generated/ovens',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using tuna, gold, beef and truffle only', async () => {
			// mint ingredients to the user1prepa
			await this.Ingredient.safeTransferFrom(owner, user1, 2, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 3, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 4, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 5, 1, '0x384', {from: owner});

			// prepare the dish
			this.prepareDish4Tx = await this.Cooker.cookDish(1, 1, [2, 3, 4, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: GAS_LIMIT});

			const addresssPath = await path.join(
				'generated/ovens',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using caviar, gold,and truffle only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.safeTransferFrom(owner, user1, 2, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 4, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 5, 1, '0x384', {from: owner});

			await expectRevert(
				this.Cooker.cookDish(4, 1, [2, 4, 5], {from: user1}),
				'DishesNFT: INVALID_DISH_ID'
			);

			// prepare the dish
			await this.Cooker.cookDish(1, 1, [2, 4, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: GAS_LIMIT});

			const addresssPath = await path.join(
				'generated/ovens',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});

		it('should revert when no ingredient ids are used to prepare dish', async () => {
			await expectRevert(
				this.Cooker.cookDish(1, 1, [], {from: user1}),
				'Cooker: INVALID_NUMBER_OF_INGREDIENTS'
			);
		});

		it('should revert when invalid ingredient id is used to prepare dish', async () => {
			await expectRevert(
				this.Cooker.cookDish(1, 1, [7, 1, 3], {from: user1}),
				'Cooker: INVALID_INGREDIENT_ID'
			);
		});
	});

	describe('updateFlame()', () => {
		let currentDishId;
		let isDishReadyToUncookBefore;
		before('update flame', async () => {
			currentDishId = await this.Dish.getCurrentTokenId();

			// approve sample tokens to the oven contract
			await this.SampleToken.approve(this.Cooker.address, MAX_UINT256, {from: user1});
		});

		it('should update the flame for the dish correctly', async () => {
			isDishReadyToUncookBefore = await this.Cooker.isDishReadyToUncook(1);

			await this.Cooker.updateFlame(currentDishId, 2, {from: user1});

			isDishReadyToUncookAfter = await this.Cooker.isDishReadyToUncook(1);

			const dish = await this.Dish.dish(1);
			expect(dish.completionTime).to.bignumber.be.eq(
				dish.creationTime.add(new BN(time.duration.minutes('5')))
			);
			expect(dish.flameType).to.bignumber.be.eq(new BN('2'));

			expect(isDishReadyToUncookAfter).to.be.eq(true);
			expect(isDishReadyToUncookBefore).to.be.eq(false);
		});

		it('should revert when other user tries to update the flame for the dish', async () => {
			await expectRevert(
				this.Cooker.updateFlame(currentDishId, 4, {from: user2}),
				'Cooker: ONLY_DISH_OWNER_CAN_UPDATE_FLAME'
			);
		});
		it('should revert when invalid flame id is specified', async () => {
			await expectRevert(this.Cooker.updateFlame(1, 0, {from: user1}), 'Cooker: INVALID_FLAME');
			await expectRevert(this.Cooker.updateFlame(1, 7, {from: user1}), 'Cooker: INVALID_FLAME');
		});
		it('should revert when user tries to update the flame with same flameid', async () => {
			await expectRevert(
				this.Cooker.updateFlame(currentDishId, 2, {from: user1}),
				'Cooker: FLAME_ALREADY_SET'
			);
		});
		it('should revert when invalid dish id is specified', async () => {
			await expectRevert(this.Cooker.updateFlame(0, 4, {from: user1}), 'Cooker: INVALID_DISH_ID');
			await expectRevert(this.Cooker.updateFlame(10, 4, {from: user1}), 'Cooker: INVALID_DISH_ID');
		});
	});

	describe('uncookDish()', async () => {
		let user1CaviarBalance;
		let user1TunaBalance;
		let user1GoldBalance;
		let user1BeefBalance;
		let user1TruffleBalance;
		let dish1Owner;

		let ovenCaviarBalance;
		let ovenTunaBalance;
		let ovenGoldBalance;
		let ovenBeefBalance;
		let ovenTruffleBalance;

		let currentDishId;

		before(async () => {
			// currentDishId = await this.Dish.getCurrentTokenId();

			// get user1`s dish balance
			dish1Owner = await this.Dish.ownerOf(1);

			// get user1`s ingredient balance

			user1CaviarBalance = await this.Ingredient.balanceOf(user1, 1);
			user1TunaBalance = await this.Ingredient.balanceOf(user1, 2);
			user1GoldBalance = await this.Ingredient.balanceOf(user1, 3);
			user1BeefBalance = await this.Ingredient.balanceOf(user1, 4);
			user1TruffleBalance = await this.Ingredient.balanceOf(user1, 5);

			// get oven contract`s ingredient balance
			ovenCaviarBalance = await this.Ingredient.balanceOf(this.Cooker.address, 1);
			ovenTunaBalance = await this.Ingredient.balanceOf(this.Cooker.address, 2);
			ovenGoldBalance = await this.Ingredient.balanceOf(this.Cooker.address, 3);
			ovenBeefBalance = await this.Ingredient.balanceOf(this.Cooker.address, 4);
			ovenTruffleBalance = await this.Ingredient.balanceOf(this.Cooker.address, 5);

			// // approve dish to CookerContract
			await this.Dish.setApprovalForAll(this.Cooker.address, true, {from: user1});
		});

		it('should revert when user tries to uncook the dish while its preparing', async () => {
			await expectRevert(
				this.Cooker.uncookDish(1, {from: user1}),
				'Cooker: CANNOT_UNCOOK_WHILE_PREPARING'
			);
		});

		it('should revert when user tries to uncook the dish oven contract is not added in excepted address list', async () => {
			//increase time
			await time.increase(time.duration.minutes('6'));

			await expectRevert(
				this.Cooker.uncookDish(1, {from: user1}),
				'DishesNFT: CANNOT_TRANSFER_DISH'
			);
		});

		it('should uncook dish correctly', async () => {
			// // add Cooker contract as excepted address in ingredient
			await this.Dish.addExceptedAddress(this.Cooker.address, {from: owner});

			// uncook dish
			this.uncookTx = await this.Cooker.uncookDish(1, {from: user1});

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(1);
			expect(dishOwner).to.be.eq(this.Cooker.address);

			// get users ingredient balance
			const user1CaviarBalanceAfter = await this.Ingredient.balanceOf(user1, 1);
			const user1TunaBalanceAfter = await this.Ingredient.balanceOf(user1, 2);
			const user1GoldBalanceAfter = await this.Ingredient.balanceOf(user1, 3);
			const user1BeefBalanceAfter = await this.Ingredient.balanceOf(user1, 4);
			const user1TruffleBalanceAfter = await this.Ingredient.balanceOf(user1, 5);

			// get Cooker contract`s ingredient balance
			const ovenCaviarBalanceAfter = await this.Ingredient.balanceOf(this.Cooker.address, 1);
			const ovenTunaBalanceAfter = await this.Ingredient.balanceOf(this.Cooker.address, 2);
			const ovenGoldBalanceAfter = await this.Ingredient.balanceOf(this.Cooker.address, 3);
			const ovenBeefBalanceAfter = await this.Ingredient.balanceOf(this.Cooker.address, 4);
			const ovenTruffleBalanceAfter = await this.Ingredient.balanceOf(this.Cooker.address, 5);

			expect(dish1Owner).to.be.eq(user1);

			expect(user1CaviarBalance).to.bignumber.be.eq(new BN('0'));
			expect(user1TunaBalance).to.bignumber.be.eq(new BN('0'));
			expect(user1GoldBalance).to.bignumber.be.eq(new BN('0'));
			expect(user1BeefBalance).to.bignumber.be.eq(new BN('0'));
			expect(user1TruffleBalance).to.bignumber.be.eq(new BN('0'));

			expect(user1CaviarBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(user1TunaBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(user1GoldBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(user1BeefBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(user1TruffleBalanceAfter).to.bignumber.be.eq(new BN('1'));

			expect(ovenCaviarBalance).to.bignumber.be.eq(new BN('6'));
			expect(ovenTunaBalance).to.bignumber.be.eq(new BN('6'));
			expect(ovenGoldBalance).to.bignumber.be.eq(new BN('3'));
			expect(ovenBeefBalance).to.bignumber.be.eq(new BN('4'));
			expect(ovenTruffleBalance).to.bignumber.be.eq(new BN('6'));

			expect(ovenCaviarBalanceAfter).to.bignumber.be.eq(new BN('5'));
			expect(ovenTunaBalanceAfter).to.bignumber.be.eq(new BN('5'));
			expect(ovenGoldBalanceAfter).to.bignumber.be.eq(new BN('2'));
			expect(ovenBeefBalanceAfter).to.bignumber.be.eq(new BN('3'));
			expect(ovenTruffleBalanceAfter).to.bignumber.be.eq(new BN('5'));
		});

		it('should charge LAC while uncooking if user don`t have the no Talien', async () => {
			// mint ingredients to the user2
			await this.Ingredient.safeTransferFrom(owner, user2, 2, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user2, 3, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user2, 4, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user2, 5, 1, '0x384', {from: owner});

			// set approval to oven
			await this.Ingredient.setApprovalForAll(this.Cooker.address, true, {from: user2});
			// approve tokens to Cooker
			await this.SampleToken.approve(this.Cooker.address, MAX_UINT256, {from: user2});

			// prepare the dish
			await this.Cooker.cookDish(1, 4, [2, 3, 4], {from: user2});

			const currentDishId = await this.Dish.getCurrentTokenId();

			const lacBalBefore = await this.SampleToken.balanceOf(user2);

			// approve dish to oven
			await this.Dish.setApprovalForAll(this.Cooker.address, true, {from: user2});
			await time.increase(time.duration.days('1'));

			await this.Cooker.uncookDish(currentDishId, {from: user2});

			const lacBalAfter = await this.SampleToken.balanceOf(user2);

			expect(lacBalBefore).to.bignumber.be.gt(lacBalAfter);

			expect(lacBalBefore).to.bignumber.be.eq(lacBalAfter.add(new BN(ether('5'))));
		});

		it('should charge LAC while uncooking if user don`t have the genesis Talien', async () => {
			// prepare the dish
			await this.Cooker.cookDish(1, 4, [2, 3, 4], {from: user2});

			const currentDishId = await this.Dish.getCurrentTokenId();

			// approve dish to oven
			await this.Dish.setApprovalForAll(this.Cooker.address, true, {from: user2});
			// approve tokens to Cooker
			await this.SampleToken.approve(this.Talien.address, MAX_UINT256, {from: user2});

			// update generation
			await this.TalienObj.addTraitVariations(owner);

			// generate talien for user2
			await this.Talien.generateTalien({from: user2});
			await time.increase(time.duration.days('1'));

			const lacBalBefore = await this.SampleToken.balanceOf(user2);

			await this.Cooker.uncookDish(currentDishId, {from: user2});

			const lacBalAfter = await this.SampleToken.balanceOf(user2);

			expect(lacBalBefore).to.bignumber.be.gt(lacBalAfter);
			expect(lacBalBefore).to.bignumber.be.eq(lacBalAfter.add(new BN(ether('5'))));
		});

		it('should add the dish id in uncooked dish ids list in Cooker contract', async () => {
			const uncookedDishIds = await this.Cooker.uncookedDishIds(0);

			expect(uncookedDishIds).to.bignumber.be.eq(new BN('1'));
		});

		it('should revert when non-dishOwner tries to uncook the dish', async () => {
			await expectRevert(
				this.Cooker.uncookDish('1', {from: user2}),
				'Cooker: ONLY_DISH_OWNER_CAN_UNCOOK'
			);
		});

		it('should revert when dishOwner tries to uncook the dish with invalid dish id', async () => {
			await expectRevert(this.Cooker.uncookDish(0, {from: user1}), 'Cooker: INVALID_DISH_ID');
			await expectRevert(this.Cooker.uncookDish(15, {from: user1}), 'Cooker: INVALID_DISH_ID');
		});

		it('should revert when user wants to get svg of uncooked dish', async () => {
			await expectRevert(
				this.Dish.serveDish(1, {from: user1}),
				'DishesNFT: CANNOT_SERVE_UNCOOKED_DISH'
			);
		});
	});

	describe('claimAllTokens()', () => {
		it('should claim tokens send to oven contract', async () => {
			const ovenTokenBalBefore = await this.SampleToken.balanceOf(this.Cooker.address);
			const owenerTokenBalBefore = await this.SampleToken.balanceOf(owner);

			// claim all tokens
			await this.Cooker.claimAllTokens(owner, this.SampleToken.address, {from: owner});

			const ovenTokenBalAfter = await this.SampleToken.balanceOf(this.Cooker.address);
			const owenerTokenBalAfter = await this.SampleToken.balanceOf(owner);

			expect(ovenTokenBalBefore).to.bignumber.be.gt(new BN('0'));
			expect(owenerTokenBalBefore).to.bignumber.be.eq(new BN('0'));

			expect(ovenTokenBalAfter).to.bignumber.be.eq(new BN('0'));
			expect(owenerTokenBalAfter).to.bignumber.be.eq(ovenTokenBalBefore);
		});

		it('should revert when non-admin tries to claim all the tokens', async () => {
			await expectRevert(
				this.Cooker.claimAllTokens(owner, this.SampleToken.address, {from: minter}),
				'Cooker: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert when admin tries to claim all the tokens to zero user address', async () => {
			await expectRevert(
				this.Cooker.claimAllTokens(ZERO_ADDRESS, this.SampleToken.address, {from: owner}),
				'Cooker: INVALID_USER_ADDRESS'
			);
		});
		it('should revert when admin tries to claim all the tokens to zero token address', async () => {
			await expectRevert(
				this.Cooker.claimAllTokens(owner, ZERO_ADDRESS, {from: owner}),
				'Cooker: INVALID_TOKEN_ADDRESS'
			);
		});
	});

	describe('claimTokens()', () => {
		it('should claim specified amount of tokens send to oven contract', async () => {
			//transfer tokens to oven
			await this.SampleToken.transfer(this.Cooker.address, ether('5'), {from: user1});

			const ovenTokenBalBefore = await this.SampleToken.balanceOf(this.Cooker.address);
			const owenerTokenBalBefore = await this.SampleToken.balanceOf(owner);

			// claim all tokens
			await this.Cooker.claimTokens(owner, this.SampleToken.address, ether('4'), {from: owner});

			const ovenTokenBalAfter = await this.SampleToken.balanceOf(this.Cooker.address);
			const owenerTokenBalAfter = await this.SampleToken.balanceOf(owner);

			expect(ovenTokenBalBefore).to.bignumber.be.eq(ether('5'));
			expect(owenerTokenBalBefore).to.bignumber.be.gt(new BN('0'));

			expect(ovenTokenBalAfter).to.bignumber.be.eq(ether('1'));
			expect(owenerTokenBalAfter).to.bignumber.be.eq(owenerTokenBalBefore.add(ether('4')));
		});

		it('should revert when non-admin tries to claim given no. of the tokens', async () => {
			await expectRevert(
				this.Cooker.claimTokens(owner, this.SampleToken.address, ether('4'), {from: minter}),
				'Cooker: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert when admin tries to claim  given no. of the tokens to zero user address', async () => {
			await expectRevert(
				this.Cooker.claimTokens(ZERO_ADDRESS, this.SampleToken.address, ether('4'), {from: owner}),
				'Cooker: INVALID_USER_ADDRESS'
			);
		});
		it('should revert when admin tries to claim  given no. of the tokens to zero token address', async () => {
			await expectRevert(
				this.Cooker.claimTokens(owner, ZERO_ADDRESS, ether('4'), {from: owner}),
				'Cooker: INVALID_TOKEN_ADDRESS'
			);
		});

		it('should revert when admin tries to claim invalid amount of tokens', async () => {
			await expectRevert(
				this.Cooker.claimTokens(owner, this.SampleToken.address, ether('0'), {from: owner}),
				'Cooker: INSUFFICIENT_BALANCE'
			);
			await expectRevert(
				this.Cooker.claimTokens(owner, this.SampleToken.address, ether('2'), {from: owner}),
				'Cooker: INSUFFICIENT_BALANCE'
			);
		});
	});

	describe('upgradeProxy()', () => {
		let versionBeforeUpgrade;
		before('upgradeProxy', async () => {
			versionBeforeUpgrade = await this.Cooker.getVersionNumber();

			// upgrade contract
			await upgradeProxy(this.Cooker.address, CookerV2);
		});

		it('should upgrade contract correctly', async () => {
			const versionAfterUpgrade = await this.Cooker.getVersionNumber();

			expect(versionBeforeUpgrade['0']).to.bignumber.be.eq(new BN('1'));
			expect(versionBeforeUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionBeforeUpgrade['2']).to.bignumber.be.eq(new BN('0'));

			expect(versionAfterUpgrade['0']).to.bignumber.be.eq(new BN('2'));
			expect(versionAfterUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionAfterUpgrade['2']).to.bignumber.be.eq(new BN('0'));
		});
	});
});
