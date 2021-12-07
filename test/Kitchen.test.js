require('chai').should();
const {expect} = require('chai');
const {expectRevert, BN} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const cheeses = require('../data/cheese');

const Kitchen = artifacts.require('Kitchen');
const KitchenV2 = artifacts.require('KitchenV2');

const GAS_LIMIT = 85000000;

contract('Kitchen', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];
	const operator = accounts[5];

	before(async () => {
		this.Kitchen = await deployProxy(Kitchen, [], {initializer: 'initialize'});

		// grant updator role to talion contract
		const OPERATOR_ROLE = await this.Kitchen.OPERATOR_ROLE();
		await this.Kitchen.grantRole(OPERATOR_ROLE, operator, {from: owner});
	});

	describe('initialize()', () => {
		it('should grant the admin role to deployer', async () => {
			const adminRole = await this.Kitchen.DEFAULT_ADMIN_ROLE();

			const isAdmin = await this.Kitchen.hasRole(adminRole, owner);
			expect(isAdmin).to.be.eq(true);
		});
	});

	describe('addDishType()', () => {
		let currentDishId;

		before('add the dishType', async () => {
			currentDishId = await this.Kitchen.getCurrentDishTypeId();

			// add the dish
			this.addDishTx = await this.Kitchen.addDishType(
				'Pizza',
				[205, 250, 270, 170, 210, 160, 120],
				[190, 195, 220, 225, 240, 260, 280],
				{from: operator}
			);
			//  console.log('addDishTx: ',this.addDishTx);
		});

		it('should add the dishType correctly', async () => {
			const dishId = await this.Kitchen.getCurrentDishTypeId();

			const dishDetail = await this.Kitchen.dishType(dishId);

			expect(dishDetail.name).to.be.eq('Pizza');
			expect(dishDetail.totalBaseIngredients).to.bignumber.be.eq(new BN('0'));
			expect(currentDishId).to.bignumber.be.eq(new BN('0'));
			expect(dishId).to.bignumber.be.eq(new BN('1'));
		});

		it('should revert whene non-owner tries to add the dishType', async () => {
			await expectRevert(
				this.Kitchen.addDishType(
					'Pizza',
					[205, 250, 270, 170, 210, 160, 120],
					[190, 195, 220, 225, 240, 260, 280],
					{from: user1}
				),
				'Kitchen: ONLY_OPERATOR_CAN_CALL'
			);
		});

		it('should revert whene owner tries to add the dishType with invalid coordinates', async () => {
			await expectRevert(
				this.Kitchen.addDishType(
					'Pizza',
					[205, 250, 270, 170, 210, 120],
					[190, 195, 220, 225, 240, 260, 280],
					{from: operator}
				),
				'Kitchen: INVALID_COORDINATES'
			);
			await expectRevert(
				this.Kitchen.addDishType(
					'Pizza',
					[205, 250, 270, 170, 210, 250, 120],
					[190, 195, 220, 225, 260, 280],
					{from: operator}
				),
				'Kitchen: INVALID_COORDINATES'
			);

			await expectRevert(
				this.Kitchen.addDishType(
					'Pizza',
					[205, 250, 270, 170, 210, 250, 120, 120],
					[190, 195, 220, 225, 260, 280, 340, 230],
					{from: operator}
				),
				'Kitchen: INVALID_COORDINATES'
			);
		});

		it('should revert whene owner tries to add the dishType without name', async () => {
			await expectRevert(
				this.Kitchen.addDishType(
					'',
					[205, 250, 270, 170, 210, 160, 120],
					[190, 195, 220, 225, 240, 260, 280],
					{from: operator}
				),
				'Kitchen: INVALID_DISH_NAME'
			);
		});

		it('should revert whene owner tries to get the base ingredient without adding base ingredient to dishType', async () => {
			await expectRevert(
				this.Kitchen.getBaseIngredientId('1', '0', {from: operator}),
				'Kitchen: INVALID_BASE_INDEX'
			);
		});
	});

	describe('addBaseIngredientForDishType()', () => {
		let currentDishId;
		let currentBaseIngredientId;
		before('add baseIngredient for dishType', async () => {
			currentDishId = await this.Kitchen.getCurrentDishTypeId();
			currentBaseIngredientId = await this.Kitchen.getCurrentBaseIngredientId();

			// add baseIngredient for dish
			this.addBaseIngredientTx = await this.Kitchen.addBaseIngredientForDishType(
				currentDishId,
				'Cheese',
				{from: operator}
			);
			//  console.log('baseIngredientTx: ',this.addBaseIngredientTx);
		});

		it('should add the baseIngredient for dishType correctly', async () => {
			const baseIngredientId = await this.Kitchen.getCurrentBaseIngredientId();

			const baseIngredient = await this.Kitchen.baseIngredient(baseIngredientId);
			const dishDetail = await this.Kitchen.dishType(currentDishId);

			expect(baseIngredient.name).to.be.eq('Cheese');
			expect(baseIngredient.totalVariations).to.bignumber.be.eq(new BN('0'));
			expect(dishDetail.totalBaseIngredients).to.bignumber.be.eq(new BN('1'));
			expect(currentBaseIngredientId).to.bignumber.be.eq(new BN('0'));
			expect(baseIngredientId).to.bignumber.be.eq(new BN('1'));

			currentDishId = baseIngredientId;
		});

		it('should revert whene non-owner tries to add the base ingredient to dishType', async () => {
			await expectRevert(
				this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Cheese', {from: user1}),
				'Kitchen: ONLY_OPERATOR_CAN_CALL'
			);
		});

		it('should revert whene owner tries to add the base ingredient with invalid dishType id', async () => {
			await expectRevert(
				this.Kitchen.addBaseIngredientForDishType(0, 'Cheese', {from: operator}),
				'Kitchen: INVALID_DISH_ID'
			);
			await expectRevert(
				this.Kitchen.addBaseIngredientForDishType(2, 'Cheese', {from: operator}),
				'Kitchen: INVALID_DISH_ID'
			);
		});

		it('should revert whene owner tries to add the base ingredient without name', async () => {
			await expectRevert(
				this.Kitchen.addBaseIngredientForDishType(currentDishId, '', {from: operator}),
				'Kitchen: INVALID_BASE_INGREDIENT_NAME'
			);
		});

		it('should revert whene owner tries to get the base variation without adding variations to base ingredient', async () => {
			await expectRevert(
				this.Kitchen.getBaseVariationId('1', '0', {from: operator}),
				'Kitchen: INVALID_VARIATION_INDEX'
			);
		});
	});

	describe('addBaseIngredientVariation()', () => {
		let currentVariationId;
		let currentBaseIngredientId;
		before('add varition in base ingredient', async () => {
			currentBaseIngredientId = await this.Kitchen.getCurrentBaseIngredientId();
			currentVariationId = await this.Kitchen.getCurrentBaseVariationId();

			// add base variation
			this.addVariationTx = await this.Kitchen.addBaseIngredientVariation(
				currentBaseIngredientId,
				'Golden',
				cheeses[0].svg,
				{
					from: operator,
					gas: GAS_LIMIT
				}
			);
			//  console.log('variationTx: ',this.addVariationTx);
		});

		it('should add the variation for base ingredient correctly', async () => {
			const variationId = await this.Kitchen.getCurrentBaseVariationId();

			const baseIngredient = await this.Kitchen.baseIngredient(currentBaseIngredientId);
			const variation = await this.Kitchen.baseVariation(variationId);

			expect(variation.name).to.be.eq('Golden');
			expect(variation.svg).to.be.eq(cheeses[0].svg);
			expect(baseIngredient.totalVariations).to.bignumber.be.eq(new BN('1'));
			expect(currentVariationId).to.bignumber.be.eq(new BN('0'));
			expect(variationId).to.bignumber.be.eq(new BN('1'));

			currentVariationId = variationId;
		});

		it('should revert whene non-owner tries to add the variation for the base ingredient', async () => {
			await expectRevert(
				this.Kitchen.addBaseIngredientVariation(currentBaseIngredientId, 'Golden', cheeses[0].svg, {
					from: user1
				}),
				'Kitchen: ONLY_OPERATOR_CAN_CALL'
			);
		});

		it('should revert whene owner tries to add the variation with invalid baseIngredient id', async () => {
			await expectRevert(
				this.Kitchen.addBaseIngredientVariation(0, 'Golden', cheeses[0].svg, {
					from: operator
				}),
				'Kitchen: INVALID_BASE_INGREDIENT_ID'
			);
			await expectRevert(
				this.Kitchen.addBaseIngredientVariation(5, 'Golden', cheeses[0].svg, {
					from: operator
				}),
				'Kitchen: INVALID_BASE_INGREDIENT_ID'
			);
		});

		it('should revert whene owner tries to add the base ingredient without name', async () => {
			await expectRevert(
				this.Kitchen.addBaseIngredientVariation(currentBaseIngredientId, '', cheeses[0].svg, {
					from: operator
				}),
				'Kitchen: INVALID_VARIATION_NAME'
			);
		});

		it('should revert whene owner tries to add the base ingredient without svg', async () => {
			await expectRevert(
				this.Kitchen.addBaseIngredientVariation(currentBaseIngredientId, 'Golden', '', {
					from: operator
				}),
				'Kitchen: INVALID_SVG'
			);
		});
	});

	describe('getters', () => {
		let currentDishId;
		let currentBaseIngredientId;
		let currentVariationId;

		it('should get the current dishType id correctly', async () => {
			currentDishId = await this.Kitchen.getCurrentDishTypeId();
			expect(currentDishId).to.bignumber.be.eq(new BN('1'));
		});

		it('should get the current base ingredient id correctly', async () => {
			currentBaseIngredientId = await this.Kitchen.getCurrentBaseIngredientId();
			expect(currentBaseIngredientId).to.bignumber.be.eq(new BN('1'));
		});

		it('should get the current base variation id correctly', async () => {
			currentVariationId = await this.Kitchen.getCurrentBaseVariationId();
			expect(currentVariationId).to.bignumber.be.eq(new BN('1'));
		});

		it('should get the base ingredient id from list of base ingredients of dishType correctly', async () => {
			const baseIngredientId = await this.Kitchen.getBaseIngredientId(currentDishId, '0');
			expect(baseIngredientId).to.bignumber.be.eq(currentBaseIngredientId);

			await expectRevert(this.Kitchen.getBaseIngredientId(0, '0'), 'Kitchen: INVALID_DISH_ID');
			await expectRevert(this.Kitchen.getBaseIngredientId(5, '0'), 'Kitchen: INVALID_DISH_ID');

			await expectRevert(
				this.Kitchen.getBaseIngredientId(currentDishId, '2'),
				'Kitchen: INVALID_BASE_INDEX'
			);
		});

		it('should get the base variation id from list of base variations of base ingredient correctly', async () => {
			const variationId = await this.Kitchen.getBaseVariationId(currentBaseIngredientId, '0');
			expect(variationId).to.bignumber.be.eq(currentVariationId);

			await expectRevert(
				this.Kitchen.getBaseVariationId(0, '0'),
				'Kitchen: INVALID_BASE_INGREDIENT_ID'
			);
			await expectRevert(
				this.Kitchen.getBaseVariationId(5, '0'),
				'Kitchen: INVALID_BASE_INGREDIENT_ID'
			);

			await expectRevert(
				this.Kitchen.getBaseVariationId(currentBaseIngredientId, '3'),
				'Kitchen: INVALID_VARIATION_INDEX'
			);
		});
	});

	describe('upgradeProxy()', () => {
		let versionBeforeUpgrade;
		before('upgradeProxy', async () => {
			versionBeforeUpgrade = await this.Kitchen.getVersionNumber();

			// upgrade contract
			await upgradeProxy(this.Kitchen.address, KitchenV2);
		});

		it('should upgrade contract correctly', async () => {
			const versionAfterUpgrade = await this.Kitchen.getVersionNumber();

			expect(versionBeforeUpgrade['0']).to.bignumber.be.eq(new BN('1'));
			expect(versionBeforeUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionBeforeUpgrade['2']).to.bignumber.be.eq(new BN('0'));

			expect(versionAfterUpgrade['0']).to.bignumber.be.eq(new BN('2'));
			expect(versionAfterUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionAfterUpgrade['2']).to.bignumber.be.eq(new BN('0'));
		});
	});
});
