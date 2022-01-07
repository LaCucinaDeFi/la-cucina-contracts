pragma solidity ^0.8.0;
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';

interface IAccessories is IERC1155 {
	function addAccessoryType(uint256 _itemId, string memory _typeName)
		external
		returns (uint256 accessoryTypeId);

	function addAccessory(
		uint256 _itemId,
		uint256 _accessoryTypeId,
		uint256 _seriesId,
		string memory _name,
		string memory _svg,
		address _user,
		uint256 _amount,
		uint256 _probability
	) external returns (uint256 accessoryId);

	function addAccessoriesWithType(
		uint256 _itemId,
		string memory _typeName,
		uint256 _series,
		string[] memory _name,
		string[] memory _svg,
		address _user,
		uint256[] memory _amount,
		uint256[] memory _probabilities
	) external returns (uint256 accessoryTypeId);

	function mint(
		address _account,
		uint256 _accessoryId,
		uint256 _amount
	) external;

	function burn(
		address _account,
		uint256 _nftId,
		uint256 _amountOfCopies
	) external;

	function getTotalAccessories(
		uint256 _itemId,
		uint256 _series,
		uint256 _typeId
	) external view returns (uint256);

	function getAccessoryId(
		uint256 _itemId,
		uint256 _series,
		uint256 _typeId,
		uint256 _index
	) external view returns (uint256);

	function getCurrentNftId() external view returns (uint256);

	function items(uint256 _itemId) external view returns (string memory accessoryTypeName);

	function accessoryTypes(uint256 _itemId, uint256 _accessoryTypeId)
		external
		view
		returns (uint256 itemId, string memory accessoryTypeName);

	function accessories(uint256 _accessoryId)
		external
		view
		returns (
			uint256 itemId,
			uint256 accessoryId,
			uint256 typeId,
			string memory name,
			string memory svg,
			uint256 series,
			uint256 probability
		);

	function totalAccessoryTypes(uint256 itemId) external view returns (uint256 totalAccessoryTypes);

	function getCurrentItemId() external view returns (uint256);

	function royaltyInfo(uint256, uint256 _salePrice) external view returns (address, uint256);

	function getAccessories(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _accessoryTypeId
	) external returns (uint256 accessoryId, string memory svg);
}
