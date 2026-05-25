import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { HierarchyNode } from "../services/api";

type TreeType = "ROOT" | "IDN" | "HCO" | "CLINIC";

interface TreeNodeDatum {
  id: string;
  name: string;
  type: TreeType;
  nodeData?: HierarchyNode;
  children?: TreeNodeDatum[];
}

interface PositionedNode {
  id: string;
  x: number;
  y: number;
  depth: number;
  data: TreeNodeDatum;
}

interface LinkPath {
  source: { x: number; y: number };
  target: { x: number; y: number };
  id: string;
}

interface Props {
  nodes: HierarchyNode[];
  selectedCustomerId?: string | null;
  highlightIdn?: string | null;
  onSelectClinic: (node: HierarchyNode) => void;
  onSelectIdn: (idnId: string) => void;
}

function getOrderCount(customerId?: string | null): number {
  if (!customerId) return 0;
  const map: Record<string, number> = {
    "CUST-1001": 1,
    "CUST-1002": 1,
    "CUST-1003": 2,
    "CUST-1004": 1,
    "CUST-1005": 2,
    "CUST-1006": 1,
    "CUST-1007": 1,
    "CUST-1008": 0,
    "CUST-1010": 1,
    "CUST-1011": 1,
    "CUST-1012": 1,
    "CUST-1015": 1,
    "CUST-1026": 2,
    "CUST-1027": 4,
    "CUST-1028": 3,
  };
  return map[customerId] ?? 0;
}

function nodeColor(data: TreeNodeDatum): { fill: string; stroke: string } {
  if (data.type === "ROOT") return { fill: "#1f2937", stroke: "#111827" };
  if (data.type === "IDN") return { fill: "#6366f1", stroke: "#4338ca" };
  if (data.type === "HCO") return { fill: "#a78bfa", stroke: "#7c3aed" };

  const status = data.nodeData?.hierarchy_status;
  const customerId = data.nodeData?.linked_customer_id;
  if (customerId === "CUST-1026") return { fill: "#fb7185", stroke: "#e11d48" };
  if (status === "CONFLICT") return { fill: "#fbbf24", stroke: "#d97706" };
  if (status === "PENDING") return { fill: "#cbd5e1", stroke: "#94a3b8" };
  return { fill: "#34d399", stroke: "#059669" };
}

export default function HierarchyTree({
  nodes,
  selectedCustomerId,
  highlightIdn,
  onSelectClinic,
  onSelectIdn,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [width, setWidth] = useState(900);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity.translate(80, 300));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const treeSource = useMemo<TreeNodeDatum>(() => {
    const idnNodes = nodes.filter((n) => n.node_type === "IDN");
    const hcoNodes = nodes.filter((n) => n.node_type === "HCO");
    const clinicNodes = nodes.filter((n) => n.node_type === "CLINIC");

    return {
      id: "root",
      name: "BV LLC",
      type: "ROOT",
      children: idnNodes.map((idn) => ({
        id: idn.idn_id ?? idn.node_id,
        name: idn.node_name,
        type: "IDN",
        nodeData: idn,
        children: hcoNodes
          .filter((hco) => hco.parent_id === idn.node_id)
          .map((hco) => ({
            id: hco.hco_id ?? hco.node_id,
            name: hco.node_name,
            type: "HCO",
            nodeData: hco,
            children: clinicNodes
              .filter((clinic) => clinic.parent_id === hco.node_id)
              .map((clinic) => ({
                id: clinic.node_id,
                name: clinic.node_name,
                type: "CLINIC",
                nodeData: clinic,
              })),
          })),
      })),
    };
  }, [nodes]);

  const visibleTree = useMemo<TreeNodeDatum>(() => {
    const trim = (node: TreeNodeDatum): TreeNodeDatum => {
      if (!node.children?.length) return node;
      if (collapsed.has(node.id)) return { ...node, children: [] };
      return { ...node, children: node.children.map(trim) };
    };
    return trim(treeSource);
  }, [collapsed, treeSource]);

  const { positionedNodes, links } = useMemo(() => {
    const root = d3.hierarchy<TreeNodeDatum>(visibleTree);
    const layout = d3.tree<TreeNodeDatum>().nodeSize([50, 280]);
    layout(root);

    const pNodes: PositionedNode[] = root.descendants().map((d) => ({
      id: d.data.id,
      x: d.x ?? 0,
      y: d.y ?? 0,
      depth: d.depth,
      data: d.data,
    }));
    const pLinks: LinkPath[] = root.links().map((l) => ({
        source: { x: l.source.x ?? 0, y: l.source.y ?? 0 },
        target: { x: l.target.x ?? 0, y: l.target.y ?? 0 },
      id: `${l.source.data.id}-${l.target.data.id}`,
    }));
    return { positionedNodes: pNodes, links: pLinks };
  }, [visibleTree]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.max(900, Math.floor(entries[0].contentRect.width));
      setWidth(nextWidth);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });
    zoomRef.current = zoom;
    d3.select(svgRef.current).call(zoom).call(zoom.transform, d3.zoomIdentity.translate(80, 300));
  }, []);

  useEffect(() => {
    if (!highlightIdn) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(highlightIdn);
      return next;
    });
  }, [highlightIdn]);

  const linkPath = (link: LinkPath) => {
    const midY = (link.source.y + link.target.y) / 2;
    return `M${link.source.y},${link.source.x}C${midY},${link.source.x} ${midY},${link.target.x} ${link.target.y},${link.target.x}`;
  };

  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (!svgRef.current || !zoomRef.current) return;
            d3.select(svgRef.current)
              .transition()
              .duration(300)
              .call(zoomRef.current.transform, d3.zoomIdentity.translate(80, 300));
          }}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
        >
          Reset View
        </button>
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={600}
        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
      >
        <g ref={gRef} transform={transform.toString()}>
          {links.map((link) => (
            <path
              key={link.id}
              d={linkPath(link)}
              fill="none"
              stroke={isDark ? "#475569" : "#cbd5e1"}
              strokeWidth={1.5}
            />
          ))}

          {positionedNodes.map((node) => {
            const { fill, stroke } = nodeColor(node.data);
            const r = node.data.type === "IDN" ? 20 : node.data.type === "HCO" ? 14 : node.data.type === "CLINIC" ? 10 : 16;
            const isHighlighted = highlightIdn && (node.data.id === highlightIdn || node.data.nodeData?.idn_id === highlightIdn);
            const isSelectedClinic = selectedCustomerId && node.data.nodeData?.linked_customer_id === selectedCustomerId;
            const overlay =
              node.data.nodeData?.linked_customer_id === "CUST-1026"
                ? "🔴"
                : node.data.nodeData?.hierarchy_status === "CONFLICT"
                  ? "⚠"
                  : "";
            const orderCount = getOrderCount(node.data.nodeData?.linked_customer_id);
            return (
              <g
                key={node.id}
                transform={`translate(${node.y},${node.x})`}
                style={{ cursor: node.data.type === "CLINIC" || node.data.type === "IDN" || node.data.type === "HCO" ? "pointer" : "default" }}
                onClick={() => {
                  if (node.data.type === "CLINIC" && node.data.nodeData) {
                    onSelectClinic(node.data.nodeData);
                    return;
                  }
                  if (node.data.type === "IDN") {
                    onSelectIdn(node.data.id);
                  }
                  if (node.data.type === "IDN" || node.data.type === "HCO") {
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(node.data.id)) next.delete(node.data.id);
                      else next.add(node.data.id);
                      return next;
                    });
                  }
                }}
              >
                <circle
                  r={r}
                  fill={fill}
                  stroke={isHighlighted || isSelectedClinic ? "#f8fafc" : stroke}
                  strokeWidth={isHighlighted || isSelectedClinic ? 3 : 2}
                />
                {overlay && (
                  <text x={r - 2} y={-r + 2} fontSize={11}>
                    {overlay}
                  </text>
                )}
                <text
                  y={r + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fill={isDark ? "#f1f5f9" : "#0f172a"}
                  style={{ pointerEvents: "none" }}
                >
                  {node.data.name}
                </text>
                {node.data.type === "CLINIC" && (
                  <text
                    y={r + 27}
                    textAnchor="middle"
                    fontSize={10}
                    fill={isDark ? "#94a3b8" : "#64748b"}
                    style={{ pointerEvents: "none" }}
                  >
                    {orderCount} orders
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
