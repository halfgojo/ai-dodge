import { useState, useEffect, useCallback, useRef } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

// ── Colour palette per entity type ──────────────────────────────────────────
const TYPE_COLORS = {
  Customer:  '#6495ED',
  Order:     '#FFA07A',
  Product:   '#3CB371',
  OrderItem: '#DDA0DD',
  Invoice:   '#FF6347',
  Payment:   '#40E0D0',
  Shipment:  '#FFD700',
}
const DEFAULT_COLOR = '#aaa'
const nodeColor = (node) => TYPE_COLORS[node.type] || DEFAULT_COLOR

// ── Global styles ────────────────────────────────────────────────────────────
const appStyle = {
  width: '100vw', height: '100vh',
  background: '#0f1117', display: 'flex', flexDirection: 'column', overflow: 'hidden',
}
const headerStyle = {
  height: 48, flexShrink: 0, background: '#161822',
  borderBottom: '1px solid #2a2d3a', display: 'flex', alignItems: 'center',
  padding: '0 20px', gap: 12,
}
const bodyStyle = {
  width: '100vw', height: 'calc(100vh - 48px)', display: 'flex',
  flexDirection: 'row', overflow: 'hidden',
}
const graphContainerStyle = {
  width: '70vw', height: 'calc(100vh - 48px)',
  position: 'relative', overflow: 'hidden', background: '#0d0f1a',
}
const chatContainerStyle = {
  width: '30vw', height: 'calc(100vh - 48px)',
  display: 'flex', flexDirection: 'column',
  background: '#13151f', borderLeft: '1px solid #2a2d3a',
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div style={appStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>
          Order to Cash
        </span>
        <span style={{ fontSize: 13, color: '#8a8fa8' }}>— Context Graph</span>
      </div>
      <div style={bodyStyle}>
        <GraphPanel />
        <ChatPanel />
      </div>
    </div>
  )
}

// ── Graph Panel ──────────────────────────────────────────────────────────────
function GraphPanel() {
  const [fullGraph, setFullGraph]       = useState({ nodes: [], links: [] })
  const [graphData, setGraphData]       = useState({ nodes: [], links: [] })
  const [selectedNode, setSelectedNode] = useState(null)
  const [isSubgraph, setIsSubgraph]     = useState(false)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [highlightNodes, setHighlightNodes] = useState(new Set())
  const [highlightLinks, setHighlightLinks] = useState(new Set())
  const fgRef = useRef()

  useEffect(() => {
    fetch('/api/graph/full')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setFullGraph(data)
        setGraphData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node)

    // highlight connected nodes/links
    const connectedNodes = new Set([node.id])
    const connectedLinks = new Set()
    graphData.links.forEach(link => {
      const src = link.source?.id ?? link.source
      const tgt = link.target?.id ?? link.target
      if (src === node.id || tgt === node.id) {
        connectedNodes.add(src)
        connectedNodes.add(tgt)
        connectedLinks.add(link)
      }
    })
    setHighlightNodes(connectedNodes)
    setHighlightLinks(connectedLinks)
  }, [graphData])

  const handleExpandNode = useCallback((node) => {
    const entityId = node.id
    fetch(`/api/graph/entity/${encodeURIComponent(entityId)}?depth=2`)
      .then(r => r.json())
      .then(data => {
        setGraphData(data)
        setIsSubgraph(true)
        setSelectedNode(null)
        setHighlightNodes(new Set())
        setHighlightLinks(new Set())
        setTimeout(() => fgRef.current?.zoomToFit(400, 60), 300)
      })
      .catch(console.error)
  }, [])

  const resetToFull = useCallback(() => {
    setGraphData(fullGraph)
    setIsSubgraph(false)
    setSelectedNode(null)
    setHighlightNodes(new Set())
    setHighlightLinks(new Set())
    setTimeout(() => fgRef.current?.zoomToFit(400, 40), 300)
  }, [fullGraph])

  const paintNode = useCallback((node, ctx, globalScale) => {
    const label = node.label || node.id
    const fontSize = Math.max(8, 12 / globalScale)
    const r = 6
    const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id)
    const alpha = isHighlighted ? 1 : 0.2

    ctx.globalAlpha = alpha

    // circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = nodeColor(node)
    ctx.fill()

    // border for selected
    if (selectedNode && selectedNode.id === node.id) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2 / globalScale
      ctx.stroke()
    }

    // label
    if (globalScale >= 0.5) {
      ctx.font = `${fontSize}px Inter, sans-serif`
      ctx.fillStyle = '#e8e8e8'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, node.x, node.y + r + fontSize * 0.9)
    }

    ctx.globalAlpha = 1
  }, [highlightNodes, selectedNode])

  const W = Math.floor(window.innerWidth * 0.70)
  const H = window.innerHeight - 48

  return (
    <div style={graphContainerStyle}>
      {/* Toolbar */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 20,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        {isSubgraph && (
          <button onClick={resetToFull} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #3a3d4e',
            background: '#1e2130', color: '#e0e0e0', fontSize: 12,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            ← Full Graph
          </button>
        )}
        <span style={{ fontSize: 11, color: '#8a8fa8', fontFamily: 'Inter, sans-serif' }}>
          {graphData.nodes.length} nodes · {graphData.links.length} edges
          {isSubgraph && ' (subgraph)'}
        </span>
      </div>

      {/* Legend */}
      <Legend />

      {/* Graph */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: '#8a8fa8', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
          Loading graph…
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: '#FF6347', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
          Failed to load graph: {error}
        </div>
      )}
      {!loading && !error && (
        <ForceGraph2D
          ref={fgRef}
          width={W}
          height={H}
          graphData={graphData}
          nodeId="id"
          linkSource="source"
          linkTarget="target"
          backgroundColor="#0d0f1a"
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => 'replace'}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI)
            ctx.fill()
          }}
          linkColor={(link) => {
            const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(link)
            return isHighlighted ? '#7b8fc4' : '#2a2d3a'
          }}
          linkWidth={(link) => (highlightLinks.has(link) ? 2 : 1)}
          linkDirectionalArrowLength={5}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={(link) => {
            const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(link)
            return isHighlighted ? '#7b8fc4' : '#2a2d3a'
          }}
          linkLabel="label"
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link, ctx, globalScale) => {
            if (globalScale < 1.2) return
            const src = link.source
            const tgt = link.target
            if (!src?.x || !tgt?.x) return
            const mx = (src.x + tgt.x) / 2
            const my = (src.y + tgt.y) / 2
            const fontSize = 8 / globalScale
            ctx.font = `${fontSize}px Inter, sans-serif`
            ctx.fillStyle = '#888'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(link.label, mx, my)
          }}
          onNodeClick={handleNodeClick}
          onBackgroundClick={() => {
            setSelectedNode(null)
            setHighlightNodes(new Set())
            setHighlightLinks(new Set())
          }}
          cooldownTicks={120}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      )}

      {/* Node detail panel */}
      {selectedNode && (
        <NodeDetail
          node={selectedNode}
          onClose={() => { setSelectedNode(null); setHighlightNodes(new Set()); setHighlightLinks(new Set()) }}
          onExpand={() => handleExpandNode(selectedNode)}
        />
      )}
    </div>
  )
}

// ── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 12, zIndex: 20,
      background: '#1a1d2ecc', border: '1px solid #2a2d3a',
      borderRadius: 8, padding: '10px 14px', fontSize: 11,
      fontFamily: 'Inter, sans-serif',
    }}>
      {Object.entries(TYPE_COLORS).map(([type, color]) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ color: '#ccc' }}>{type}</span>
        </div>
      ))}
    </div>
  )
}

// ── Node Detail Panel ────────────────────────────────────────────────────────
const EXCLUDED_KEYS = ['x', 'y', 'vx', 'vy', 'index', '__indexColor', 'fx', 'fy']

function NodeDetail({ node, onClose, onExpand }) {
  const color = TYPE_COLORS[node.type] || DEFAULT_COLOR
  const entries = Object.entries(node).filter(([k]) => !EXCLUDED_KEYS.includes(k))

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, width: 290,
      maxHeight: 'calc(100% - 24px)', overflowY: 'auto',
      background: '#1a1d2ef0', border: `1px solid ${color}55`,
      borderRadius: 10, padding: 16, fontSize: 12, zIndex: 30,
      boxShadow: '0 8px 32px rgba(0,0,0,.6)', color: '#e0e0e0',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
          <span style={{ fontWeight: 700, fontSize: 13, color }}>{node.type}</span>
        </div>
        <span onClick={onClose}
          style={{ cursor: 'pointer', color: '#888', fontSize: 18, lineHeight: 1, userSelect: 'none' }}>✕</span>
      </div>

      {/* fields */}
      {entries.map(([k, v]) => (
        <div key={k} style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '4px 0', borderBottom: '1px solid #23263a',
        }}>
          <span style={{ color: '#8a8fa8', flexShrink: 0, marginRight: 8 }}>{k}</span>
          <span style={{
            color: '#e0e0e0', maxWidth: 170, textAlign: 'right',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{String(v ?? '—')}</span>
        </div>
      ))}

      {/* expand button */}
      <button onClick={onExpand} style={{
        marginTop: 12, width: '100%', padding: '8px 0', borderRadius: 6,
        border: `1px solid ${color}66`, background: `${color}22`,
        color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
      }}>
        Expand neighbourhood →
      </button>
    </div>
  )
}

// ── Chat Panel ───────────────────────────────────────────────────────────────
const EXAMPLE_QUERIES = [
  'Which products have the most billing documents?',
  'Show orders that are delivered but not billed',
  'How many customers are in each segment?',
  'Trace the full flow of ORD001',
]

function ChatPanel() {
  const [messages, setMessages] = useState([{
    role: 'ai',
    text: 'Hello! Ask me anything about the Order-to-Cash dataset.',
    examples: true,
  }])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendQuery = async (query) => {
    const q = query.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)

    try {
      const res  = await fetch('/api/chat', {
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
        data: data.data,
        guardrail: isGuardrail,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleSend  = () => sendQuery(input)
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  return (
    <div style={chatContainerStyle}>
      {/* header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #2a2d3a', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', fontFamily: 'Inter, sans-serif' }}>
          Chat with Graph
        </div>
        <div style={{ fontSize: 11, color: '#8a8fa8', marginTop: 2, fontFamily: 'Inter, sans-serif' }}>
          Ask questions about the O2C dataset
        </div>
      </div>

      {/* messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10,
        fontFamily: 'Inter, sans-serif',
      }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onExampleClick={sendQuery} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid #2a2d3a',
        display: 'flex', gap: 8, flexShrink: 0,
        fontFamily: 'Inter, sans-serif',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about orders, invoices, payments…"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            border: '1px solid #2a2d3a', background: '#1a1d2e', color: '#e0e0e0',
            fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 18px', borderRadius: 8, border: 'none',
            background: (loading || !input.trim()) ? '#333' : '#7B68EE',
            color: '#fff', fontWeight: 600, fontSize: 13,
            cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif', transition: 'background 0.15s',
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, onExampleClick }) {
  const isUser   = msg.role === 'user'
  const bgColor  = isUser ? '#7B68EE' : msg.guardrail ? '#7a3300' : '#1e2130'
  const [showData, setShowData] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '90%', padding: '10px 14px', borderRadius: 12,
        background: bgColor, fontSize: 13, lineHeight: 1.6,
        color: msg.guardrail ? '#ffaa66' : '#fff', wordBreak: 'break-word',
      }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>

        {/* example queries on first AI message */}
        {msg.examples && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {EXAMPLE_QUERIES.map((q, i) => (
              <button key={i} onClick={() => onExampleClick(q)} style={{
                textAlign: 'left', padding: '6px 10px', borderRadius: 6,
                border: '1px solid #3a3d4e', background: '#252840',
                color: '#b0b8e8', fontSize: 11.5, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', lineHeight: 1.4,
              }}>{q}</button>
            ))}
          </div>
        )}

        {/* SQL toggle */}
        {msg.sql && (
          <details style={{ marginTop: 8, fontSize: 11 }}>
            <summary style={{ cursor: 'pointer', color: '#aaa', userSelect: 'none' }}>View SQL</summary>
            <pre style={{
              marginTop: 4, padding: 8, background: '#0f1117', borderRadius: 6,
              overflowX: 'auto', color: '#9be39b', fontSize: 11, lineHeight: 1.4,
            }}>{msg.sql}</pre>
          </details>
        )}

        {/* Data table toggle */}
        {msg.data && msg.data.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <span
              onClick={() => setShowData(p => !p)}
              style={{ fontSize: 11, color: '#aaa', cursor: 'pointer', userSelect: 'none' }}
            >
              {showData ? '▾ Hide data' : `▸ Show data (${msg.data.length} rows)`}
            </span>
            {showData && (
              <div style={{ marginTop: 6, overflowX: 'auto', maxHeight: 200, overflowY: 'auto' }}>
                <DataTable rows={msg.data} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Data Table ───────────────────────────────────────────────────────────────
function DataTable({ rows }) {
  if (!rows || rows.length === 0) return null
  const cols = Object.keys(rows[0])
  return (
    <table style={{
      width: '100%', borderCollapse: 'collapse',
      fontSize: 10.5, color: '#ccc', fontFamily: 'Inter, sans-serif',
    }}>
      <thead>
        <tr>
          {cols.map(c => (
            <th key={c} style={{
              padding: '3px 6px', background: '#252840',
              textAlign: 'left', borderBottom: '1px solid #3a3d4e',
              whiteSpace: 'nowrap', fontWeight: 600, color: '#8a8fa8',
            }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {cols.map(c => (
              <td key={c} style={{
                padding: '3px 6px', borderBottom: '1px solid #1e2130',
                whiteSpace: 'nowrap', maxWidth: 120,
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{String(row[c] ?? '—')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 4, padding: '10px 16px', background: '#1e2130', borderRadius: 12 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: '#8a8fa8',
            animation: `blink 1.2s infinite ${i * 0.2}s`, display: 'inline-block',
          }} />
        ))}
      </div>
      <style>{`@keyframes blink { 0%,80%,100% { opacity:.3 } 40% { opacity:1 }}`}</style>
    </div>
  )
}
