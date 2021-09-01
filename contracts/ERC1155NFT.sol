// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';

import './interfaces/IVersionedContract.sol';

/**
 * @dev {ERC1155} token, including:
 *
 *  - a minter role that allows for token minting (creation)
 *  - a pauser role that allows to stop all token transfers
 *
 * This contract uses {AccessControl} to lock permissioned functions using the
 * different roles - head to its documentation for details.
 *
 * The account that deploys the contract will be granted the minter and pauser
 * roles, as well as the default admin role, which will let it grant both minter
 * and pauser roles to other accounts.
 *
 * This contract is based on the `ERC1155PresetMinterPauserUpgradeable` as specified
 * from Open Zeppelin Upgradable contracts found in the link below:
 * https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/master/contracts/token/ERC1155/presets/ERC1155PresetMinterPauserUpgradeable.sol
 *
 * This contract overrides the _beforeTokenTransfer method of ERC1155 contract to add the checks,
 * so that no user gets the multiple tokens of the same tokenId except the excepted addresses.
 *
 */
contract ERC1155NFT is
  Initializable,
  ContextUpgradeable,
  AccessControlEnumerableUpgradeable,
  ERC1155Upgradeable,
  ERC1155PausableUpgradeable,
  IVersionedContract
{
  using CountersUpgradeable for CountersUpgradeable.Counter;

  /*
   =======================================================================
   ======================== Constants ====================================
   =======================================================================
 */

  bytes32 public constant MINTER_ROLE = keccak256('MINTER_ROLE');
  bytes32 public constant PAUSER_ROLE = keccak256('PAUSER_ROLE');

  /*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */

  address[] public exceptedAddresses;

  /*
   =======================================================================
   ======================== Private Variables ============================
   =======================================================================
 */
  /// @dev tokenId -> ipfsHash
  mapping(uint256 => string) private ipfsHash;

  CountersUpgradeable.Counter private tokenCounter;

  /*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

  function initialize(string memory url) public virtual initializer {
    __ERC1155PresetMinterPauser_init(url);
  }

  function __ERC1155PresetMinterPauser_init(string memory url) internal initializer {
    __Context_init_unchained();
    __ERC165_init_unchained();
    __AccessControl_init_unchained();
    __AccessControlEnumerable_init_unchained();
    __ERC1155_init_unchained(url);
    __Pausable_init_unchained();
    __ERC1155Pausable_init_unchained();
    __ERC1155PresetMinterPauser_init_unchained();
  }

  /**
   * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, and `PAUSER_ROLE` to the account that
   * deploys the contract.
   */

  function __ERC1155PresetMinterPauser_init_unchained() internal initializer {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _setupRole(MINTER_ROLE, _msgSender());
    _setupRole(PAUSER_ROLE, _msgSender());
  }

  /*
   =======================================================================
   ======================== Modifiers ====================================
   =======================================================================
 */

  modifier onlyAdmin() {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), 'ERC1155NFT: ONLY_ADMIN_CAN_CALL');
    _;
  }

  /*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */

  /**
   * @dev Creates `amount` tokens of token type `id`, and assigns them to `account`.
   *
   * Requirements:
   *
   * - `account` cannot be the zero address.
   * - If `account` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
   * acceptance magic value.
   */
  function mint(
    address _account,
    string memory _ipfsHash,
    uint256 _amountOfCopies
  ) public returns (uint256) {
    require(hasRole(MINTER_ROLE, msg.sender), 'ERC1155NFT: MUST_HAVE_MINTER_ROLE_TO_MINT');

    tokenCounter.increment();
    _mint(_account, tokenCounter.current(), _amountOfCopies, '');
    ipfsHash[tokenCounter.current()] = _ipfsHash;

    return tokenCounter.current();
  }

  /**
   * @notice This function allows minter to burn the tokens
   * @param _account indicates the user address from which tokens to removed
   * @param _tokenId indicates the token id to burn
   * @param _amountOfCopies indicates the amount of copies of nft type to burn
   */
  function burn(
    address _account,
    uint256 _tokenId,
    uint256 _amountOfCopies
  ) public {
    require(hasRole(MINTER_ROLE, msg.sender), 'ERC1155NFT: MUST_HAVE_MINTER_ROLE_TO_BURN');
    _burn(_account, _tokenId, _amountOfCopies);
    delete ipfsHash[_tokenId];
  }

  /**
   * @dev Pauses all token transfers.
   *
   * See {ERC1155Pausable} and {Pausable-_pause}.
   *
   * Requirements:
   *
   * - the caller must have the `PAUSER_ROLE`.
   */
  function pause() public virtual {
    require(hasRole(PAUSER_ROLE, _msgSender()), 'ERC1155NFT: must have pauser role to pause');
    _pause();
  }

  /**
   * @dev Unpauses all token transfers.
   *
   * See {ERC1155Pausable} and {Pausable-_unpause}.
   *
   * Requirements:
   *
   * - the caller must have the `PAUSER_ROLE`.
   */
  function unpause() public virtual {
    require(hasRole(PAUSER_ROLE, _msgSender()), 'ERC1155NFT: must have pauser role to unpause');
    _unpause();
  }

  /**
   * @notice This method allows admin to except the addresses to have multiple tokens of same NFT.
   * @param _account indicates the address to add.
   */
  function addExceptedAddress(address _account) external onlyAdmin {
    require(_account != address(0), 'ERC1155NFT: CANNOT_EXCEPT_ZERO_ADDRESS');
    require(!isExceptedAddress(_account), 'ERC1155: ALREADY_EXCEPTED_ADDRESS');

    exceptedAddresses.push(_account);
  }

  /**
   * @notice This method allows admin to remove the excepted addresses from having multiple tokens of same NFT.
   * @param _account indicates the address to remove.
   */
  function removeExceptedAddress(address _account) external onlyAdmin {
    require(_account != address(0), 'ERC1155NFT: CANNOT_EXCEPT_ZERO_ADDRESS');

    uint256 userIndex;
    bool isUserExists;
    for (userIndex = 0; userIndex < exceptedAddresses.length; userIndex++) {
      if (exceptedAddresses[userIndex] == _account) {
        isUserExists = true;
        break;
      }
    }

    require(isUserExists, 'ERC1155NFT: CANNOT_FIND_USER');

    if (exceptedAddresses.length > 1) {
      address temp = exceptedAddresses[exceptedAddresses.length - 1];
      exceptedAddresses[userIndex] = temp;
      exceptedAddresses.pop();
    } else {
      exceptedAddresses.pop();
    }
  }

  /*
   =======================================================================
   ======================== Getter Methods ===============================
   =======================================================================
 */
  /**
   * @notice This methods checks whether given address is allowed to have multiple tokens or not.
   * @param _user indicates the user address
   * @return isExcepted - returns true if address is allowed to have multiple tokens of same nft otherwise returns false
   */
  function isExceptedAddress(address _user) public view returns (bool isExcepted) {
    for (uint256 i = 0; i < exceptedAddresses.length; i++) {
      if (exceptedAddresses[i] == _user) {
        isExcepted = true;
        break;
      }
    }
  }

  /**
   * @dev Get token uri using `_tokenID`.
   */

  function getIpfsHash(uint256 _tokenID) public view returns (string memory) {
    return ipfsHash[_tokenID];
  }

  /**
   * @notice This method retursn the current nft ID
   */
  function getCurrentNftId() external view returns (uint256) {
    return tokenCounter.current();
  }

  /**
   * @notice Returns the storage, major, minor, and patch version of the contract.
   * @return The storage, major, minor, and patch version of the contract.
   */
  function getVersionNumber()
    external
    pure
    virtual
    override
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    return (1, 0, 0);
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(bytes4 interfaceId)
    public
    view
    virtual
    override(AccessControlEnumerableUpgradeable, ERC1155Upgradeable)
    returns (bool)
  {
    return super.supportsInterface(interfaceId);
  }

  /*
   =======================================================================
   ======================== Internal Methods =============================
   =======================================================================
 */
  /**
   * @dev See {IERC165-_beforeTokenTransfer}.
   */
  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual override(ERC1155Upgradeable, ERC1155PausableUpgradeable) {
    if (!isExceptedAddress(to) && to != address(0)) {
      for (uint256 i = 0; i < ids.length; i++) {
        require(balanceOf(to, ids[i]) == 0, 'ERC1155NFT: TOKEN_ALREADY_EXIST');
      }

      for (uint256 i = 0; i < amounts.length; i++) {
        require(amounts[i] == 1, 'ERC1155NFT: USER_CAN_TRANSFER_ONLY_ONE_TOKEN');
      }
    }
    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
  }
}
