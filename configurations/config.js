const supportedTokens = {
  1: [],
  3: [],
  4: [],
  42: [],
  56: [
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  ],
  97: [
    '0xC2404BC978Fca4fB9a426a041cadfCd4CE4c1086', // LAC
    '0x6de3a3de82a7aedca279b36db65a5b03b1a9f939', // WBNB
  ],
  1111: [],
};

const royaltyReciever = {
  1: '',
  3: '',
  4: '',
  42: '',
  56: '0x1593B3d9955bB76B96C7bb9238496f933e2e46Ff', // TODO: Update for mainnet
  97: '0x1593B3d9955bB76B96C7bb9238496f933e2e46Ff',
  1111: '0x1593B3d9955bB76B96C7bb9238496f933e2e46Ff',
}

const royaltyFee = '100'; // 10%

const talienContract = {
  1: '',
  3: '',
  4: '',
  42: '',
  56: '0xb5939E2596b275e18DEe85cC24D585cC91a3CAdd', // TODO: Update for mainnet
  97: '0xb5939E2596b275e18DEe85cC24D585cC91a3CAdd',
  1111: '0xb5939E2596b275e18DEe85cC24D585cC91a3CAdd',
}

module.exports = { supportedTokens, royaltyReciever, royaltyFee, talienContract };
