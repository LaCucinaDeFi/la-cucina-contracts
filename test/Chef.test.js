require('chai').should();
const {expect} = require('chai');
const {expectRevert, BN, time, ether} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const {slice_1, slice_2, slice_3} = require('./svgs/Slice');
const {cheese_1, cheese_2, cheese_3} = require('./svgs/Cheese');
const {caviar_1, caviar_2, caviar_3} = require('./svgs/Caviar');
const {tuna_1, tuna_2, tuna_3} = require('./svgs/Tuna');
const {gold_1, gold_2, gold_3} = require('./svgs/Gold');
const {beef_1, beef_2, beef_3} = require('./svgs/Beef');
const {truffle_1, truffle_2, truffle_3} = require('./svgs/Truffle');

const fs = require('fs');
const path = require('path');
const {MAX_UINT256} = require('@openzeppelin/test-helpers/src/constants');

const Oven = artifacts.require('Oven');
const OvenV2 = artifacts.require('OvenV2');

const IngredientNFT = artifacts.require('IngredientsNFT');
const DishesNFT = artifacts.require('DishesNFT');
const Pantry = artifacts.require('Pantry');
const SampleToken = artifacts.require('SampleToken');

const url = 'https://token-cdn-domain/{id}.json';

function getNutritionsHash(nutritionsList) {
	let nutrisionHash = 0;
	if (nutritionsList.length == 8) {
		// get base Variation Hash
		for (let i = 0; i < 8; i++) {
			let temp = 255 ** i;

			nutrisionHash = BigInt(BigInt(nutrisionHash) + BigInt(nutritionsList[i]) * BigInt(temp));
		}
	} else {
		throw console.error('Insufficient nutrisions');
	}
	return nutrisionHash;
}

contract.only('Oven', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];
	const royaltyReciever = accounts[8];
	const royaltyFee = '100';

	let dishId = 1;

	before(async () => {
		this.SampleToken = await SampleToken.new();

		this.Ingredient = await deployProxy(IngredientNFT, [url, royaltyReciever, royaltyFee], {
			initializer: 'initialize'
		});

		this.Pantry = await deployProxy(Pantry, [], {
			initializer: 'initialize'
		});

		this.Dish = await deployProxy(
			DishesNFT,
			['DishesNFT', 'Dish', url, this.Ingredient.address, this.Pantry.address],
			{
				initializer: 'initialize'
			}
		);

		this.Oven = await deployProxy(
			Oven,
			[this.Ingredient.address, this.Dish.address, this.SampleToken.address],
			{
				initializer: 'initialize'
			}
		);

		// add minter in ingredient contract
		const minterRole = await this.Ingredient.MINTER_ROLE();
		await this.Ingredient.grantRole(minterRole, minter, {from: owner});

		// add Oven contract as exceptedFrom address in ingredient
		await this.Ingredient.addExceptedFromAddress(this.Oven.address, {from: owner});

		// add Oven contract as excepted address in ingredient
		await this.Ingredient.addExceptedAddress(this.Oven.address, {from: owner});

		//mint tokens to users
		await this.SampleToken.mint(user1, ether('1000'), {from: owner});
		await this.SampleToken.mint(user2, ether('1000'), {from: owner});
		await this.SampleToken.mint(user3, ether('1000'), {from: owner});
	});

	describe('initialize()', () => {
		it('should initialize contracts correctly', async () => {
			const ingredientAddress = await this.Oven.ingredientNft();
			const dishesAddress = await this.Oven.dishesNft();
			const sampleTokenAddress = await this.Oven.lacToken();

			expect(ingredientAddress).to.be.eq(this.Ingredient.address);
			expect(dishesAddress).to.be.eq(this.Dish.address);
			expect(sampleTokenAddress).to.be.eq(this.SampleToken.address);
		});

		it('should grant the admin role to deployer', async () => {
			const adminRole = await this.Oven.DEFAULT_ADMIN_ROLE();

			const isAdmin = await this.Oven.hasRole(adminRole, owner);
			expect(isAdmin).to.be.eq(true);
		});
	});

	describe('addFlame()', () => {
		let currentFlameId;
		before('add flames', async () => {
			// add normal flame
			await this.Oven.addFlame('Normal', time.duration.minutes('15'), ether('0'), {from: owner});

			// add High flame
			await this.Oven.addFlame('High', time.duration.minutes('5'), ether('5'), {from: owner});

			// add Radiation flame
			await this.Oven.addFlame('Radiation', time.duration.minutes('1'), ether('10'), {from: owner});

			// add Laser flame
			await this.Oven.addFlame('laser', time.duration.seconds('3'), ether('50'), {from: owner});
		});

		it('should get the the flame id correctly', async () => {
			currentFlameId = await this.Oven.getCurrentFlameId();
			expect(currentFlameId).to.bignumber.be.eq(new BN('4'));
		});

		it('should get the flame details correctly', async () => {
			const flame = await this.Oven.flames(currentFlameId);
			expect(flame.flameType).to.be.eq('laser');
			expect(flame.preparationDuration).to.bignumber.be.eq(new BN('3'));
			expect(flame.lacCharge).to.bignumber.be.eq(ether('60'));
		});

		it('should revert when invalid flame id is given', async () => {
			await expectRevert(
				this.Oven.addFlame(
					'',
					time.duration.seconds('3'),
					ether('50'),
					'Oven: INVALID_FLAME_TYPE',
					{from: owner}
				)
			);
		});

		it('should revert when non-admin tries to add the flame', async () => {
			await expectRevert(
				this.Oven.addFlame(
					'laser',
					time.duration.seconds('3'),
					ether('50'),
					'Oven: ONLY_ADMIN_CAN_CALL',
					{from: minter}
				)
			);
		});
	});

	describe('updateFlameDetail()', async () => {
		let currentFlameId;
		before('update the flame details', async () => {
			currentFlameId = await this.Oven.getCurrentFlameId();

			// update flame details
			await this.Oven.updateFlameDetail(
				currentFlameId,
				'laser blaster',
				time.duration.seconds('3'),
				ether('50'),
				{from: owner}
			);
		});

		it('should update the flame details correctly', async () => {
			const flame = await this.Oven.flames(currentFlameId);
			expect(flame.flameType).to.be.eq('laser blaster');
			expect(flame.preparationDuration).to.bignumber.be.eq(new BN('3'));
			expect(flame.lacCharge).to.bignumber.be.eq(ether('50'));
		});

		it('should revert when invalid flame type name is given', async () => {
			await expectRevert(
				this.Oven.updateFlameDetail(currentFlameId, '', time.duration.seconds('3'), ether('50'), {
					from: owner
				}),
				'Oven: INVALID_FLAME_TYPE'
			);
		});

		it('should revert when invalid flame id is given', async () => {
			await expectRevert(
				this.Oven.updateFlameDetail(0, 'laser', time.duration.seconds('3'), ether('50'), {
					from: owner
				}),
				'Oven: INVALID_FLAME'
			);
			await expectRevert(
				this.Oven.updateFlameDetail(9, 'laser', time.duration.seconds('3'), ether('50'), {
					from: owner
				}),
				'Oven: INVALID_FLAME'
			);
		});

		it('should revert when non-admin tries to update the fkame detail', async () => {
			await expectRevert(
				this.Oven.updateFlameDetail(
					currentFlameId,
					'laser',
					time.duration.seconds('3'),
					ether('50'),
					{
						from: minter
					}
				),
				'Oven: ONLY_ADMIN_CAN_CALL'
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
			// grant Oven role to Oven contract in Dish contract
			const OvenRole = await this.Dish.OVEN_ROLE();

			await this.Dish.grantRole(OvenRole, this.Oven.address, {from: owner});

			// approve ingredients to OvenContract
			await this.Ingredient.setApprovalForAll(this.Oven.address, true, {from: user1});

			// ****************************************************************************

			// add dish in pantry
			await this.Pantry.addDish('Pizza', {from: owner});
			currentDishId = await this.Pantry.getCurrentDishId();

			// add base Ingredients for dish
			await this.Pantry.addBaseIngredientForDish(currentDishId, 'Slice', {from: owner});
			await this.Pantry.addBaseIngredientForDish(currentDishId, 'Cheese', {from: owner});

			// add variations for base ingredients
			// here variation name should be strictly like this. variationName = name_variationId. ex. Slice_1, Cheese_2
			// NOTE: svg id and the name_variationId should be same. <g id= "Slice_1">, <g id = "Cheese_2">
			await this.Pantry.addBaseIngredientVariation(1, 'One', slice_1, {from: owner});
			await this.Pantry.addBaseIngredientVariation(1, 'Two', slice_2, {from: owner});
			await this.Pantry.addBaseIngredientVariation(1, 'Three', slice_3, {from: owner});

			await this.Pantry.addBaseIngredientVariation(2, 'One', cheese_1, {from: owner});
			await this.Pantry.addBaseIngredientVariation(2, 'Two', cheese_2, {from: owner});
			await this.Pantry.addBaseIngredientVariation(2, 'Three', cheese_3, {from: owner});

			// add ingredients
			// here ingredient name should be strictly like this. variationName = name_variationId. ex. Caviar_1, Tuna_2
			// NOTE: svg id and the name_variationId should be same. <g id= "Caviar_1">, <g id = "Tuna_2">

			const CaviarNutrisionHash = await getNutritionsHash([14, 50, 20, 4, 6, 39, 25, 8]);
			console.log('CaviarNutrisionHash: ', CaviarNutrisionHash.toString());

			await this.Ingredient.addIngredient('Caviar', CaviarNutrisionHash);
			await this.Ingredient.addIngredient('Tuna', CaviarNutrisionHash);
			await this.Ingredient.addIngredient('Gold', CaviarNutrisionHash);
			await this.Ingredient.addIngredient('Beef', CaviarNutrisionHash);
			await this.Ingredient.addIngredient('Truffle', CaviarNutrisionHash);

			// add ingredient variations

			this.add2Tx = await this.Ingredient.addIngredientVariation(1, 'One', caviar_1);
			await this.Ingredient.addIngredientVariation(1, 'Two', caviar_2);
			await this.Ingredient.addIngredientVariation(1, 'Three', caviar_3);

			await this.Ingredient.addIngredientVariation(2, 'One', tuna_1);
			await this.Ingredient.addIngredientVariation(2, 'Two', tuna_2);
			await this.Ingredient.addIngredientVariation(2, 'Three', tuna_3);

			await this.Ingredient.addIngredientVariation(3, 'One', gold_1);
			await this.Ingredient.addIngredientVariation(3, 'Two', gold_2);
			await this.Ingredient.addIngredientVariation(3, 'Three', gold_3);

			await this.Ingredient.addIngredientVariation(4, 'One', beef_1);
			await this.Ingredient.addIngredientVariation(4, 'Two', beef_2);
			await this.Ingredient.addIngredientVariation(4, 'Three', beef_3);

			this.add3Tx = await this.Ingredient.addIngredientVariation(5, 'One', truffle_1);
			await this.Ingredient.addIngredientVariation(5, 'Two', truffle_2);
			await this.Ingredient.addIngredientVariation(5, 'Three', truffle_3);
		});

		it('should make pizza with all ingredients', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 2, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 3, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 4, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 5, 1, '0x384', {from: minter});

			user1CaviarBalance = await this.Ingredient.balanceOf(user1, 1);
			user1TunaBalance = await this.Ingredient.balanceOf(user1, 2);
			user1GoldBalance = await this.Ingredient.balanceOf(user1, 3);
			user1BeefBalance = await this.Ingredient.balanceOf(user1, 4);
			user1TruffleBalance = await this.Ingredient.balanceOf(user1, 5);

			ovenCaviarBalance = await this.Ingredient.balanceOf(this.Oven.address, 1);
			ovenTunaBalance = await this.Ingredient.balanceOf(this.Oven.address, 2);
			ovenGoldBalance = await this.Ingredient.balanceOf(this.Oven.address, 3);
			ovenBeefBalance = await this.Ingredient.balanceOf(this.Oven.address, 4);
			ovenTruffleBalance = await this.Ingredient.balanceOf(this.Oven.address, 5);

			//get current dish id
			currentDishIdBefore = await this.Dish.getCurrentTokenId();

			// prepare the dish
			this.prepareDish1Tx = await this.Oven.prepareDish(1, 1, [1, 2, 3, 4, 5], {from: user1});
			//	console.log('prepareDish1: ', this.prepareDish1Tx);

			// get users ingredient balance
			const user1CaviarBalanceAfter = await this.Ingredient.balanceOf(user1, 1);
			const user1TunaBalanceAfter = await this.Ingredient.balanceOf(user1, 2);
			const user1GoldBalanceAfter = await this.Ingredient.balanceOf(user1, 3);
			const user1BeefBalanceAfter = await this.Ingredient.balanceOf(user1, 4);
			const user1TruffleBalanceAfter = await this.Ingredient.balanceOf(user1, 5);

			// get Oven contract`s ingredient balance
			const ovenCaviarBalanceAfter = await this.Ingredient.balanceOf(this.Oven.address, 1);
			const ovenTunaBalanceAfter = await this.Ingredient.balanceOf(this.Oven.address, 2);
			const ovenGoldBalanceAfter = await this.Ingredient.balanceOf(this.Oven.address, 3);
			const ovenBeefBalanceAfter = await this.Ingredient.balanceOf(this.Oven.address, 4);
			const ovenTruffleBalanceAfter = await this.Ingredient.balanceOf(this.Oven.address, 5);

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
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: 100000000000});

			const addresssPath = await path.join('dishes', 'pizza' + currentDishId.toString() + '.svg');
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});

		it('should prepare pizza using cheese and caviar only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 2, 1, '0x384', {from: minter});

			// prepare the dish
			this.prepareDish2Tx = await this.Oven.prepareDish(1, 1, [1, 2], {from: user1});
			//	console.log('prepareDish2: ', this.prepareDish2Tx);

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get dish owner
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: 100000000000});

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});

		it('should prepare pizza using caviar and tuna only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 2, 1, '0x384', {from: minter});

			// prepare the dish
			await this.Oven.prepareDish(1, 1, [1, 2], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: 100000000000});

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using caviar and beef only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 4, 1, '0x384', {from: minter});

			// prepare the dish
			await this.Oven.prepareDish(1, 1, [1, 4], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: 100000000000});

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using cheese and beef only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 5, 1, '0x384', {from: minter});

			// prepare the dish
			await this.Oven.prepareDish(1, 1, [1, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: 100000000000});

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using cheese and Truffle only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 5, 1, '0x384', {from: minter});

			// prepare the dish
			await this.Oven.prepareDish(1, 1, [1, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: 100000000000});

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using cheese and tuna and beef only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 2, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 5, 1, '0x384', {from: minter});

			// prepare the dish
			this.prepareDish3Tx = await this.Oven.prepareDish(1, 1, [1, 2, 5], {from: user1});
			//	console.log('prepareDish3: ', this.prepareDish3Tx);

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: 100000000000});

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using tuna, gold, beef and truffle only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 2, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 3, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 4, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 5, 1, '0x384', {from: minter});

			// prepare the dish
			this.prepareDish4Tx = await this.Oven.prepareDish(1, 1, [2, 3, 4, 5], {from: user1});
			//	console.log('prepareDish4: ', this.prepareDish4Tx);

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: 100000000000});

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using caviar, gold,and truffle only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 2, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 4, 1, '0x384', {from: minter});
			await this.Ingredient.mint(user1, 5, 1, '0x384', {from: minter});

			await expectRevert(
				this.Oven.prepareDish(4, 1, [1, 2, 3], {from: user1}),
				'Oven: INVALID_DISH_ID'
			);

			// prepare the dish
			await this.Oven.prepareDish(1, 1, [2, 4, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(currentDishId);

			expect(dishOwner).to.be.eq(user1);

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId, {gas: 100000000000});

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});

		it('should revert when no ingredient ids are used to prepare dish', async () => {
			await expectRevert(
				this.Oven.prepareDish(1, 1, [], {from: user1}),
				'Oven: INSUFFICIENT_INGREDIENTS'
			);
		});

		it('should revert when invalid ingredient id is used to prepare dish', async () => {
			await expectRevert(
				this.Oven.prepareDish(1, 1, [7, 1, 3], {from: user1}),
				'Oven: INVALID_INGREDIENT_ID'
			);
		});
	});

	describe('updateFlame()', () => {
		let currentDishId;
		let isDishReadyToUncookBefore;
		before('update flame', async () => {
			currentDishId = await this.dish.getCurrentTokenId();

			// approve sample tokens to the oven contract
			await this.SampleToken.approve(this.Oven.address, MAX_UINT256);

			isDishReadyToUncookBefore = await this.Oven.isDishReadyToUncook();
		});
		it('should update the flame for the dish correctly', async () => {
			await this.Oven.updateFlame({from: user1});

			const dish = await this.Dish.dish(currentDishId);
			expect(dish.completionTime).to.bignumber.be.eq(new BN(time.duration.minutes('15')));
		});
	});

	describe.skip('uncookDish()', async () => {
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
			currentDishId = await this.Dish.getCurrentTokenId();

			// get user1`s dish balance
			dish1Owner = await this.Dish.ownerOf(1);

			// get user1`s ingredient balance

			user1CaviarBalance = await this.Ingredient.balanceOf(user1, 1);
			user1TunaBalance = await this.Ingredient.balanceOf(user1, 2);
			user1GoldBalance = await this.Ingredient.balanceOf(user1, 3);
			user1BeefBalance = await this.Ingredient.balanceOf(user1, 4);
			user1TruffleBalance = await this.Ingredient.balanceOf(user1, 5);

			// get oven contract`s ingredient balance
			ovenCaviarBalance = await this.Ingredient.balanceOf(this.Oven.address, 1);
			ovenTunaBalance = await this.Ingredient.balanceOf(this.Oven.address, 2);
			ovenGoldBalance = await this.Ingredient.balanceOf(this.Oven.address, 3);
			ovenBeefBalance = await this.Ingredient.balanceOf(this.Oven.address, 4);
			ovenTruffleBalance = await this.Ingredient.balanceOf(this.Oven.address, 5);

			// add Oven contract as excepted address in ingredient
			await this.Dish.addExceptedAddress(this.Oven.address, {from: owner});

			// approve dish to OvenContract
			await this.Dish.setApprovalForAll(this.Oven.address, true, {from: user1});

			// uncook dish
			this.uncookTx = await this.Oven.uncookDish(1, {from: user1});
			//console.log('uncookDish: ', this.uncookTx);
		});

		it('should uncook dish correctly', async () => {
			//get user1`s dish balance
			const dishOwner = await this.Dish.ownerOf(1);
			expect(dishOwner).to.be.eq(user1);

			// get Oven contract`s dish balance
			const OvenContractBal = await this.Dish.ownerOf(t1);
			expect(OvenContractBal).to.be.eq(this.Oven.address);

			// get users ingredient balance
			const user1CaviarBalanceAfter = await this.Ingredient.balanceOf(user1, 1);
			const user1TunaBalanceAfter = await this.Ingredient.balanceOf(user1, 2);
			const user1GoldBalanceAfter = await this.Ingredient.balanceOf(user1, 3);
			const user1BeefBalanceAfter = await this.Ingredient.balanceOf(user1, 4);
			const user1TruffleBalanceAfter = await this.Ingredient.balanceOf(user1, 5);

			// get Oven contract`s ingredient balance
			const ovenCaviarBalanceAfter = await this.Ingredient.balanceOf(this.Oven.address, 1);
			const ovenTunaBalanceAfter = await this.Ingredient.balanceOf(this.Oven.address, 2);
			const ovenGoldBalanceAfter = await this.Ingredient.balanceOf(this.Oven.address, 3);
			const ovenBeefBalanceAfter = await this.Ingredient.balanceOf(this.Oven.address, 4);
			const ovenTruffleBalanceAfter = await this.Ingredient.balanceOf(this.Oven.address, 5);

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

			expect(ovenCaviarBalance).to.bignumber.be.eq(new BN('7'));
			expect(ovenTunaBalance).to.bignumber.be.eq(new BN('6'));
			expect(ovenGoldBalance).to.bignumber.be.eq(new BN('2'));
			expect(ovenBeefBalance).to.bignumber.be.eq(new BN('4'));
			expect(ovenTruffleBalance).to.bignumber.be.eq(new BN('6'));

			expect(ovenCaviarBalanceAfter).to.bignumber.be.eq(new BN('6'));
			expect(ovenTunaBalanceAfter).to.bignumber.be.eq(new BN('5'));
			expect(ovenGoldBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(ovenBeefBalanceAfter).to.bignumber.be.eq(new BN('3'));
			expect(ovenTruffleBalanceAfter).to.bignumber.be.eq(new BN('5'));
		});

		it('should add the dish id uncooked dish ids list in Oven contract', async () => {
			const uncookedDishIds = await this.Oven.uncookedDishIds(0);

			expect(uncookedDishIds).to.bignumber.be.eq(new BN('1'));
		});

		it('should revert when non-dishOwner tries to uncook the dish', async () => {
			await expectRevert(
				this.Oven.uncookDish(currentDishId, {from: user2}),
				'Oven: ONLY_DISH_OWNER_CAN_UNCOOK'
			);
		});

		it('should revert when dishOwner tries to uncook the dish with invalid dish id', async () => {
			await expectRevert(this.Oven.uncookDish(0, {from: user1}), 'Oven: INVALID_DISH_ID');
			await expectRevert(this.Oven.uncookDish(11, {from: user1}), 'Oven: INVALID_DISH_ID');
		});

		it('should revert when user wants to get svg of uncooked dish', async () => {
			await expectRevert(
				this.Dish.serveDish(1, {from: user1}),
				'DishesNFT: CANNOT_SERVE_UNCOOKED_DISH'
			);
		});
	});

	describe.skip('upgradeProxy()', () => {
		let versionBeforeUpgrade;
		before('upgradeProxy', async () => {
			versionBeforeUpgrade = await this.Oven.getVersionNumber();

			// upgrade contract
			await upgradeProxy(this.Oven.address, OvenV2);
		});

		it('should upgrade contract correctly', async () => {
			const versionAfterUpgrade = await this.Oven.getVersionNumber();

			expect(versionBeforeUpgrade['0']).to.bignumber.be.eq(new BN('1'));
			expect(versionBeforeUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionBeforeUpgrade['2']).to.bignumber.be.eq(new BN('0'));

			expect(versionAfterUpgrade['0']).to.bignumber.be.eq(new BN('2'));
			expect(versionAfterUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionAfterUpgrade['2']).to.bignumber.be.eq(new BN('0'));
		});
	});
});
