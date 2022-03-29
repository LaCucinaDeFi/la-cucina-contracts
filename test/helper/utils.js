const GAS_LIMIT = 85000000;
const GAS_PRICE = 10; // 10 gwei

const gasToEth = (gascost) => {
	return (Number(gascost) * GAS_PRICE) / 10 ** 9;
};

module.exports = {
	GAS_LIMIT,
	GAS_PRICE,
	gasToEth
};
