// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BlackBoxEscrow {
    enum MatchState { Open, Locked, Settled, Cancelled }

    struct Match {
        uint256 stake;
        uint256 pool;
        MatchState state;
        bytes32 resultRoot;
    }

    address public immutable operator;
    mapping(bytes32 => Match) public matches;
    mapping(bytes32 => mapping(address => uint256)) public deposits;
    mapping(bytes32 => mapping(address => uint256)) public claimable;

    event MatchJoined(bytes32 indexed matchId, address indexed player, uint256 stake);
    event MatchSettled(bytes32 indexed matchId, bytes32 resultRoot);
    event MatchCancelled(bytes32 indexed matchId);
    event Claimed(bytes32 indexed matchId, address indexed player, uint256 amount);

    modifier onlyOperator() {
        require(msg.sender == operator, "operator only");
        _;
    }

    constructor(address operatorAddress) {
        require(operatorAddress != address(0), "zero operator");
        operator = operatorAddress;
    }

    function joinMatch(bytes32 matchId, uint256 stake, bytes calldata authorization) external payable {
        require(stake > 0 && msg.value == stake, "incorrect stake");
        Match storage game = matches[matchId];
        require(game.state == MatchState.Open, "match closed");
        require(deposits[matchId][msg.sender] == 0, "already joined");
        bytes32 authorizationHash = keccak256(
            abi.encode(matchId, msg.sender, stake, address(this), block.chainid)
        );
        require(_recover(_ethSignedMessageHash(authorizationHash), authorization) == operator, "not authorized");
        if (game.stake == 0) game.stake = stake;
        require(game.stake == stake, "stake mismatch");
        deposits[matchId][msg.sender] = stake;
        game.pool += stake;
        emit MatchJoined(matchId, msg.sender, stake);
    }

    function lock(bytes32 matchId) external onlyOperator {
        Match storage game = matches[matchId];
        require(game.state == MatchState.Open && game.pool > 0, "not lockable");
        game.state = MatchState.Locked;
    }

    function matchStake(bytes32 matchId) external view returns (uint256) {
        return matches[matchId].stake;
    }

    function settle(
        bytes32 matchId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 resultRoot
    ) external onlyOperator {
        Match storage game = matches[matchId];
        require(game.state == MatchState.Locked && game.pool > 0, "not settleable");
        require(recipients.length == amounts.length && recipients.length > 0, "invalid prizes");
        uint256 total;
        for (uint256 i; i < recipients.length; i++) {
            require(recipients[i] != address(0), "zero recipient");
            claimable[matchId][recipients[i]] += amounts[i];
            total += amounts[i];
        }
        require(total == game.pool, "pool mismatch");
        game.state = MatchState.Settled;
        game.resultRoot = resultRoot;
        emit MatchSettled(matchId, resultRoot);
    }

    function cancel(bytes32 matchId) external onlyOperator {
        Match storage game = matches[matchId];
        require(game.state == MatchState.Open || game.state == MatchState.Locked, "match closed");
        game.state = MatchState.Cancelled;
        emit MatchCancelled(matchId);
    }

    function claim(bytes32 matchId) external {
        uint256 amount = claimable[matchId][msg.sender];
        require(amount > 0, "nothing to claim");
        claimable[matchId][msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit Claimed(matchId, msg.sender, amount);
    }

    function claimRefund(bytes32 matchId) external {
        require(matches[matchId].state == MatchState.Cancelled, "not cancelled");
        uint256 amount = deposits[matchId][msg.sender];
        require(amount > 0, "nothing to refund");
        deposits[matchId][msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit Claimed(matchId, msg.sender, amount);
    }

    function _ethSignedMessageHash(bytes32 hash) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function _recover(bytes32 hash, bytes calldata signature) private pure returns (address) {
        require(signature.length == 65, "bad signature");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "bad v");
        return ecrecover(hash, v, r, s);
    }

}
