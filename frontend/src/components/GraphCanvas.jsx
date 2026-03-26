import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { X, Network } from 'lucide-react';

const CHAT_WIDTH = 380;

const TYPE_COLORS = {
  Customer:       "#4a90d9",
  SalesOrder:     "#5ba3e6",
  SalesOrderItem: "#7bb8f0",
  Delivery:       "#6aabde",
  Invoice:        "#e06060",
  JournalEntry:   "#d94f4f",
  Payment:        "#4a90d9",
  Product:        "#e88e8e",
};

export default function GraphCanvas({ graphData }) {
  const fgRef = useRef();
  const [selectedNode, setSelectedNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth - CHAT_WIDTH, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth - CHAT_WIDTH, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (graphData.nodes.length > 0 && fgRef.current) {
      setTimeout(() => fgRef.current.zoomToFit(400, 60), 500);
    }
  }, [graphData]);

  const handleNodeClick = useCallback(node => {
    setSelectedNode(node);
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(3, 1000);
    }
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const isSelected = selectedNode && node.id === selectedNode.id;
    const color = TYPE_COLORS[node.type] || '#94a3b8';
    const size = isSelected ? 14 : 8;
    
    // Glow for selected
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 10, 0, 2 * Math.PI);
      ctx.fillStyle = color + '20';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 5, 0, 2 * Math.PI);
      ctx.fillStyle = color + '35';
      ctx.fill();
    }

    // Node dot with white border
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label at zoom
    if (globalScale > 1.0) {
      const label = node.label || node.id;
      const fontSize = Math.max(11 / globalScale, 3);
      ctx.font = `500 ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSelected ? '#1a1a2e' : '#6b7280';
      ctx.fillText(label, node.x, node.y + size + 3);
    }
  }, [selectedNode]);

  const nodeConnections = useMemo(() => {
    if (!selectedNode) return 0;
    return graphData.links.filter(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
      return src === selectedNode.id || tgt === selectedNode.id;
    }).length;
  }, [selectedNode, graphData.links]);

  const excludedKeys = new Set(['id', 'x', 'y', 'vx', 'vy', 'fx', 'fy', 'index', 'type', 'label', '__indexColor']);

  const legendItems = useMemo(() => {
    const counts = {};
    graphData.nodes.forEach(n => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return Object.entries(TYPE_COLORS)
      .filter(([t]) => counts[t] > 0)
      .map(([t, color]) => ({ type: t, color, count: counts[t] }));
  }, [graphData.nodes]);

  return (
    <div className="graph-pane">
      <div className="graph-header">
        <h1><Network size={18} /> <span>Mapping</span> / Order to Cash</h1>
      </div>

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        nodeLabel={node => `${node.type}: ${node.label || node.id}`}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={() => 'rgba(168, 196, 224, 0.5)'}
        linkWidth={1.2}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={() => 'rgba(74, 144, 217, 0.4)'}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        enableNodeDrag={true}
        d3VelocityDecay={0.4}
        cooldownTicks={200}
        warmupTicks={100}
        backgroundColor="#f7f9fc"
      />

      <div className="graph-legend">
        {legendItems.map(({ type, color, count }) => (
          <div className="legend-item" key={type}>
            <div className="legend-dot" style={{ backgroundColor: color }} />
            {type} <span style={{ color: '#9ca3af', fontSize: '0.65rem', marginLeft: '2px' }}>({count})</span>
          </div>
        ))}
      </div>
      
      {selectedNode && (
        <div className="node-modal">
          <div className="modal-header">
            <h3>{selectedNode.type}</h3>
            <button className="close-btn" onClick={() => setSelectedNode(null)}><X size={14} /></button>
          </div>
          <div className="node-type-badge" style={{ backgroundColor: TYPE_COLORS[selectedNode.type] || '#94a3b8' }}>
            {selectedNode.label}
          </div>
          <div className="node-props">
            <div className="node-prop">
              <div className="prop-key">Entity</div>
              <div className="prop-val">{selectedNode.type}</div>
            </div>
            {Object.entries(selectedNode)
              .filter(([key]) => !excludedKeys.has(key))
              .map(([key, val]) => {
                const displayVal = val === null || val === undefined || val === ''
                  ? '—'
                  : typeof val === 'object'
                  ? JSON.stringify(val)
                  : String(val);
                return (
                  <div className="node-prop" key={key}>
                    <div className="prop-key">{key}</div>
                    <div className="prop-val">{displayVal}</div>
                  </div>
                );
              })}
          </div>
          <div className="connections-badge">
            🔗 {nodeConnections} connection{nodeConnections !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
