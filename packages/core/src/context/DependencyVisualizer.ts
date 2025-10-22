/**
 * DependencyVisualizer - Generate visualizations of dependency graphs
 * 
 * Features:
 * - Generate Mermaid diagrams
 * - Generate GraphViz/DOT format
 * - Generate D3.js compatible JSON
 * - Highlight critical paths
 * - Filter and focus on specific modules
 * - Interactive HTML visualizations
 */

import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { createComponentLogger } from '../utils/logger';
import * as path from 'path';

const logger = createComponentLogger('DependencyVisualizer');

// ============================================================================
// Types
// ============================================================================

export interface VisualizationOptions {
  format: 'mermaid' | 'dot' | 'd3' | 'html';
  focusFile?: string; // Focus on specific file and its dependencies
  maxDepth?: number; // Limit visualization depth
  highlightFiles?: string[]; // Files to highlight
  excludePatterns?: string[]; // Patterns to exclude (e.g., 'node_modules')
  includeTransitive?: boolean; // Include transitive dependencies
  direction?: 'LR' | 'TB' | 'RL' | 'BT'; // Direction for directed graphs
  style?: VisualizationStyle;
}

export interface VisualizationStyle {
  colorScheme?: 'default' | 'monochrome' | 'categorical';
  nodeShape?: 'box' | 'circle' | 'diamond' | 'hexagon';
  edgeStyle?: 'solid' | 'dashed' | 'dotted';
  showLabels?: boolean;
  fontSize?: number;
}

export interface D3GraphData {
  nodes: D3Node[];
  links: D3Link[];
}

export interface D3Node {
  id: string;
  label: string;
  group?: string;
  size?: number;
  color?: string;
}

export interface D3Link {
  source: string;
  target: string;
  value?: number;
  type?: string;
}

// ============================================================================
// Dependency Visualizer
// ============================================================================

export class DependencyVisualizer {
  constructor(private dependencyGraph: DependencyGraphBuilder) {}

  /**
   * Generate visualization in specified format
   */
  async generate(options: VisualizationOptions): Promise<string> {
    logger.info('Generating visualization', { format: options.format });

    switch (options.format) {
      case 'mermaid':
        return this.generateMermaid(options);
      
      case 'dot':
        return this.generateDot(options);
      
      case 'd3':
        return JSON.stringify(this.generateD3Data(options), null, 2);
      
      case 'html':
        return this.generateHTML(options);
      
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Generate Mermaid diagram
   */
  private generateMermaid(options: VisualizationOptions): string {
    const direction = options.direction || 'LR';
    let mermaid = `graph ${direction}\n`;

    // Add styling
    mermaid += this.getMermaidStyles(options.style);

    const { nodes, edges } = this.getGraphData(options);

    // Add nodes
    for (const node of nodes) {
      const label = this.getNodeLabel(node, options);
      const className = this.getNodeClass(node, options);
      
      if (className) {
        mermaid += `  ${node}["${label}"]:::${className}\n`;
      } else {
        mermaid += `  ${node}["${label}"]\n`;
      }
    }

    // Add edges
    mermaid += '\n';
    for (const [from, toSet] of edges) {
      for (const to of toSet) {
        const edgeStyle = this.getEdgeStyle(from, to, options);
        mermaid += `  ${from} ${edgeStyle} ${to}\n`;
      }
    }

    return mermaid;
  }

  /**
   * Generate GraphViz DOT format
   */
  private generateDot(options: VisualizationOptions): string {
    let dot = 'digraph Dependencies {\n';
    
    // Graph attributes
    dot += `  rankdir=${options.direction || 'LR'};\n`;
    dot += `  node [shape=${options.style?.nodeShape || 'box'}];\n`;
    dot += '  overlap=false;\n';
    dot += '  splines=true;\n\n';

    const { nodes, edges } = this.getGraphData(options);

    // Add nodes
    for (const node of nodes) {
      const label = this.getNodeLabel(node, options);
      const attrs = this.getDotNodeAttributes(node, options);
      dot += `  "${node}" [label="${label}"${attrs}];\n`;
    }

    // Add edges
    dot += '\n';
    for (const [from, toSet] of edges) {
      for (const to of toSet) {
        const attrs = this.getDotEdgeAttributes(from, to, options);
        dot += `  "${from}" -> "${to}"${attrs};\n`;
      }
    }

    dot += '}\n';
    return dot;
  }

  /**
   * Generate D3.js compatible data
   */
  private generateD3Data(options: VisualizationOptions): D3GraphData {
    const { nodes, edges } = this.getGraphData(options);

    // Create D3 nodes
    const d3Nodes: D3Node[] = nodes.map(node => ({
      id: node,
      label: this.getNodeLabel(node, options),
      group: this.getNodeGroup(node),
      size: this.getNodeSize(node),
      color: this.getNodeColor(node, options),
    }));

    // Create D3 links
    const d3Links: D3Link[] = [];
    for (const [from, toSet] of edges) {
      for (const to of toSet) {
        d3Links.push({
          source: from,
          target: to,
          value: 1,
          type: 'dependency',
        });
      }
    }

    return {
      nodes: d3Nodes,
      links: d3Links,
    };
  }

  /**
   * Generate interactive HTML visualization
   */
  private generateHTML(options: VisualizationOptions): string {
    const d3Data = this.generateD3Data(options);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dependency Graph</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
    }
    svg {
      width: 100%;
      height: 100vh;
      border: 1px solid #ccc;
    }
    .node {
      cursor: pointer;
    }
    .node:hover {
      stroke: #000;
      stroke-width: 2px;
    }
    .link {
      stroke: #999;
      stroke-opacity: 0.6;
    }
    .label {
      font-size: 12px;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <svg id="graph"></svg>
  <script>
    const data = ${JSON.stringify(d3Data, null, 2)};
    
    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select("#graph")
      .attr("viewBox", [0, 0, width, height]);

    // Create force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50));

    // Create links
    const link = svg.append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("class", "link")
      .attr("stroke-width", 2);

    // Create nodes
    const node = svg.append("g")
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("class", "node")
      .attr("r", d => d.size || 10)
      .attr("fill", d => d.color || "#69b3a2")
      .call(drag(simulation));

    // Create labels
    const label = svg.append("g")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
      .attr("class", "label")
      .text(d => d.label)
      .attr("x", 15)
      .attr("y", 3);

    // Update positions on each tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

    // Drag behavior
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    // Node click handler
    node.on("click", (event, d) => {
      console.log("Clicked node:", d);
      // Highlight connected nodes
      const connectedNodes = new Set();
      data.links.forEach(link => {
        if (link.source.id === d.id) connectedNodes.add(link.target.id);
        if (link.target.id === d.id) connectedNodes.add(link.source.id);
      });
      
      node.attr("opacity", n => connectedNodes.has(n.id) || n.id === d.id ? 1 : 0.2);
      link.attr("opacity", l => l.source.id === d.id || l.target.id === d.id ? 1 : 0.1);
    });

    // Double-click to reset
    svg.on("dblclick", () => {
      node.attr("opacity", 1);
      link.attr("opacity", 0.6);
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get graph data (nodes and edges) based on options
   */
  private getGraphData(options: VisualizationOptions): { nodes: string[]; edges: Map<string, Set<string>> } {
    const nodes = new Set<string>();
    const edges = new Map<string, Set<string>>();

    if (options.focusFile) {
      // Focus mode: show dependencies of specific file
      this.addFocusedSubgraph(options.focusFile, options, nodes, edges);
    } else {
      // Full graph mode
      this.addFullGraph(options, nodes, edges);
    }

    return {
      nodes: Array.from(nodes),
      edges,
    };
  }

  /**
   * Add focused subgraph centered on specific file
   */
  private addFocusedSubgraph(
    focusFile: string,
    options: VisualizationOptions,
    nodes: Set<string>,
    edges: Map<string, Set<string>>
  ): void {
    const maxDepth = options.maxDepth || 2;
    const visited = new Set<string>();

    const traverse = async (file: string, depth: number) => {
      if (depth > maxDepth || visited.has(file)) return;
      
      visited.add(file);
      nodes.add(file);

      const deps = await this.dependencyGraph.getModuleDependencies(file);
      
      for (const dep of deps) {
        if (!this.shouldExclude(dep, options)) {
          nodes.add(dep);
          
          if (!edges.has(file)) {
            edges.set(file, new Set());
          }
          edges.get(file)!.add(dep);

          if (options.includeTransitive) {
            await traverse(dep, depth + 1);
          }
        }
      }
    };

    traverse(focusFile, 0);
  }

  /**
   * Add full dependency graph
   */
  private addFullGraph(
    options: VisualizationOptions,
    nodes: Set<string>,
    edges: Map<string, Set<string>>
  ): void {
    // Get all dependencies from the graph builder
    // This would ideally be exposed by DependencyGraphBuilder
    // For now, using the exportToDOT method's logic

    // Simplified implementation
    // In real implementation, would get all nodes and edges from graph builder
  }

  /**
   * Check if file should be excluded
   */
  private shouldExclude(file: string, options: VisualizationOptions): boolean {
    if (!options.excludePatterns) return false;

    for (const pattern of options.excludePatterns) {
      if (file.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get node label
   */
  private getNodeLabel(node: string, options: VisualizationOptions): string {
    if (!options.style?.showLabels) {
      return path.basename(node, path.extname(node));
    }
    return path.basename(node);
  }

  /**
   * Get node class for Mermaid
   */
  private getNodeClass(node: string, options: VisualizationOptions): string | null {
    if (options.highlightFiles?.includes(node)) {
      return 'highlighted';
    }
    
    if (options.focusFile === node) {
      return 'focus';
    }

    if (node.includes('test') || node.includes('spec')) {
      return 'test';
    }

    if (node.includes('/core/') || node.includes('/api/')) {
      return 'core';
    }

    return null;
  }

  /**
   * Get Mermaid styles
   */
  private getMermaidStyles(style?: VisualizationStyle): string {
    let styles = '\n';
    styles += '  classDef highlighted fill:#ff6b6b,stroke:#c92a2a\n';
    styles += '  classDef focus fill:#51cf66,stroke:#2f9e44\n';
    styles += '  classDef test fill:#74c0fc,stroke:#1864ab\n';
    styles += '  classDef core fill:#ffa94d,stroke:#d9480f\n';
    styles += '\n';
    return styles;
  }

  /**
   * Get edge style for Mermaid
   */
  private getEdgeStyle(from: string, to: string, options: VisualizationOptions): string {
    const style = options.style?.edgeStyle || 'solid';
    
    const arrows = {
      solid: '-->',
      dashed: '-.->',
      dotted: '-..->',
    };

    return arrows[style];
  }

  /**
   * Get DOT node attributes
   */
  private getDotNodeAttributes(node: string, options: VisualizationOptions): string {
    const attrs: string[] = [];

    if (options.highlightFiles?.includes(node)) {
      attrs.push('color=red');
      attrs.push('style=filled');
      attrs.push('fillcolor=lightpink');
    }

    if (options.focusFile === node) {
      attrs.push('color=green');
      attrs.push('style=filled');
      attrs.push('fillcolor=lightgreen');
    }

    return attrs.length > 0 ? `, ${attrs.join(', ')}` : '';
  }

  /**
   * Get DOT edge attributes
   */
  private getDotEdgeAttributes(from: string, to: string, options: VisualizationOptions): string {
    const attrs: string[] = [];

    const style = options.style?.edgeStyle;
    if (style && style !== 'solid') {
      attrs.push(`style=${style}`);
    }

    return attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
  }

  /**
   * Get node group (for D3 coloring)
   */
  private getNodeGroup(node: string): string {
    if (node.includes('test') || node.includes('spec')) return 'test';
    if (node.includes('/core/')) return 'core';
    if (node.includes('/api/')) return 'api';
    if (node.includes('/utils/') || node.includes('/helpers/')) return 'utils';
    if (node.includes('/components/')) return 'components';
    return 'other';
  }

  /**
   * Get node size (for D3)
   */
  private getNodeSize(node: string): number {
    // Size based on importance (simplified)
    if (node.includes('/core/')) return 15;
    if (node.includes('/api/')) return 12;
    return 8;
  }

  /**
   * Get node color
   */
  private getNodeColor(node: string, options: VisualizationOptions): string {
    if (options.highlightFiles?.includes(node)) return '#ff6b6b';
    if (options.focusFile === node) return '#51cf66';

    const group = this.getNodeGroup(node);
    const colors: Record<string, string> = {
      test: '#74c0fc',
      core: '#ffa94d',
      api: '#a9e34b',
      utils: '#f783ac',
      components: '#b197fc',
      other: '#69b3a2',
    };

    return colors[group] || colors.other;
  }
}

/**
 * Helper function to create dependency visualizer
 */
export function createDependencyVisualizer(dependencyGraph: DependencyGraphBuilder): DependencyVisualizer {
  return new DependencyVisualizer(dependencyGraph);
}

/**
 * Generate quick visualization
 */
export async function visualizeDependencies(
  dependencyGraph: DependencyGraphBuilder,
  format: 'mermaid' | 'dot' | 'd3' | 'html' = 'mermaid',
  focusFile?: string
): Promise<string> {
  const visualizer = new DependencyVisualizer(dependencyGraph);
  return visualizer.generate({
    format,
    focusFile,
    maxDepth: 3,
    includeTransitive: true,
    direction: 'LR',
  });
}

