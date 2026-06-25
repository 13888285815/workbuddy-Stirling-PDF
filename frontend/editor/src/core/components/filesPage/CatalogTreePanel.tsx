/**
 * CatalogTreePanel - Displays PDF tools and documents from catalog.json
 * Integrated into the file manager sidebar as a collapsible section
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SearchIcon from "@mui/icons-material/Search";
import BuildIcon from "@mui/icons-material/Build";
import DescriptionIcon from "@mui/icons-material/Description";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import CompressIcon from "@mui/icons-material/Compress";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import WatermarkIcon from "@mui/icons-material/WaterDrop";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from "@mui/icons-material/FilterList";
import SortByAlphaIcon from "@mui/icons-material/SortByAlpha";

import "@app/components/filesPage/CatalogTreePanel.css";

/** Catalog item types */
interface CatalogLeaf {
  title: string;
  id?: string;
  type: "tool" | "document" | "pdf";
  endpoint?: string;
  pdf?: string;
  size?: string;
  input_types?: string[];
  output_type?: string;
  description?: string;
}

interface CatalogNode {
  label: string;
  children?: CatalogLeaf[];
}

interface CatalogCategory {
  label: string;
  children?: CatalogNode[];
}

/** Get icon component for a tool based on its id */
function getToolIcon(toolId: string): React.ReactElement {
  const id = toolId.toLowerCase();
  if (id.includes("merge") || id.includes("combine")) return <MergeTypeIcon />;
  if (id.includes("split")) return <CallSplitIcon />;
  if (id.includes("compress") || id.includes("optimize")) return <CompressIcon />;
  if (id.includes("ocr") || id.includes("text") || id.includes("extract")) return <TextFieldsIcon />;
  if (id.includes("password") || id.includes("encrypt") || id.includes("lock")) return <LockIcon />;
  if (id.includes("unlock") || id.includes("decrypt")) return <LockOpenIcon />;
  if (id.includes("watermark") || id.includes("stamp") || id.includes("sign")) return <WatermarkIcon />;
  if (id.includes("rotate")) return <RotateRightIcon />;
  if (id.includes("delete") || id.includes("remove") || id.includes("remove-blanks")) return <DeleteOutlineIcon />;
  if (id.includes("pdf-to-img") || id.includes("extract-images") || id.includes("image")) return <PictureAsPdfIcon />;
  if (id.includes("view") || id.includes("preview") || id.includes("read") || id.includes("document")) return <VisibilityIcon />;
  if (id.includes("print")) return <PrintIcon />;
  if (id.includes("filter")) return <FilterListIcon />;
  if (id.includes("sort") || id.includes("reorder") || id.includes("page")) return <SortByAlphaIcon />;
  return <BuildIcon />;
}

interface TreeNodeProps {
  label: string;
  level: number;
  defaultExpanded?: boolean;
  icon?: React.ReactElement;
  children?: React.ReactNode;
}

function TreeNodeRow({ label, level, defaultExpanded = false, icon, children }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = Boolean(children);

  return (
    <div className="catalog-tree-node-container">
      <button
        className="catalog-tree-node"
        onClick={() => hasChildren && setExpanded(!expanded)}
        style={{ paddingLeft: `${12 + level * 16}px` }}
        aria-expanded={hasChildren ? expanded : undefined}
      >
        {hasChildren ? (
          <span className="catalog-tree-toggle">
            {expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
          </span>
        ) : (
          <span className="catalog-tree-spacer" />
        )}
        {icon && <span className="catalog-tree-icon">{icon}</span>}
        <span className="catalog-tree-label">{label}</span>
      </button>
      {hasChildren && expanded && (
        <div className="catalog-tree-children">
          {children}
        </div>
      )}
    </div>
  );
}

interface ToolNodeProps {
  tool: CatalogLeaf;
  onToolClick: (tool: CatalogLeaf) => void;
}

function ToolNode({ tool, onToolClick }: ToolNodeProps) {
  return (
    <button
      className="catalog-tool-node"
      onClick={() => onToolClick(tool)}
      title={tool.description || tool.title}
    >
      <span className="catalog-tool-icon">
        {tool.type === "document" || tool.type === "pdf" ? (
          <DescriptionIcon />
        ) : (
          getToolIcon(tool.id || tool.title)
        )}
      </span>
      <span className="catalog-tool-label">{tool.title}</span>
      {tool.size && <span className="catalog-tool-size">{tool.size}</span>}
    </button>
  );
}

interface CatalogTreePanelProps {
  onToolSelect?: (tool: CatalogLeaf) => void;
  onDocumentSelect?: (pdf: string, title: string) => void;
}

export function CatalogTreePanel({ onToolSelect, onDocumentSelect }: CatalogTreePanelProps) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["📖 文档阅读"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Load catalog.json
  useEffect(() => {
    fetch("/catalog.json")
      .then((res) => res.json())
      .then((data) => {
        setCatalog(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Filter tools based on search
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalog;
    const query = searchQuery.toLowerCase();

    const filterNode = (node: CatalogNode): CatalogNode | null => {
      if (node.children) {
        const filteredChildren = node.children
          .map((child) => {
            if ("children" in child && child.children) {
              return filterNode(child as CatalogNode);
            }
            const leaf = child as CatalogLeaf;
            if (leaf.title.toLowerCase().includes(query)) {
              return leaf;
            }
            return null;
          })
          .filter(Boolean) as (CatalogLeaf | CatalogNode)[];

        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
      }
      if ("title" in node && (node as CatalogLeaf).title.toLowerCase().includes(query)) {
        return node;
      }
      if (node.label.toLowerCase().includes(query)) {
        return node;
      }
      return null;
    };

    return catalog
      .map((category) => ({
        ...category,
        children: category.children
          ?.map((child) => filterNode(child))
          .filter(Boolean) as CatalogNode[],
      }))
      .filter((category) => category.children && category.children.length > 0);
  }, [catalog, searchQuery]);

  const toggleCategory = useCallback((label: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const handleToolClick = useCallback((tool: CatalogLeaf) => {
    if (tool.type === "document" || tool.type === "pdf") {
      onDocumentSelect?.(tool.pdf || "", tool.title);
    } else {
      onToolSelect?.(tool);
    }
  }, [onToolSelect, onDocumentSelect]);

  const renderNode = (node: CatalogNode, level: number): React.ReactNode => {
    if (node.children) {
      return (
        <TreeNodeRow
          key={node.label}
          label={node.label}
          level={level}
          defaultExpanded={level === 0}
        >
          {node.children.map((child) => renderNode(child, level + 1))}
        </TreeNodeRow>
      );
    }

    const leaf = node as unknown as CatalogLeaf;
    if (leaf.type) {
      return (
        <ToolNode
          key={leaf.title}
          tool={leaf}
          onToolClick={handleToolClick}
        />
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="catalog-tree-panel">
        <div className="catalog-tree-loading">Loading tools...</div>
      </div>
    );
  }

  return (
    <div className="catalog-tree-panel">
      {/* Header */}
      <div className="catalog-tree-header">
        <span className="catalog-tree-title">📚 PDF 工具</span>
        <button
          className={`catalog-search-toggle ${searchOpen ? "active" : ""}`}
          onClick={() => setSearchOpen(!searchOpen)}
          aria-label="Search tools"
        >
          {searchOpen ? <CloseIcon /> : <SearchIcon />}
        </button>
      </div>

      {/* Search */}
      {searchOpen && (
        <div className="catalog-search-container">
          <SearchIcon className="catalog-search-icon" />
          <input
            type="text"
            className="catalog-search-input"
            placeholder="搜索工具..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              className="catalog-search-clear"
              onClick={() => setSearchQuery("")}
            >
              <CloseIcon sx={{ fontSize: "0.875rem" }} />
            </button>
          )}
        </div>
      )}

      {/* Tool tree */}
      <div className="catalog-tree-content">
        {filteredCatalog.map((category) => (
          <div key={category.label} className="catalog-category">
            <button
              className={`catalog-category-header ${expandedCategories.has(category.label) ? "expanded" : ""}`}
              onClick={() => toggleCategory(category.label)}
            >
              <span className="catalog-category-toggle">
                {expandedCategories.has(category.label) ? (
                  <KeyboardArrowDownIcon />
                ) : (
                  <KeyboardArrowRightIcon />
                )}
              </span>
              <span className="catalog-category-icon">
                {category.label.includes("文档") ? (
                  <DescriptionIcon />
                ) : (
                  <BuildIcon />
                )}
              </span>
              <span className="catalog-category-label">{category.label}</span>
              <span className="catalog-category-count">
                {category.children?.length || 0}
              </span>
            </button>

            {expandedCategories.has(category.label) && category.children && (
              <div className="catalog-category-content">
                {category.children.map((node) => renderNode(node, 1))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
