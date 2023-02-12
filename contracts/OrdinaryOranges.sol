// SPDX-License-Identifier: GPLv3

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./access/Governable.sol";
import "./interfaces/ICapsule.sol";
import "./interfaces/ICapsuleMinter.sol";

/// @title OrdinaryOranges
contract OrdinaryOranges is Governable, IERC721Receiver {
    using SafeERC20 for IERC20;
    ICapsuleFactory public constant CAPSULE_FACTORY =
        ICapsuleFactory(0x4Ced59c19F1f3a9EeBD670f746B737ACf504d1eB);
    ICapsuleMinter public constant CAPSULE_MINTER =
        ICapsuleMinter(0xb8Cf4A28DA322598FDB78a1406a61B72d6F6b396);
    ICapsule public immutable capsuleCollection;

    /// @notice Team and giveaway mints
    uint8 public constant TEAM_MINT = 16;
    uint8 public constant GIVEAWAY_MINT = 16;

    /// @notice Mint Fee
    uint256 public OOMintFee = 1 ether;

    /// @notice Flag indicating whether the OO mint is enabled.
    bool public isMintEnabled;

    event OrdinaryOrangeMinted(address indexed user);
    event OrdinaryOrangeBurnt(
        address indexed user,
        uint256 indexed id,
        string indexed btcAddress
    );
    event MintToggled(bool mintStatus);

    constructor(address _capsuleCollection) payable {
        capsuleCollection = ICapsule(_capsuleCollection);
    }

    /// @notice Governor Mint
    function governorMint() external payable {
        address _caller = _msgSender();

        require(_caller == governor, "not-governor");
        require(
            capsuleCollection.counter() < TEAM_MINT + GIVEAWAY_MINT,
            "governor-mint-period-over"
        );

        // Ordinary Orange collection will be using baseURL and will not need URI for individual NFTs.
        // Hence passing empty token URI to mint function below.
        CAPSULE_MINTER.mintSimpleCapsule{value: msg.value}(
            address(capsuleCollection),
            "",
            _caller
        );

        emit OrdinaryOrangeMinted(_caller);
    }

    /// @notice Mint an Ordinary Orange to caller address
    function mint() external payable {
        require(isMintEnabled, "mint-is-not-enabled");
        require(msg.value == OOMintFee, "wrong-mint-fee-paid");

        address _caller = _msgSender();

        // Ordinary Orange collection will be using baseURL and will not need URI for individual NFTs.
        // Hence passing empty token URI to mint function below.
        CAPSULE_MINTER.mintSimpleCapsule{value: 0.001 ether}(
            address(capsuleCollection),
            "",
            _caller
        );
        emit OrdinaryOrangeMinted(_caller);
    }

    /**
     * @notice Burn an OO
     * @param id_ OO id to burn
     * @param btcAddress the address on Bitcoin which will receive the corresponding OO
     */
    function burn(uint256 id_, string memory btcAddress) external {
        address _caller = _msgSender();
        // Transfer OO to contract
        capsuleCollection.safeTransferFrom(_caller, address(this), id_);
        // Burn OO
        CAPSULE_MINTER.burnSimpleCapsule(
            address(capsuleCollection),
            id_,
            address(this)
        );
        emit OrdinaryOrangeBurnt(_caller, id_, btcAddress);
    }

    /// @dev This function enables this contract to receive ERC721 tokens
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /******************************************************************************
     *                            Governor functions                              *
     *****************************************************************************/

    /// @notice Lock collection at 256 max count
    function lockCollectionCount() external onlyGovernor {
        capsuleCollection.lockCollectionCount(256);
    }

    /**
     * @notice sweep given token to governor of strategy
     * @param _fromToken token address to sweep
     */
    function sweep(address _fromToken) external onlyGovernor {
        if (_fromToken == address(0)) {
            Address.sendValue(payable(governor), address(this).balance);
        } else {
            uint256 _amount = IERC20(_fromToken).balanceOf(address(this));
            IERC20(_fromToken).safeTransfer(governor, _amount);
        }
    }

    /// @notice onlyGovernor:: Toggle minting status of the Ordinary Oranges
    function toggleMint() external onlyGovernor {
        isMintEnabled = !isMintEnabled;
        emit MintToggled(isMintEnabled);
    }

    /**
     * @notice onlyGovernor:: Transfer ownership of the Ordinary Oranges collection
     * @param newOwner_ Address of new owner
     */
    function transferCollectionOwnership(
        address newOwner_
    ) external onlyGovernor {
        capsuleCollection.transferOwnership(newOwner_);
    }

    /**
     * @notice onlyGovernor:: Set the collection baseURI
     * @param baseURI_ New baseURI string
     */
    function updateBaseURI(string memory baseURI_) public onlyGovernor {
        capsuleCollection.setBaseURI(baseURI_);
    }

    /**
     * @notice Update collection burner. Add self address as collection burner for OO
     */
    function claimCollectionBurnerRole() external onlyGovernor {
        CAPSULE_MINTER.factory().updateCapsuleCollectionBurner(
            address(capsuleCollection),
            address(this)
        );
    }

    /**
     * @notice onlyGovernor:: Transfer metamaster of the Ordinary Oranges collection
     * @param metamaster_ Address of new metamaster
     */
    function updateMetamaster(address metamaster_) external onlyGovernor {
        capsuleCollection.updateTokenURIOwner(metamaster_);
    }

    /**
     * @notice onlyGovernor:: Update royalty receiver and rate in Ordinary Oranges collection
     * @param royaltyReceiver_ Address of royalty receiver
     * @param royaltyRate_ Royalty rate in Basis Points. ie. 100 = 1%, 10_000 = 100%
     */
    function updateRoyaltyConfig(
        address royaltyReceiver_,
        uint256 royaltyRate_
    ) external onlyGovernor {
        capsuleCollection.updateRoyaltyConfig(royaltyReceiver_, royaltyRate_);
    }
}
