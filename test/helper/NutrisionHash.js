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

module.exports = {getNutritionsHash};
