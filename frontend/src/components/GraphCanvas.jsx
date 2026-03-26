import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { X, Network, Minimize2, Layers, Search } from 'lucide-react';

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
  const [expandedNode, setExpandedNode] = useState(null); // Track node isolated for expansion
  const [showGranularOverlay, setShowGranularOverlay] = useState(true); // Toggle text labels
  const [hiddenTypes, setHiddenTypes] = useState(new Set()); // Track toggled legend types
  const [searchQuery, setSearchQuery] = useState(''); // Text filter
  const [dimensions, setDimensions] = useState({ width: window.innerWidth - CHAT_WIDTH, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth - CHAT_WIDTH, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (graphData.nodes.length > 0 && fgRef.current && !expandedNode) {
      setTimeout(() => fgRef.current.zoomToFit(400, 60), 500);
    }
  }, [graphData, expandedNode]);

  const expandedSet = useMemo(() => {
    if (!expandedNode) return null;
    
    const neighborIds = new Set();
    neighborIds.add(expandedNode.id);
    
    graphData.links.forEach(l => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      if (srcId === expandedNode.id || tgtId === expandedNode.id) {
        neighborIds.add(srcId);
        neighborIds.add(tgtId);
      }
    });

    return neighborIds;
  }, [graphData.links, expandedNode]);

  const handleMinimize = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 60);
    }
  }, []);

  const toggleTypeVisibility = useCallback(type => {
    setHiddenTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback(node => {
    setSelectedNode(node);
    if (fgRef.current && !expandedNode) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(3, 1000);
    }
  }, [expandedNode]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const toggleExpand = useCallback(() => {
    if (expandedNode && selectedNode && expandedNode.id === selectedNode.id) {
      setExpandedNode(null); // Reset
    } else {
      setExpandedNode(selectedNode); // Expand this node
    }
  }, [expandedNode, selectedNode]);

  const searchMatchSet = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    const query = searchQuery.toLowerCase();
    const primaryMatches = new Set();
    
    graphData.nodes.forEach(node => {
      const lbl = String(node.label || node.id).toLowerCase();
      const typ = String(node.type).toLowerCase();
      if (lbl.includes(query) || typ.includes(query)) {
        primaryMatches.add(node.id);
      }
    });

    const expandedMatches = new Set(primaryMatches);
    graphData.links.forEach(l => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      if (primaryMatches.has(srcId)) expandedMatches.add(tgtId);
      if (primaryMatches.has(tgtId)) expandedMatches.add(srcId);
    });

    return expandedMatches;
  }, [graphData, searchQuery]);

  const isNodeVisible = useCallback((node) => {
    if (!node) return false;
    if (hiddenTypes.has(node.type)) return false;
    if (expandedSet && !expandedSet.has(node.id)) return false;
    if (searchMatchSet && !searchMatchSet.has(node.id)) return false;
    return true;
  }, [hiddenTypes, expandedSet, searchMatchSet]);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    if (!isNodeVisible(node)) return;

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
    if (showGranularOverlay && globalScale > 1.0) {
      const label = node.label || node.id;
      const fontSize = Math.max(11 / globalScale, 3);
      ctx.font = `500 ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSelected ? '#1a1a2e' : '#6b7280';
      ctx.fillText(label, node.x, node.y + size + 3);
    }
  }, [selectedNode, expandedSet, showGranularOverlay]);

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
    <div className="graph-pane" style={{ position: 'relative' }}>
      <div className="graph-header">
        <h1><Network size={18} /> <span>Mapping</span> / Order to Cash</h1>
      </div>

      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 10 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', color: '#9ca3af' }} />
          <input 
            type="text" 
            placeholder="Search nodes..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '8px 12px 8px 30px', background: '#fff', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', width: '220px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          />
        </div>
        <button 
          onClick={handleMinimize}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#fff', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <Minimize2 size={14} /> Minimize
        </button>
        <button 
          onClick={() => setShowGranularOverlay(!showGranularOverlay)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#111827', color: '#fff', border: '1px solid #111827', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
        >
          <Layers size={14} /> {showGranularOverlay ? 'Hide Labels' : 'Show Labels'}
        </button>
      </div>

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        nodeLabel={node => !isNodeVisible(node) ? '' : `${node.type}: ${node.label || node.id}`}
        nodeVisibility={isNodeVisible}
        linkVisibility={link => {
          const srcNode = typeof link.source === 'object' ? link.source : null;
          const tgtNode = typeof link.target === 'object' ? link.target : null;
          if (srcNode && !isNodeVisible(srcNode)) return false;
          if (tgtNode && !isNodeVisible(tgtNode)) return false;

          if (!expandedSet) return true;
          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
          const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
          return srcId === expandedNode.id || tgtId === expandedNode.id;
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          if (!isNodeVisible(node)) return; // Ignore hover/clicks on hidden nodes
          ctx.beginPath();
          ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={link => {
          if (expandedSet) return 'rgba(74, 144, 217, 0.9)'; // Highlight the active connection line
          return 'rgba(168, 196, 224, 0.5)';
        }}
        linkWidth={link => {
          if (expandedSet) return 2.5; // Thicker lines when expanded
          return 1.2;
        }}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={link => {
          if (expandedSet) return 'rgba(74, 144, 217, 0.9)';
          return 'rgba(74, 144, 217, 0.4)';
        }}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        enableNodeDrag={true}
        d3VelocityDecay={0.4}
        cooldownTicks={200}
        warmupTicks={100}
        backgroundColor="#f7f9fc"
      />

      <div className="graph-legend" style={{ zIndex: 10, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {legendItems.map(({ type, color, count }) => (
          <div 
            className="legend-item" 
            key={type}
            onClick={() => toggleTypeVisibility(type)}
            style={{ 
              cursor: 'pointer',
              opacity: hiddenTypes.has(type) ? 0.4 : 1,
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              background: '#fff',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <div className="legend-dot" style={{ backgroundColor: color, width: '10px', height: '10px', borderRadius: '50%', marginRight: '6px' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>{type}</span>
            <span style={{ color: '#9ca3af', fontSize: '0.65rem', marginLeft: '4px' }}>({count})</span>
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
          <div className="connections-badge" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <span>🔗 {nodeConnections} connection{nodeConnections !== 1 ? 's' : ''}</span>
            <button 
              onClick={toggleExpand}
              style={{ padding: '6px 12px', background: '#4a90d9', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
            >
              {expandedNode && expandedNode.id === selectedNode.id ? 'Show Full Graph' : 'Expand Node'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
