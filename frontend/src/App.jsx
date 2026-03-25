import { useState, useEffect, useRef, useCallback } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'

const NODE_COLORS = {
  Customer: '#4A90D9',
  Order: '#7B68EE',
  OrderItem: '#9B59B6',
  Product: '#20B2AA',
  Shipment: '#50C878',
  Invoice: '#FFD700',
  Payment: '#FF6B6B',
}

const appStyle = {
  width: '100vw',
  height: '100vh', 
  background: '#0f1117',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
}

const headerStyle = {
  height: '48px',
  flexShrink: 0,
  background: '#161822',
  borderBottom: '1px solid #2a2d3a',
  display: 'flex',
  alignItems: 'center',
  padding: '0 20px'
}

const bodyStyle = {
  width: '100vw',
  height: 'calc(100vh - 48px)',
  display: 'flex',
  flexDirection: 'row',
  overflow: 'hidden'
}

const graphContainerStyle = {
  width: '70vw',
  height: 'calc(100vh - 48px)',
  position: 'relative',
  overflow: 'hidden',
  background: '#0f1117'
}

const chatContainerStyle = {
  width: '30vw',
  height: 'calc(100vh - 48px)',
  display: 'flex',
  flexDirection: 'column',
  background: '#13151f',
  borderLeft: '1px solid #2a2d3a'
}

/* ───────────────────── APP ───────────────────── */
export default function App() {
  return (
    <div style={appStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>Order to Cash</span>
        <span style={{ fontSize: 13, color: '#8a8fa8', marginLeft: 10 }}>— Context Graph</span>
      </div>
      <div style={bodyStyle}>
        <GraphPanel />
        <ChatPanel />
      </div>
    </div>
  )
}

/* ──────────────── GRAPH PANEL ──────────────── */
function GraphPanel() {
  const canvasRef = useRef(null)
  const simRef = useRef(null)
  const nodesRef = useRef([])
  const linksRef = useRef([])
  const [selectedNode, setSelectedNode] = useState(null)

  useEffect(() => {
    const W = Math.floor(window.innerWidth * 0.70)
    const H = window.innerHeight - 48
    const canvas = canvasRef.current
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    fetch('/api/graph/full')
      .then(r => r.json())
      .then(data => {
        console.log(`Graph loaded: ${data.nodes.length} nodes, ${data.links.length} links`)
        
        const nodes = data.nodes.map(n => ({ ...n }))
        const links = data.links.map(l => ({ ...l }))
        
        const sim = forceSimulation(nodes)
          .force('link', forceLink(links).id(d => d.id).distance(80))
          .force('charge', forceManyBody().strength(-200))
          .force('center', forceCenter(W / 2, H / 2))
          .force('collision', forceCollide().radius(20))
          .on('tick', () => {
            ctx.clearRect(0, 0, W, H)
            
            // draw links
            ctx.strokeStyle = '#334155'
            ctx.lineWidth = 1
            for (const link of links) {
              const s = link.source
              const t = link.target
              if (!s.x || !t.x) continue
              ctx.beginPath()
              ctx.moveTo(s.x, s.y)
              ctx.lineTo(t.x, t.y)
              ctx.stroke()
            }
            
            // draw nodes
            for (const node of nodes) {
              if (!node.x) continue
              const color = NODE_COLORS[node.type] || '#888'
              ctx.beginPath()
              ctx.arc(node.x, node.y, 8, 0, Math.PI * 2)
              ctx.fillStyle = color
              ctx.fill()
              ctx.fillStyle = '#ccc'
              ctx.font = '9px Inter, sans-serif'
              ctx.textAlign = 'center'
              ctx.fillText(node.label || '', node.x, node.y + 18)
            }
          })
        
        simRef.current = sim
        nodesRef.current = nodes
        linksRef.current = links
      })
      .catch(e => console.error('Fetch error:', e))

    return () => { if (simRef.current) simRef.current.stop() }
  }, [])

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const nodes = nodesRef.current

    let closest = null
    let minDist = 15
    for (const node of nodes) {
      if (node.x == null) continue
      const dx = node.x - mx
      const dy = node.y - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDist) {
        minDist = dist
        closest = node
      }
    }
    setSelectedNode(closest)
  }, [])

  return (
    <div style={graphContainerStyle}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {/* Legend */}
      <div style={{ position: 'absolute', top: 12, left: 12, background: '#1a1d2eee', borderRadius: 8, padding: '10px 14px', fontSize: 11, lineHeight: '20px', border: '1px solid #2a2d3a', zIndex: 10 }}>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color }} />
            <span>{type}</span>
          </div>
        ))}
      </div>
      {/* Metadata Panel */}
      {selectedNode && (
        <div style={{
          position: 'absolute', top: 12, right: 12, width: 280, maxHeight: 'calc(100% - 24px)', overflowY: 'auto',
          background: '#1a1d2eee', border: '1px solid #3a3d4e', borderRadius: 10, padding: 16, fontSize: 12, zIndex: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: NODE_COLORS[selectedNode.type] || '#fff' }}>{selectedNode.type}</span>
            <span onClick={() => setSelectedNode(null)} style={{ cursor: 'pointer', color: '#888', fontSize: 16, lineHeight: 1 }}>✕</span>
          </div>
          {Object.entries(selectedNode)
            .filter(([k]) => !['x', 'y', 'vx', 'vy', 'index', 'fx', 'fy'].includes(k))
            .map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #2a2d3a' }}>
                <span style={{ color: '#8a8fa8' }}>{k}</span>
                <span style={{ color: '#e0e0e0', maxWidth: 160, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v ?? '')}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

/* ──────────────── CHAT PANEL ──────────────── */
function ChatPanel() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! Ask me anything about the Order-to-Cash dataset.\nTry: "Which products are associated with the most invoices?"' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      const isGuardrail = data.sql === null && data.data === null
      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.response,
        sql: data.sql,
        guardrail: isGuardrail,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={chatContainerStyle}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #2a2d3a', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Chat with Graph</div>
        <div style={{ fontSize: 11, color: '#8a8fa8', marginTop: 2 }}>Order to Cash</div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid #2a2d3a', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about orders, invoices, payments..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#1a1d2e', color: '#e0e0e0',
            fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif",
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 18px', borderRadius: 8, border: 'none', background: loading ? '#444' : '#7B68EE', color: '#fff',
            fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const bgColor = isUser ? '#7B68EE' : msg.guardrail ? '#FF8C00' : '#1e2130'

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '88%', padding: '10px 14px', borderRadius: 12, background: bgColor,
        fontSize: 13, lineHeight: 1.55, color: '#fff', wordBreak: 'break-word',
      }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
        {msg.sql && (
          <details style={{ marginTop: 8, fontSize: 11 }}>
            <summary style={{ cursor: 'pointer', color: '#aaa' }}>View SQL</summary>
            <pre style={{ marginTop: 4, padding: 8, background: '#0f1117', borderRadius: 6, overflowX: 'auto', color: '#9be39b', fontSize: 11, lineHeight: 1.4 }}>{msg.sql}</pre>
          </details>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 4, padding: '10px 16px', background: '#1e2130', borderRadius: 12 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: '#8a8fa8',
            animation: `blink 1.2s infinite ${i * 0.2}s`,
          }} />
        ))}
        <style>{`@keyframes blink { 0%,80%,100% { opacity:.3 } 40% { opacity:1 }}`}</style>
      </div>
    </div>
  )
}
