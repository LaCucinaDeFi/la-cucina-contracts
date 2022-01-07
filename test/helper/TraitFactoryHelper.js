const {deployProxy} = require('@openzeppelin/truffle-upgrades');
const {ether} = require('@openzeppelin/test-helpers');
const {bg01, bg02, bg03} = require('../../data/talien/background');
const {greenBody} = require('../../data/talien/bodies');
const {angryEyes, regularEyes} = require('../../data/talien/eyes');
const {blueHead} = require('../../data/talien/heads');
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
		this.TraitFactory = await deployProxy(
			TraitFactory,
			['Mokoto Glitch Regular', ether('10'), ether('5')],
			{
				initializer: 'initialize'
			}
		);

		// grant operator role
		const OPERATOR_ROLE = await this.TraitFactory.OPERATOR_ROLE();
		await this.TraitFactory.grantRole(OPERATOR_ROLE, this.operator, {from: this.owner});

		// add  item
		await this.TraitFactory.addItem('Talion', {from: this.operator});

		// add series
		await this.updateSeries();

		// add traits
		await this.addTrait();

		// add traits variations
		await this.addTraitVariations();

		// add thresholds
		await this.addThresholds();

		return this.TraitFactory;
	};

	updateSeries = async () => {
		this.currentLaCucinaNftsItemId = await this.TraitFactory.getCurrentItemId();

		await this.TraitFactory.updateSeries(this.currentLaCucinaNftsItemId, 10, 'Genesis', true, {
			from: this.operator
		});

		this.currentSeriesOfItem = await this.TraitFactory.currentSeries(
			this.currentLaCucinaNftsItemId
		);
		console.log('currentSeries: ', this.currentSeriesOfItem.toString());
	};

	addTrait = async () => {
		await this.TraitFactory.addTrait(
			this.currentLaCucinaNftsItemId,
			this.currentSeriesOfItem,
			'Background',
			{
				from: this.operator
			}
		);
		await this.TraitFactory.addTrait(
			this.currentLaCucinaNftsItemId,
			this.currentSeriesOfItem,
			'Bodies',
			{
				from: this.operator
			}
		);
		await this.TraitFactory.addTrait(
			this.currentLaCucinaNftsItemId,
			this.currentSeriesOfItem,
			'Head',
			{
				from: this.operator
			}
		);
		await this.TraitFactory.addTrait(
			this.currentLaCucinaNftsItemId,
			this.currentSeriesOfItem,
			'Mouth',
			{
				from: this.operator
			}
		);
		await this.TraitFactory.addTrait(
			this.currentLaCucinaNftsItemId,
			this.currentSeriesOfItem,
			'Eyes',
			{
				from: this.operator
			}
		);
	};

	addTraitVariations = async () => {
		// bagraound variations
		await this.TraitFactory.addTraitVariation(
			this.currentLaCucinaNftsItemId,
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
			this.currentLaCucinaNftsItemId,
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
			this.currentLaCucinaNftsItemId,
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
			this.currentLaCucinaNftsItemId,
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
			this.currentLaCucinaNftsItemId,
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
			this.currentLaCucinaNftsItemId,
			this.currentSeriesOfItem,
			4,
			'Pierved Blue Mouth',
			piercedMouthBlue,
			'35',
			{from: this.operator}
		);
		await this.TraitFactory.addTraitVariation(
			this.currentLaCucinaNftsItemId,
			this.currentSeriesOfItem,
			4,
			'Bite Lip Blue Mouth',
			biteLipMouthBlue,
			'25',
			{from: this.operator}
		);

		// eyes variations
		await this.TraitFactory.addTraitVariation(
			this.currentLaCucinaNftsItemId,
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
			this.currentLaCucinaNftsItemId,
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
