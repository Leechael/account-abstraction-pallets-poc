import './App.css'

import { useState, useEffect } from 'react'
import { atom, useAtomValue, useSetAtom, useAtom } from 'jotai'
import { secp256k1Compress, encodeAddress, blake2AsU8a } from "@polkadot/util-crypto"
import { hexToU8a } from "@polkadot/util"
import { hashMessage, recoverPublicKey, createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { WagmiConfig, createConfig, useAccount, useWalletClient, useConnect } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { ApiPromise, WsProvider } from '@polkadot/api'


const config = createConfig({
  autoConnect: true,
  publicClient: createPublicClient({
    chain: mainnet,
    transport: http()
  }),
})

const connector = new InjectedConnector()

const apiPromiseAtom = atom(null)

const accountAtom = atom(null)

const substrateAddressAtom = atom(null)


function ConnectButton() {
  const account = useAccount()
  const setAccount = useSetAtom(accountAtom)
  const [apiPromise, setApiPromise] = useAtom(apiPromiseAtom)
  const { connect } = useConnect({ connector })
  const [substrateEndpoint, setSubstrateEndpoint] = useState('')

  useEffect(() => {
    if (account && account.address) {
      setAccount(account)
    }
  }, [account, setAccount])

  if (account.isConnected && apiPromise) {
    return (
      <button disabled>Connected</button>
    )
  }
  return (
    <div style={{display: 'flex', flexDirection: 'row', gap: '8px', justifyContent: 'center', width: '100%'}}>
      <input
        style={{flexGrow: 1, padding: '4px 6px'}}
        type="text"
        placeholder="ws://you-substrate-rpc-endpoint"
        value={substrateEndpoint}
        onChange={(e) => setSubstrateEndpoint(e.target.value)}
      />
      <button
        disabled={!substrateEndpoint || (substrateEndpoint.indexOf('ws://') !== 0 && substrateEndpoint.indexOf('wss://') !== 0)}
        onClick={async() => {
          connect()
          if (!apiPromise) {
            const _apiPromise = new ApiPromise({ provider: new WsProvider(substrateEndpoint), noInitWarn: true })
            await _apiPromise.isReady
            setApiPromise(_apiPromise)
          } else if (!apiPromise.isConnected) {
            await apiPromise.connect()
          }
          if (account.address) {
            console.log('auth!')
          }
        }}
      >
        Connect
      </button>
    </div>
  )
}

function SubmitRemarkTx() {
  const [message, setMessage] = useState('')
  const [events, setEvents] = useState([])
  const [blockHash, setBlockHash] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const account = useAtomValue(accountAtom)
  const { data: walletClient } = useWalletClient()
  const apiPromise = useAtomValue(apiPromiseAtom)
  if (!account || !apiPromise || !apiPromise.isConnected) {
    return (
      <div>
        please connect wallet first.
      </div>
    )
  }
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'start', width: '100%'}}>
      <div style={{display: 'flex', flexDirection: 'row', gap: '8px', justifyContent: 'center', width: '100%'}}>
        <input
          type="text"
          placeholder="Enter your remark message."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{flexGrow: 1, padding: '4px 6px'}}
        />
        <button
          disabled={!message || isLoading}
          style={{flexGrow: 1}}
          onClick={async () => {
            setIsLoading(true)
            const callData = apiPromise.tx.system.remarkWithEvent(message).inner.toHex()
            const signature = await walletClient.signMessage({ account, message: callData })
            const unsub = await apiPromise.tx.accountAbstraction.remoteCallFromEvmChain(account.address, callData, signature).send(async (result) => {
              if (result.isInBlock || result.isFinalized) {
                setEvents(result.events.map(i => i.toHuman()))
                const blockHash = await apiPromise.rpc.chain.getBlockHash(result.blockNumber)
                setBlockHash(blockHash.toHex())
                unsub()
                setIsLoading(false)
              }
            })
          }}
        >
          {isLoading ? 'Please wait...' : 'Send'}
        </button>
      </div>
      {!isLoading && blockHash ? (
        <div><a href={`https://polkadot.js.org/apps/?rpc=ws://10.0.0.120:19944#/explorer/query/${blockHash}`} target="_blank">View on Polkadot App</a></div>
      ) : null}
      {!isLoading && events.length ? (
        <div>
          <ul style={{display: 'flex', flexDirection: 'column', alignItems: 'start', margin: '0', paddingLeft: '16px'}}>
            {events.map((event, idx) => (
              <li key={idx}>
                <code>{event.event.section}.{event.event.method}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function SubStrateAddress() {
  const [substrateAddr, setSubStrate] = useAtom(substrateAddressAtom)
  const [isLoading, setIsLoading] = useState(false)
  const account = useAtomValue(accountAtom)
  const { data: walletClient } = useWalletClient()
  const apiPromise = useAtomValue(apiPromiseAtom)
  if (!account || !apiPromise || !apiPromise.isConnected) {
    return (
      <div>
        Please connect wallet first.
      </div>
    )
  }
  return (
    <div>
      <button
        disabled={isLoading}
        onClick={async () => {
          setIsLoading(true)
          const callData = apiPromise.tx.system.remarkWithEvent('mock').inner.toHex()
          const signature = await walletClient.signMessage({ account, message: callData })
          const hash = hashMessage(callData)
          const recoveredPublicKey = await recoverPublicKey({ hash, signature })
          const compressedEvmPublicKey = secp256k1Compress(hexToU8a(recoveredPublicKey))
          const subAddressFromEvmPublicKey = encodeAddress(blake2AsU8a(compressedEvmPublicKey), 42)
          setSubStrate(subAddressFromEvmPublicKey)
          setIsLoading(false)
        }}
      >
        Get Substrate address
      </button>
      {substrateAddr ? (
        <div>
          <code>{substrateAddr}</code>
        </div>
      ): null}
    </div>
  )
}

function QueryBalance() {
  const account = useAtomValue(accountAtom)
  const substrateAddress = useAtomValue(substrateAddressAtom)
  const apiPromise = useAtomValue(apiPromiseAtom)
  const [isLoading, setIsLoading] = useState(false)
  const [balance, setBalance] = useState(null)

  if (!account || !apiPromise || !apiPromise.isConnected) {
    return (
      <div>
        please connect wallet first.
      </div>
    )
  }

  if (!substrateAddress) {
    return (
      <div>
        please get your substrate address first.
      </div>
    )
  }

  return (
    <div>
      <button
        disabled={isLoading}
        onClick={async () => {
          setIsLoading(true)
          console.log(substrateAddress)
          const result = await apiPromise.query.system.account(substrateAddress)
          setBalance(result.toHuman())
          setIsLoading(false)
        }}
      >
        Get balance
      </button>
      {balance ? (
        <div>
          <code>{JSON.stringify(balance)}</code>
        </div>
      ) : null}
    </div>
  )
}


function ActionButton() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center'}}>
      <ConnectButton />
      <SubStrateAddress />
      <QueryBalance />
      <SubmitRemarkTx />
    </div>
  )
}


function App() {
  return (
    <WagmiConfig config={config}>
      <header>
        <h1 style={{fontSize: '20px'}}>viem/wagmi compatible wallet + Account Abstraction Pallet</h1>
        <p>A demo shown submit substrate transaction and sign with ethereum wallet</p>
      </header>
      <ActionButton />
    </WagmiConfig>
  )
}

export default App
