import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import ContractABI from './abis/SimpleDEX.json';

function App() {
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Pool data
  const [rbtcReserve, setRbtcReserve] = useState('0');
  const [tokenReserve, setTokenReserve] = useState('0');
  const [price, setPrice] = useState('0');
  const [userTokenBalance, setUserTokenBalance] = useState('0');
  
  // Swap form
  const [swapMode, setSwapMode] = useState('buy'); // 'buy' or 'sell'
  const [swapInput, setSwapInput] = useState('');
  const [swapOutput, setSwapOutput] = useState('0');
  
  // Liquidity form
  const [liqRbtc, setLiqRbtc] = useState('');
  const [liqTokens, setLiqTokens] = useState('');

  const CONTRACT_ADDRESS = '0xYourAddressHere';

  const connectWallet = async () => {
    if (!window.ethereum) return alert('Install MetaMask!');
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      // Switch to RSK Testnet
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x1f' }]
        });
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x1f',
              chainName: 'RSK Testnet',
              nativeCurrency: { name: 'tRBTC', symbol: 'tRBTC', decimals: 18 },
              rpcUrls: ['https://public-node.testnet.rsk.co']
            }]
          });
        }
      }
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ContractABI, signer);
      setAccount(address);
      setContract(contract);
      loadPoolData(contract, address);
    } catch (error) {
      console.error(error);
    }
  };

  const loadPoolData = async (contract, address) => {
    try {
      const stats = await contract.getPoolStats();
      setRbtcReserve(ethers.utils.formatEther(stats.rbtcReserve));
      setTokenReserve(ethers.utils.formatEther(stats.tokenReserve));
      setPrice(ethers.utils.formatEther(stats.price));
      
      const tokenBal = await contract.getTokenBalance(address);
      setUserTokenBalance(ethers.utils.formatEther(tokenBal));
    } catch (error) {
      console.error(error);
    }
  };

  // Calculate swap output
  useEffect(() => {
    const calculateOutput = async () => {
      if (!contract || !swapInput || parseFloat(swapInput) <= 0) {
        setSwapOutput('0');
        return;
      }
      
      try {
        const amountWei = ethers.utils.parseEther(swapInput);
        let output;
        if (swapMode === 'buy') {
          output = await contract.getTokenAmount(amountWei);
        } else {
          output = await contract.getRBTCAmount(amountWei);
        }
        setSwapOutput(ethers.utils.formatEther(output));
      } catch (error) {
        setSwapOutput('0');
      }
    };
    
    calculateOutput();
  }, [swapInput, swapMode, contract]);

  const handleSwap = async () => {
    if (!contract || !swapInput) return;
    
    setLoading(true);
    try {
      const amountWei = ethers.utils.parseEther(swapInput);
      
      if (swapMode === 'buy') {
        // Buy tokens with RBTC
        const tx = await contract.buyTokens({ value: amountWei });
        await tx.wait();
        alert(`Bought ${swapOutput} tokens!`);
      } else {
        // Sell tokens for RBTC
        const tx = await contract.sellTokens(amountWei);
        await tx.wait();
        alert(`Sold ${swapInput} tokens for ${swapOutput} RBTC!`);
      }
      
      loadPoolData(contract, account);
      setSwapInput('');
    } catch (error) {
      console.error(error);
      alert('Transaction failed');
    }
    setLoading(false);
  };

  const handleAddLiquidity = async () => {
    if (!contract || !liqRbtc || !liqTokens) return;
    
    setLoading(true);
    try {
      const rbtcWei = ethers.utils.parseEther(liqRbtc);
      const tokenWei = ethers.utils.parseEther(liqTokens);
      
      const tx = await contract.addLiquidity(tokenWei, { value: rbtcWei });
      await tx.wait();
      
      alert('Liquidity added!');
      loadPoolData(contract, account);
      setLiqRbtc('');
      setLiqTokens('');
    } catch (error) {
      console.error(error);
      alert('Failed to add liquidity');
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1>🔄 Simple DEX</h1>
      <p>Constant Product Formula: x * y = k</p>
      
      {!account ? (
        <button onClick={connectWallet} style={styles.button}>
          Connect Wallet
        </button>
      ) : (
        <>
          <div style={styles.header}>
            <p>Account: {account.slice(0,6)}...{account.slice(-4)}</p>
            <p>Your Token Balance: {parseFloat(userTokenBalance).toFixed(2)}</p>
          </div>
          
          {/* Pool Stats */}
          <div style={styles.card}>
            <h3>📊 Pool Stats</h3>
            <p>RBTC Reserve: {parseFloat(rbtcReserve).toFixed(4)} RBTC</p>
            <p>Token Reserve: {parseFloat(tokenReserve).toFixed(2)} Tokens</p>
            <p>Price: 1 Token = {parseFloat(price).toFixed(6)} RBTC</p>
            <p>Constant k: {(parseFloat(rbtcReserve) * parseFloat(tokenReserve)).toFixed(2)}</p>
          </div>
          
          {/* Swap Interface */}
          <div style={styles.card}>
            <h3>🔄 Swap</h3>
            <div style={styles.tabContainer}>
              <button 
                style={{...styles.tab, background: swapMode === 'buy' ? '#4f46e5' : '#e5e7eb'}}
                onClick={() => setSwapMode('buy')}
              >
                Buy Tokens
              </button>
              <button 
                style={{...styles.tab, background: swapMode === 'sell' ? '#4f46e5' : '#e5e7eb'}}
                onClick={() => setSwapMode('sell')}
              >
                Sell Tokens
              </button>
            </div>
            
            <div style={styles.formGroup}>
              <label>You Pay ({swapMode === 'buy' ? 'RBTC' : 'Tokens'})</label>
              <input
                style={styles.input}
                type="number"
                value={swapInput}
                onChange={(e) => setSwapInput(e.target.value)}
                placeholder="0.0"
              />
            </div>
            
            <div style={styles.formGroup}>
              <label>You Receive ({swapMode === 'buy' ? 'Tokens' : 'RBTC'})</label>
              <input
                style={styles.input}
                type="number"
                value={swapOutput}
                readOnly
                placeholder="0.0"
              />
            </div>
            
            <button 
              style={styles.button}
              onClick={handleSwap}
              disabled={loading || !swapInput}
            >
              {loading ? 'Processing...' : `Swap ${swapMode === 'buy' ? 'RBTC → Tokens' : 'Tokens → RBTC'}`}
            </button>
          </div>
          
          {/* Add Liquidity */}
          <div style={styles.card}>
            <h3>💧 Add Liquidity</h3>
            <p style={styles.note}>Add both assets in the current ratio to earn fees</p>
            
            <div style={styles.formGroup}>
              <label>RBTC Amount</label>
              <input
                style={styles.input}
                type="number"
                value={liqRbtc}
                onChange={(e) => {
                  setLiqRbtc(e.target.value);
                  if (rbtcReserve !== '0' && tokenReserve !== '0') {
                    const ratio = parseFloat(tokenReserve) / parseFloat(rbtcReserve);
                    setLiqTokens((parseFloat(e.target.value) * ratio).toFixed(2));
                  }
                }}
                placeholder="0.0"
              />
            </div>
            
            <div style={styles.formGroup}>
              <label>Token Amount (auto-calculated)</label>
              <input
                style={styles.input}
                type="number"
                value={liqTokens}
                onChange={(e) => setLiqTokens(e.target.value)}
                placeholder="0.0"
              />
            </div>
            
            <button 
              style={styles.button}
              onClick={handleAddLiquidity}
              disabled={loading || !liqRbtc || !liqTokens}
            >
              {loading ? 'Processing...' : 'Add Liquidity'}
            </button>
          </div>
          
          {/* How it works */}
          <div style={styles.card}>
            <h3>📖 How it Works</h3>
            <p><strong>Constant Product Formula:</strong> x * y = k</p>
            <p>When you buy tokens, you increase x (RBTC) and decrease y (tokens) while keeping k constant.</p>
            <p>This creates an automatic price curve - larger trades get worse rates.</p>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial'
  },
  header: {
    background: '#f3f4f6',
    padding: '15px',
    borderRadius: '10px',
    marginBottom: '20px'
  },
  card: {
    background: 'white',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  tabContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  tab: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  formGroup: {
    marginBottom: '15px'
  },
  input: {
    width: '100%',
    padding: '10px',
    borderRadius: '5px',
    border: '1px solid #ddd',
    fontSize: '16px',
    marginTop: '5px'
  },
  button: {
    width: '100%',
    padding: '12px',
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  note: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '15px'
  }
};

export default App;
