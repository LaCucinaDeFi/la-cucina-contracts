const {deployProxy} = require('@openzeppelin/truffle-upgrades');
const {ether} = require('@openzeppelin/test-helpers');

const {bg01, bg02, bg03} = require('../../data/talien/background');
const {greenBody} = require('../../data/talien/bodies');
const {cowboy} = require('../../data/talien/clothes');
const {angryEyes, regularEyes} = require('../../data/talien/eyes');
const {cowboyHat} = require('../../data/talien/headAccessory');
const {blueHead} = require('../../data/talien/heads');
const {knife, sword} = require('../../data/talien/holdingAccessory');
const {bigMouthBlue, biteLipMouthBlue, piercedMouthBlue} = require('../../data/talien/mouth');
const {silver_badge, golden_badge, platinum_badge} = require('../../data/talien/badge');

const TraitFactory = artifacts.require('TraitFactory');

class TraitFactoryContract {
	constructor(operator, owner) {
		this.operator = operator;
		this.owner = owner;
	}

	setup = async () => {
		// deploy TraitFactory contract
		this.TraitFactory = await deployProxy(TraitFactory, ['Mokoto Glitch Regular', ether('10')], {
			initializer: 'initialize'
		});

		// grant operator role
		const OPERATOR_ROLE = await this.TraitFactory.OPERATOR_ROLE();
		await this.TraitFactory.grantRole(OPERATOR_ROLE, this.operator, {from: this.owner});

		// add galaxy item
		await this.TraitFactory.addGalaxyItem('Talion', {from: this.operator});

		// add series
		await this.updateSeries();

		// add thresholds
		await this.addThresholds();

		return this.TraitFactory;
	};

	updateSeries = async () => {
		this.currentGalaxyItemId = await this.TraitFactory.getCurrentGalaxyItemId();

		await this.TraitFactory.updateSeries(this.currentGalaxyItemId, 10, 'Genesis', true, {
			from: this.operator
		});

		this.currentSeriesOfItem = await this.TraitFactory.currentSeries(this.currentGalaxyItemId);
		console.log('currentSeries: ', this.currentSeriesOfItem.toString());

		// activate nft generation
		await this.TraitFactory.activateNFTGeneration(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			{
				from: this.operator
			}
		);

		// add traits
		await this.addTrait();

		// add traits variations
		await this.addTraitVariations();
	};

	addTrait = async () => {
		await this.TraitFactory.addTrait(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			'Background',
			{
				from: this.operator
			}
		);
		await this.TraitFactory.addTrait(this.currentGalaxyItemId, this.currentSeriesOfItem, 'Bodies', {
			from: this.operator
		});
		await this.TraitFactory.addTrait(this.currentGalaxyItemId, this.currentSeriesOfItem, 'Head', {
			from: this.operator
		});
		await this.TraitFactory.addTrait(this.currentGalaxyItemId, this.currentSeriesOfItem, 'Mouth', {
			from: this.operator
		});
		await this.TraitFactory.addTrait(this.currentGalaxyItemId, this.currentSeriesOfItem, 'Eyes', {
			from: this.operator
		});
	};

	addTraitVariations = async () => {
		// bagraound variations
		await this.TraitFactory.addTraitVariation(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			1,
			'BG_04',
			bg01,
			'20',
			{
				from: this.operator
			}
		);
		await this.TraitFactory.addTraitVariation(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			1,
			'BG_09',
			bg02,
			'80',
			{
				from: this.operator
			}
		);

		// body variations
		await this.TraitFactory.addTraitVariation(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			2,
			'Green Body',
			greenBody,
			'100',
			{
				from: this.operator
			}
		);

		// head variations
		await this.TraitFactory.addTraitVariation(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			3,
			'Blue Head',
			blueHead,
			'100',
			{
				from: this.operator
			}
		);

		// mouth variations
		await this.TraitFactory.addTraitVariation(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			4,
			'Big Blue Mouth',
			bigMouthBlue,
			'40',
			{
				from: this.operator
			}
		);
		await this.TraitFactory.addTraitVariation(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			4,
			'Pierved Blue Mouth',
			piercedMouthBlue,
			'35',
			{from: this.operator}
		);
		await this.TraitFactory.addTraitVariation(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			4,
			'Bite Lip Blue Mouth',
			biteLipMouthBlue,
			'25',
			{from: this.operator}
		);

		// eyes variations
		await this.TraitFactory.addTraitVariation(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			5,
			'Angry Eyes',
			angryEyes,
			'10',
			{
				from: this.operator
			}
		);
		await this.TraitFactory.addTraitVariation(
			this.currentGalaxyItemId,
			this.currentSeriesOfItem,
			5,
			'Regular Eyes',
			regularEyes,
			'90',
			{
				from: this.operator
			}
		);
	};

	addThresholds = async () => {
		// add threshold
		await this.TraitFactory.addThreshold(2, 'Silver', silver_badge, {from: this.operator});
		await this.TraitFactory.addThreshold(3, 'Golden', golden_badge, {from: this.operator});
		await this.TraitFactory.addThreshold(7, 'Platinum', platinum_badge, {from: this.operator});
	};
}

module.exports = {TraitFactoryContract};
