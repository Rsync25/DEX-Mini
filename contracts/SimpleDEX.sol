
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleDEX {
    string public tokenName;
    string public tokenSymbol;
    uint256 public tokenSupply;
    
    uint256 public reserveRBTC;
    uint256 public reserveToken;
    
    mapping(address => uint256) public tokenBalances;
    
    event LiquidityAdded(address indexed provider, uint256 rbtcAmount, uint256 tokenAmount);
    event Swapped(address indexed user, uint256 rbtcAmount, uint256 tokenAmount, bool isBuying);
    
    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        tokenName = _name;
        tokenSymbol = _symbol;
        tokenSupply = _initialSupply;
        tokenBalances[msg.sender] = _initialSupply;
    }
    
    // Core primitive: Constant product formula x * y = k
    function getTokenAmount(uint256 _rbtcIn) public view returns (uint256) {
        require(reserveRBTC > 0 && reserveToken > 0, "No liquidity");
        // (r + Δr) * (t - Δt) = r * t
        // Δt = t - (r * t)/(r + Δr)
        uint256 numerator = reserveRBTC * reserveToken;
        uint256 newReserveRBTC = reserveRBTC + _rbtcIn;
        uint256 newReserveToken = numerator / newReserveRBTC;
        return reserveToken - newReserveToken;
    }
    
    function getRBTCAmount(uint256 _tokenIn) public view returns (uint256) {
        require(reserveRBTC > 0 && reserveToken > 0, "No liquidity");
        // (r - Δr) * (t + Δt) = r * t
        // Δr = r - (r * t)/(t + Δt)
        uint256 numerator = reserveRBTC * reserveToken;
        uint256 newReserveToken = reserveToken + _tokenIn;
        uint256 newReserveRBTC = numerator / newReserveToken;
        return reserveRBTC - newReserveRBTC;
    }
    
    // Add liquidity
    function addLiquidity(uint256 _tokenAmount) external payable {
        require(msg.value > 0 && _tokenAmount > 0, "Must provide both");
        require(tokenBalances[msg.sender] >= _tokenAmount, "Insufficient tokens");
        
        if (reserveRBTC == 0 && reserveToken == 0) {
            // First liquidity
            reserveRBTC = msg.value;
            reserveToken = _tokenAmount;
        } else {
            // Maintain ratio
            uint256 expectedTokenAmount = (msg.value * reserveToken) / reserveRBTC;
            require(_tokenAmount >= expectedTokenAmount, "Insufficient tokens for ratio");
            
            reserveRBTC += msg.value;
            reserveToken += _tokenAmount;
        }
        
        // Transfer tokens from user to contract
        tokenBalances[msg.sender] -= _tokenAmount;
        tokenBalances[address(this)] += _tokenAmount;
        
        emit LiquidityAdded(msg.sender, msg.value, _tokenAmount);
    }
    
    // Buy tokens with RBTC
    function buyTokens() external payable {
        require(msg.value > 0, "Send RBTC");
        uint256 tokenAmount = getTokenAmount(msg.value);
        require(tokenAmount > 0, "Amount too small");
        require(tokenBalances[address(this)] >= tokenAmount, "Insufficient liquidity");
        
        reserveRBTC += msg.value;
        reserveToken -= tokenAmount;
        
        tokenBalances[address(this)] -= tokenAmount;
        tokenBalances[msg.sender] += tokenAmount;
        
        emit Swapped(msg.sender, msg.value, tokenAmount, true);
    }
    
    // Sell tokens for RBTC
    function sellTokens(uint256 _tokenAmount) external {
        require(_tokenAmount > 0, "Amount must be >0");
        require(tokenBalances[msg.sender] >= _tokenAmount, "Insufficient tokens");
        
        uint256 rbtcAmount = getRBTCAmount(_tokenAmount);
        require(rbtcAmount > 0, "Amount too small");
        require(address(this).balance >= rbtcAmount, "Insufficient RBTC");
        
        reserveToken += _tokenAmount;
        reserveRBTC -= rbtcAmount;
        
        tokenBalances[msg.sender] -= _tokenAmount;
        tokenBalances[address(this)] += _tokenAmount;
        
        payable(msg.sender).transfer(rbtcAmount);
        
        emit Swapped(msg.sender, rbtcAmount, _tokenAmount, false);
    }
    
    // Get user token balance
    function getTokenBalance(address _user) external view returns (uint256) {
        return tokenBalances[_user];
    }
    
    // Get pool stats
    function getPoolStats() external view returns (
        uint256 rbtcReserve,
        uint256 tokenReserve,
        uint256 poolShare,
        uint256 price
    ) {
        rbtcReserve = reserveRBTC;
        tokenReserve = reserveToken;
        poolShare = tokenBalances[address(this)];
        price = reserveToken > 0 ? (reserveRBTC * 1e18) / reserveToken : 0;
    }
}