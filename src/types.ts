// ---------------------------------------------------------------------------
// Core domain types. This is the single typed, JSON-serializable model that
// the canvas, the code editor, and the AI demo all read from and write to.
// ---------------------------------------------------------------------------

export type ElementType = 'heading' | 'text' | 'button' | 'image' | 'container';

export type ViewportName = 'desktop' | 'tablet' | 'mobile';

/** 'all' means "edit the base (shared) value". A single viewport name means
 * "edit only that viewport's override, leave base and other viewports untouched". */
export type ViewportScope = 'all' | ViewportName;

export interface StyleProps {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: string;
  borderRadius?: string;
}

export interface SizeProps {
  width?: string;
  height?: string;
}

/** Every field a manual edit, a code edit, or an AI proposal is allowed to
 * touch. Field-level allow-lists per element type live in lib/validation.ts. */
export interface PropertyValues {
  content?: string;
  src?: string;
  alt?: string;
  style?: StyleProps;
  size?: SizeProps;
  order?: number;
  visible?: boolean;
}

export interface TemplateElement {
  id: string;
  type: ElementType;
  parentId: string | null;
  /** Shared across all viewports unless a viewport override below wins. */
  base: PropertyValues;
  overrides: Partial<Record<ViewportName, PropertyValues>>;
}

export interface Template {
  id: string;
  name: string;
  sourceNote: string;
  /** Monotonically increasing. Every committed edit bumps this by 1. Used as
   * the optimistic-concurrency token ("base revision") for every command. */
  version: number;
  elements: Record<string, TemplateElement>;
  /** Top-level element ids, in render order. */
  rootOrder: string[];
}

export type EditSource = 'canvas' | 'code' | 'ai' | 'restore';

/** A single, atomic request to change one or more elements. Canvas, code, and
 * the AI demo all funnel through the same command shape and the same
 * validation/commit pipeline (see lib/commit.ts). */
export interface EditCommand {
  source: EditSource;
  targetIds: string[];
  viewportScope: ViewportScope;
  /** The template.version this command was computed against. If the template
   * has moved on since, the command is stale and is rejected. */
  baseRevision: number;
  /** Per-element partial property changes. */
  changes: Record<string, Partial<PropertyValues>>;
  description: string;
}

export type CommitElementStatus = 'applied' | 'rejected';

export interface CommitElementResult {
  elementId: string;
  status: CommitElementStatus;
  reason?: string;
}

export interface CommitResult {
  ok: boolean;
  /** Present when the whole command was rejected before touching state
   * (unknown targets, stale revision, empty command). */
  fatalReason?: string;
  template: Template;
  perElement: CommitElementResult[];
  historyEntries: HistoryEntry[];
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  elementId: string;
  viewportScope: ViewportScope;
  source: EditSource;
  description: string;
  baseRevision: number;
  resultingRevision: number;
  /** The full PropertyValues bag for that scope (base, or the relevant
   * viewport override) before and after this entry, so a restore can put it
   * back exactly. */
  before: PropertyValues;
  after: PropertyValues;
}

export type HistoryLog = Record<string, HistoryEntry[]>; // elementId -> entries, newest last

// ---------------------------------------------------------------------------
// AI demo types
// ---------------------------------------------------------------------------

export interface AIProposal {
  elementId: string;
  changes: Partial<PropertyValues>;
  explanation: string;
}

export interface AIResult {
  ok: boolean;
  /** Human-readable reason when ok is false (safe failure). */
  error?: string;
  matchedScenario?: string;
  proposals: AIProposal[];
}
