const {BN} = require('@openzeppelin/test-helpers');

const getNutritionsHash = async (nutritionsList) => {
	let nutrisionHash = 0;
	if (nutritionsList.length == 7) {
		// get base Variation Hash
		for (let i = 0; i < 7; i++) {
			let temp = 255 ** i;

			nutrisionHash = new BN(
				new BN(nutrisionHash).add(new BN(nutritionsList[i])).mul(new BN(temp))
			);
		}
	} else {
		throw console.error('Insufficient nutrisions');
	}
	return nutrisionHash;
};

const getMultiplier = async (nutritionsHash) => {
	// get rarities of 1st Talien
	let plutamins;
	let strongies;

	const slotConst = new BN('256');
	const slotMask = new BN('255');
	let bitMask = new BN('0');
	let nutritionsValue = new BN('0');
	let nutrition = new BN('0');
	let slotMultiplier;

	for (let slot = new BN('0'); slot.lt(new BN('7')); slot.iadd(new BN('1'))) {
		slotMultiplier = slotConst.pow(slot); // Create slot multiplier
		bitMask = slotMask.mul(slotMultiplier); // Create bit mask for slot
		nutritionsValue = nutritionsHash.and(bitMask); // Extract slotted value from hash

		if (nutritionsValue.gt(new BN('0'))) {
			nutrition = slot.gt(new BN('0')) // Extract IngredientID from slotted value
				? nutritionsValue.div(slotMultiplier)
				: nutritionsValue;

			// store 2nd and last nutrition i.e plutamins and strongies
			if (slot.eq(new BN('1'))) {
				plutamins = nutrition;
			}

			if (slot.eq(new BN('6'))) {
				strongies = nutrition;
			}
		}
	}

	return [plutamins, nutrition];
};



module.exports = {getNutritionsHash, getMultiplier};
