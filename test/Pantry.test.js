require('chai').should();
const {expect} = require('chai');
const {expectRevert, BN} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const {cheese_1} = require('./svgs/Cheese');

const Pantry = artifacts.require('Pantry');
const PantryV2 = artifacts.require('PantryV2');

contract('DishesNFT', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];

	before(async () => {
		this.Pantry = await deployProxy(Pantry, [], {initializer: 'initialize'});
	});

	describe('initialize()', () => {
		it('should grant the admin role to deployer', async () => {
			const adminRole = await this.Pantry.DEFAULT_ADMIN_ROLE();

			const isAdmin = await this.Pantry.hasRole(adminRole, owner);
			expect(isAdmin).to.be.eq(true);
		});
	});

	describe('addDish()', () => {
		let currentDishId;

		before('add the dish', async () => {
			currentDishId = await this.Pantry.getCurrentDishId();

			// add the dish
			await this.Pantry.addDish('Pizza', {from: owner});
		});

		it('should add the dish correctly', async () => {
			const dishId = await this.Pantry.getCurrentDishId();

			const dishDetail = await this.Pantry.dish(dishId);

			expect(dishDetail.name).to.be.eq('Pizza');
			expect(dishDetail.totalBaseIngredients).to.bignumber.be.eq(new BN('0'));
			expect(currentDishId).to.bignumber.be.eq(new BN('0'));
			expect(dishId).to.bignumber.be.eq(new BN('1'));
		});

		it('should revert whene non-owner tries to add the dish', async () => {
			await expectRevert(
				this.Pantry.addDish('Pizza', {from: user1}),
				'Pantry: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert whene owner tries to add the dish without name', async () => {
			await expectRevert(this.Pantry.addDish('', {from: owner}), 'Pantry: INVALID_DISH_NAME');
		});

		it('should revert whene owner tries to get the base ingredient without adding base ingredient to dish', async () => {
			await expectRevert(
				this.Pantry.getBaseIngredientId('1', '0', {from: owner}),
				'Pantry: INVALID_BASE_INDEX'
			);
		});
	});

	describe('addBaseIngredientForDish()', () => {
		let currentDishId;
		let currentBaseIngredientId;
		before('add baseIngredient for dish', async () => {
			currentDishId = await this.Pantry.getCurrentDishId();
			currentBaseIngredientId = await this.Pantry.getCurrentBaseIngredientId();

			// add baseIngredient for dish
			await this.Pantry.addBaseIngredientForDish(currentDishId, 'Cheese', {from: owner});
		});

		it('should add the baseIngredient for dish correctly', async () => {
			const baseIngredientId = await this.Pantry.getCurrentBaseIngredientId();

			const baseIngredient = await this.Pantry.baseIngredient(baseIngredientId);
			const dishDetail = await this.Pantry.dish(currentDishId);

			expect(baseIngredient.name).to.be.eq('Cheese');
			expect(baseIngredient.totalVariations).to.bignumber.be.eq(new BN('0'));
			expect(dishDetail.totalBaseIngredients).to.bignumber.be.eq(new BN('1'));
			expect(currentBaseIngredientId).to.bignumber.be.eq(new BN('0'));
			expect(baseIngredientId).to.bignumber.be.eq(new BN('1'));

			currentDishId = baseIngredientId;
		});

		it('should revert whene non-owner tries to add the base ingredient to dish', async () => {
			await expectRevert(
				this.Pantry.addBaseIngredientForDish(currentDishId, 'Cheese', {from: user1}),
				'Pantry: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert whene owner tries to add the base ingredient with invalid dish id', async () => {
			await expectRevert(
				this.Pantry.addBaseIngredientForDish(0, 'Cheese', {from: owner}),
				'Pantry: INVALID_DISH_ID'
			);
			await expectRevert(
				this.Pantry.addBaseIngredientForDish(2, 'Cheese', {from: owner}),
				'Pantry: INVALID_DISH_ID'
			);
		});

		it('should revert whene owner tries to add the base ingredient without name', async () => {
			await expectRevert(
				this.Pantry.addBaseIngredientForDish(currentDishId, '', {from: owner}),
				'Pantry: INVALID_BASE_INGREDIENT_NAME'
			);
		});

		it('should revert whene owner tries to get the base variation without adding variations to base ingredient', async () => {
			await expectRevert(
				this.Pantry.getBaseVariationId('1', '0', {from: owner}),
				'Pantry: INVALID_VARIATION_INDEX'
			);
		});
	});

	describe('addBaseIngredientVariation()', () => {
		let currentVariationId;
		let currentBaseIngredientId;
		before('add varition in base ingredient', async () => {
			currentBaseIngredientId = await this.Pantry.getCurrentBaseIngredientId();
			currentVariationId = await this.Pantry.getCurrentBaseVariationId();

			// add base variation
			await this.Pantry.addBaseIngredientVariation(currentBaseIngredientId, 'Golden', cheese_1, {
				from: owner
			});
		});

		it('should add the variation for base ingredient correctly', async () => {
			const variationId = await this.Pantry.getCurrentBaseVariationId();

			const baseIngredient = await this.Pantry.baseIngredient(currentBaseIngredientId);
			const variation = await this.Pantry.baseVariation(variationId);

			expect(variation.name).to.be.eq('Golden');
			expect(variation.svg).to.be.eq(cheese_1);
			expect(baseIngredient.totalVariations).to.bignumber.be.eq(new BN('1'));
			expect(currentVariationId).to.bignumber.be.eq(new BN('0'));
			expect(variationId).to.bignumber.be.eq(new BN('1'));

			currentVariationId = variationId;
		});

		it('should revert whene non-owner tries to add the variation for the base ingredient', async () => {
			await expectRevert(
				this.Pantry.addBaseIngredientVariation(currentBaseIngredientId, 'Golden', cheese_1, {
					from: user1
				}),
				'Pantry: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert whene owner tries to add the variation with invalid baseIngredient id', async () => {
			await expectRevert(
				this.Pantry.addBaseIngredientVariation(0, 'Golden', cheese_1, {
					from: owner
				}),
				'Pantry: INVALID_BASE_INGREDIENT_ID'
			);
			await expectRevert(
				this.Pantry.addBaseIngredientVariation(5, 'Golden', cheese_1, {
					from: owner
				}),
				'Pantry: INVALID_BASE_INGREDIENT_ID'
			);
		});

		it('should revert whene owner tries to add the base ingredient without name', async () => {
			await expectRevert(
				this.Pantry.addBaseIngredientVariation(currentBaseIngredientId, '', cheese_1, {
					from: owner
				}),
				'Pantry: INVALID_VARIATION_NAME'
			);
		});

		it('should revert whene owner tries to add the base ingredient without svg', async () => {
			await expectRevert(
				this.Pantry.addBaseIngredientVariation(currentBaseIngredientId, 'Golden', '', {
					from: owner
				}),
				'Pantry: INVALID_SVG'
			);
		});
	});

	describe('getters', () => {
		let currentDishId;
		let currentBaseIngredientId;
		let currentVariationId;

		it('should get the current dish id correctly', async () => {
			currentDishId = await this.Pantry.getCurrentDishId();
			expect(currentDishId).to.bignumber.be.eq(new BN('1'));
		});

		it('should get the current base ingredient id correctly', async () => {
			currentBaseIngredientId = await this.Pantry.getCurrentBaseIngredientId();
			expect(currentBaseIngredientId).to.bignumber.be.eq(new BN('1'));
		});

		it('should get the current base variation id correctly', async () => {
			currentVariationId = await this.Pantry.getCurrentBaseVariationId();
			expect(currentVariationId).to.bignumber.be.eq(new BN('1'));
		});

		it('should get the base ingredient id from list of base ingredients of dish correctly', async () => {
			const baseIngredientId = await this.Pantry.getBaseIngredientId(currentDishId, '0');
			expect(baseIngredientId).to.bignumber.be.eq(currentBaseIngredientId);

			await expectRevert(this.Pantry.getBaseIngredientId(0, '0'), 'Pantry: INVALID_DISH_ID');
			await expectRevert(this.Pantry.getBaseIngredientId(5, '0'), 'Pantry: INVALID_DISH_ID');

			await expectRevert(
				this.Pantry.getBaseIngredientId(currentDishId, '2'),
				'Pantry: INVALID_BASE_INDEX'
			);
		});

		it('should get the base variation id from list of base variations of base ingredient correctly', async () => {
			const variationId = await this.Pantry.getBaseVariationId(currentBaseIngredientId, '0');
			expect(variationId).to.bignumber.be.eq(currentVariationId);

			await expectRevert(
				this.Pantry.getBaseVariationId(0, '0'),
				'Pantry: INVALID_BASE_INGREDIENT_ID'
			);
			await expectRevert(
				this.Pantry.getBaseVariationId(5, '0'),
				'Pantry: INVALID_BASE_INGREDIENT_ID'
			);

			await expectRevert(
				this.Pantry.getBaseVariationId(currentBaseIngredientId, '3'),
				'Pantry: INVALID_VARIATION_INDEX'
			);
		});
	});

	describe('upgradeProxy()', () => {
		let versionBeforeUpgrade;
		before('upgradeProxy', async () => {
			versionBeforeUpgrade = await this.Pantry.getVersionNumber();

			// upgrade contract
			await upgradeProxy(this.Pantry.address, PantryV2);
		});

		it('should upgrade contract correctly', async () => {
			const versionAfterUpgrade = await this.Pantry.getVersionNumber();

			expect(versionBeforeUpgrade['0']).to.bignumber.be.eq(new BN('1'));
			expect(versionBeforeUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionBeforeUpgrade['2']).to.bignumber.be.eq(new BN('0'));

			expect(versionAfterUpgrade['0']).to.bignumber.be.eq(new BN('2'));
			expect(versionAfterUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionAfterUpgrade['2']).to.bignumber.be.eq(new BN('0'));
		});
	});
});
