import './App.css'

import { useState } from 'react'
import { atom, useAtomValue, useSetAtom, useAtom } from 'jotai'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { createPublicClient, createWalletClient, http, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { WagmiConfig, createConfig, useAccount, useConnect } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { OnChainRegistry, options, PinkContractPromise, unstable_WalletClientSigner } from '@phala/sdk'

import abi from './metadata.json'


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

const signerAtom = atom(null)

function ConnectButton() {
  const account = useAccount()
  const setAccount = useSetAtom(accountAtom)
  const [apiPromise, setApiPromise] = useAtom(apiPromiseAtom)
  const { connect } = useConnect({ connector })
  const [substrateEndpoint, setSubstrateEndpoint] = useState('')
  const [signer, setSigner] = useAtom(signerAtom)

  if (account.isConnected && apiPromise && signer) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', width: '100%'}}>
        <button disabled>Connected</button>
        <div>Address: {signer.address}</div>
      </div>
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
        disabled={!substrateEndpoint || (substrateEndpoint.indexOf('ws://') !== 0 && substrateEndpoint.indexOf('wss://') !== 0) || !account}
        onClick={async() => {
          connect()
          if (!apiPromise) {
            const _apiPromise = new ApiPromise(options({ provider: new WsProvider(substrateEndpoint), noInitWarn: true }))
            await _apiPromise.isReady
            setApiPromise(_apiPromise)
            const client = createWalletClient({ chain: mainnet, transport: custom(window.ethereum) })
            const [address] = await client.requestAddresses()
            const signer = await unstable_WalletClientSigner.create(_apiPromise, client, { address })
            setAccount({ address })
            setSigner(signer)
          } else if (!apiPromise.isConnected) {
            await apiPromise.connect()
            const client = createWalletClient({ chain: mainnet, transport: custom(window.ethereum) })
            const [address] = await client.requestAddresses()
            const signer = await unstable_WalletClientSigner.create(apiPromise, client, { address })
            setAccount({ address })
            setSigner(signer)
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
  const apiPromise = useAtomValue(apiPromiseAtom)
  const signer = useAtomValue(signerAtom)
  if (!signer || !apiPromise || !apiPromise.isConnected) {
    return null
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
            try {
              const result = await signer.send(apiPromise.tx.system.remarkWithEvent(message))
              setEvents(result.events.map(i => i.toHuman()))
              const blockHash = await apiPromise.rpc.chain.getBlockHash(result.blockNumber)
              setBlockHash(blockHash.toHex())
            } finally {
              setIsLoading(false)
            }
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

function QueryBalance() {
  const signer = useAtomValue(signerAtom)
  const apiPromise = useAtomValue(apiPromiseAtom)
  const [isLoading, setIsLoading] = useState(false)
  const [balance, setBalance] = useState(null)

  if (!signer || !apiPromise || !apiPromise.isConnected) {
    return null
  }

  return (
    <div>
      <button
        disabled={isLoading}
        onClick={async () => {
          setIsLoading(true)
          const result = await apiPromise.query.system.account(signer.address)
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

function TestContractTrx({ contractId }) {
  const [message, setMessage] = useState('')
  const [events, setEvents] = useState([])
  const [blockHash, setBlockHash] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const apiPromise = useAtomValue(apiPromiseAtom)
  const signer = useAtomValue(signerAtom)
  if (!signer || !apiPromise || !apiPromise.isConnected) {
    return null
  }
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'start', width: '100%'}}>
      <div style={{display: 'flex', flexDirection: 'row', gap: '8px', justifyContent: 'center', width: '100%'}}>
        <input
          type="text"
          placeholder="Enter a badge name."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{flexGrow: 1, padding: '4px 6px'}}
        />
        <button
          disabled={!message || isLoading}
          style={{flexGrow: 1}}
          onClick={async () => {
            setIsLoading(true)
            try {
              // Providing basic interface integration with Phat Contract.
              const registry = await OnChainRegistry.create(apiPromise)
              const contractKey = await registry.getContractKeyOrFail(contractId)
              const contract = new PinkContractPromise(apiPromise, registry, abi, contractId, contractKey)
              const result = await contract.send.newBadge({ unstable_signer: signer }, message)
              setEvents(result.events.map(i => i.toHuman()))
              const blockHash = await apiPromise.rpc.chain.getBlockHash(result.blockNumber)
              setBlockHash(blockHash.toHex())
              setMessage('')
            } finally {
              setIsLoading(false)
            }
          }}
        >
          {isLoading ? 'Please wait...' : 'Create'}
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

function TestOffchainQuery({ contractId }) {
  const [result, setResult] = useState('')
  const apiPromise = useAtomValue(apiPromiseAtom)
  const signer = useAtomValue(signerAtom)
  const [cacheCert, setCacheCert] = useState(null)
  if (!signer || !apiPromise || !apiPromise.isConnected) {
    return null
  }
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'start', width: '100%'}}>
      <button
        onClick={async () => {
          // Providing basic interface integration with Phat Contract.
          const registry = await OnChainRegistry.create(apiPromise)
          const contractKey = await registry.getContractKeyOrFail(contractId)
          const contract = new PinkContractPromise(apiPromise, registry, abi, contractId, contractKey)
          let cert = cacheCert
          if (!cacheCert) {
            cert = await signer.signCertificate()
            setCacheCert(cert)
          }
          const { output } = await contract.query.getTotalBadges(cert.address, { cert })
          setResult(output.toJSON())
        }}
      >
        test
      </button>
      {result ? (
        <div>
          Total badges: <code>{result}</code>
        </div>
      ) : null}
    </div>
  )
}


function App() {
  const contractId = '0xff6a19cc77bc893ef950eede0c271460952a426bfb9b18580e0b0729db999268'
  return (
    <WagmiConfig config={config}>
      <header>
        <h1 style={{fontSize: '20px'}}>viem/wagmi compatible wallet + Account Abstraction Pallet</h1>
        <p>A demo shown submit substrate transaction and sign with ethereum wallet</p>
      </header>
      <ConnectButton />
      <hr />
      <div style={{display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center'}}>
        <div>
          <h4>Query store</h4>
          <QueryBalance />
        </div>
        <div>
          <h4>Send extrinct</h4>
          <SubmitRemarkTx />
        </div>
        <div>
          <h4>Send contract transaction</h4>
          <TestContractTrx contractId={contractId} />
        </div>
        <div>
          <h4>Send contract query</h4>
          <TestOffchainQuery contractId={contractId} />
        </div>
      </div>
    </WagmiConfig>
  )
}

export default App
