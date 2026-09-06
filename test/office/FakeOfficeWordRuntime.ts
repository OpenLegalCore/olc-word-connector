import type { OfficeWordRuntime } from "../../src/office/OfficeWordAdapter";

export type FakeOfficeCommandName =
  "load" | "getOoxml" | "compareLocationWith" | "track" | "insertText" | "select" | "untrack";

export interface FakeSelectionOptions {
  readonly text: string;
  readonly locationId?: string;
  readonly bodyType?: string;
  readonly hasParentTable?: boolean;
  readonly hasParentTableCell?: boolean;
  readonly containedTableCount?: number;
  readonly inlinePictureCount?: number;
  readonly isEmpty?: boolean;
  readonly ooxml?: string;
  readonly cellMarker?: string;
}

export interface InsertCall {
  readonly locationId: string;
  readonly text: string;
  readonly insertLocation: string;
}

export interface GetRangeCall {
  readonly source: FakeOfficeRange;
  readonly clone: FakeOfficeRange;
  readonly rangeLocation: string;
}

export interface PausedCommand {
  readonly started: Promise<void>;
  readonly release: () => void;
}

interface QueuedCommand {
  readonly name: FakeOfficeCommandName;
  readonly execute: () => void;
}

interface CommandPause {
  readonly name: FakeOfficeCommandName;
  readonly markStarted: () => void;
  readonly released: Promise<void>;
}

interface FakeRangeState {
  readonly locationId: string;
  readonly bodyType: string;
  readonly hasParentTable: boolean;
  readonly hasParentTableCell: boolean;
  readonly containedTableCount: number;
  readonly inlinePictureCount: number;
  readonly isEmpty: boolean;
  readonly cellMarker: string;
  text: string;
  ooxml: string;
}

const PLAIN_TEXT_OOXML =
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  "<w:body><w:p><w:r><w:t>selection</w:t></w:r></w:p></w:body></w:document>";

class FakeLoadable {
  constructor(
    protected readonly runtime: FakeOfficeWordRuntime,
    private readonly loadLabel: string,
    private readonly assertLoadable: () => void = () => undefined
  ) {}

  load(): this {
    this.assertLoadable();
    this.runtime.queue("load", () => {
      this.runtime.commandLog.push(`loaded:${this.loadLabel}`);
    });
    return this;
  }
}

class FakeNullableObject extends FakeLoadable {
  constructor(
    runtime: FakeOfficeWordRuntime,
    loadLabel: string,
    readonly isNullObject: boolean,
    runId: number
  ) {
    super(runtime, loadLabel, () => runtime.assertDerivedChildRun(runId));
  }
}

class FakeCollection extends FakeLoadable {
  readonly items: object[];

  constructor(runtime: FakeOfficeWordRuntime, loadLabel: string, count: number, runId: number) {
    super(runtime, loadLabel, () => runtime.assertDerivedChildRun(runId));
    this.items = Array.from({ length: count }, () => ({}));
  }
}

class FakeBody extends FakeLoadable {
  constructor(
    runtime: FakeOfficeWordRuntime,
    readonly type: string,
    runId: number
  ) {
    super(runtime, "body", () => runtime.assertDerivedChildRun(runId));
  }
}

class FakeInsertedRange {
  constructor(
    private readonly runtime: FakeOfficeWordRuntime,
    private readonly source: FakeOfficeRange
  ) {}

  select(selectionMode: string): void {
    this.runtime.selectCalls++;
    this.runtime.selectSourceRanges.push(this.source);
    this.runtime.queue("select", () => {
      this.runtime.selectedLocation = `${this.source.resolvedTargetLocationId()}:${selectionMode}`;
    });
  }
}

export class FakeOfficeRange extends FakeLoadable {
  private parentBodyProxy?: FakeBody;
  private parentTableProxy?: FakeNullableObject;
  private parentTableCellProxy?: FakeNullableObject;
  private tablesProxy?: FakeCollection;
  private inlinePicturesProxy?: FakeCollection;

  constructor(
    runtime: FakeOfficeWordRuntime,
    private readonly state: FakeRangeState,
    private readonly targetState: () => FakeRangeState = () => state,
    readonly isSelectionOrigin: boolean = false
  ) {
    super(runtime, `range:${state.locationId}`);
  }

  readState(): FakeRangeState {
    return this.state;
  }

  resolvedTargetState(): FakeRangeState {
    return this.targetState();
  }

  resolvedTargetLocationId(): string {
    return this.resolvedTargetState().locationId;
  }

  get locationId(): string {
    return this.state.locationId;
  }

  get text(): string {
    return this.state.text;
  }

  set text(value: string) {
    this.state.text = value;
  }

  get ooxml(): string {
    return this.state.ooxml;
  }

  set ooxml(value: string) {
    this.state.ooxml = value;
  }

  get isEmpty(): boolean {
    return this.state.isEmpty;
  }

  get cellMarker(): string {
    return this.state.cellMarker;
  }

  get parentBody(): FakeBody {
    return (this.parentBodyProxy ??= new FakeBody(
      this.runtime,
      this.state.bodyType,
      this.runtime.currentRunId()
    ));
  }

  get parentTableOrNullObject(): FakeNullableObject {
    return (this.parentTableProxy ??= new FakeNullableObject(
      this.runtime,
      "parent-table",
      !this.state.hasParentTable,
      this.runtime.currentRunId()
    ));
  }

  get parentTableCellOrNullObject(): FakeNullableObject {
    return (this.parentTableCellProxy ??= new FakeNullableObject(
      this.runtime,
      "parent-table-cell",
      !this.state.hasParentTableCell,
      this.runtime.currentRunId()
    ));
  }

  get tables(): FakeCollection {
    return (this.tablesProxy ??= new FakeCollection(
      this.runtime,
      "tables",
      this.state.containedTableCount,
      this.runtime.currentRunId()
    ));
  }

  get inlinePictures(): FakeCollection {
    return (this.inlinePicturesProxy ??= new FakeCollection(
      this.runtime,
      "inline-pictures",
      this.state.inlinePictureCount,
      this.runtime.currentRunId()
    ));
  }

  get documentText(): string {
    return `${this.text}${this.cellMarker}`;
  }

  getOoxml(): OfficeExtension.ClientResult<string> {
    const result = { value: "" } as OfficeExtension.ClientResult<string>;
    this.runtime.queue("getOoxml", () => {
      (result as { value: string }).value = this.ooxml;
    });
    return result;
  }

  getRange(rangeLocation: Word.RangeLocation | "Whole" | "Start" | "End"): Word.Range {
    if (rangeLocation !== "Whole") {
      throw new Error("FakeOfficeRange only supports the Whole clone contract");
    }
    const clone = this.runtime.cloneWholeRange(this);
    this.runtime.getRangeCalls.push({ source: this, clone, rangeLocation });
    return clone as unknown as Word.Range;
  }

  track(): this {
    this.runtime.trackCalls++;
    this.runtime.queueTrack(this);
    return this;
  }

  untrack(): this {
    this.runtime.untrackCalls++;
    this.runtime.untrackTargets.push(this);
    this.runtime.queue("untrack", () => {
      this.runtime.releaseTrackedRange(this);
    });
    return this;
  }

  compareLocationWith(other: Word.Range): OfficeExtension.ClientResult<Word.LocationRelation> {
    const otherRange = other as unknown as FakeOfficeRange;
    const result = { value: "Before" } as OfficeExtension.ClientResult<Word.LocationRelation>;
    this.runtime.queue("compareLocationWith", () => {
      (result as { value: Word.LocationRelation }).value = (
        this.resolvedTargetLocationId() === otherRange.resolvedTargetLocationId()
          ? "Equal"
          : "Before"
      ) as Word.LocationRelation;
    });
    return result;
  }

  insertText(text: string, insertLocation: string): Word.Range {
    this.runtime.insertTargets.push(this);
    this.runtime.queue("insertText", () => {
      const target = this.resolvedTargetState();
      this.runtime.insertCalls.push({ locationId: target.locationId, text, insertLocation });
      target.text = text;
    });
    return new FakeInsertedRange(this.runtime, this) as unknown as Word.Range;
  }
}

export class FakeOfficeWordRuntime implements OfficeWordRuntime {
  readonly insertCalls: InsertCall[] = [];
  readonly getRangeCalls: GetRangeCall[] = [];
  readonly insertTargets: FakeOfficeRange[] = [];
  readonly selectSourceRanges: FakeOfficeRange[] = [];
  readonly selectionResults: FakeOfficeRange[] = [];
  readonly untrackTargets: FakeOfficeRange[] = [];
  readonly trackedRanges = new Set<FakeOfficeRange>();
  readonly retainedRanges = new Set<FakeOfficeRange>();
  readonly syncBatches: FakeOfficeCommandName[][] = [];
  readonly commandLog: string[] = [];
  readonly resumedRanges: Word.Range[] = [];
  trackCalls = 0;
  untrackCalls = 0;
  selectCalls = 0;
  syncCalls = 0;
  runCalls = 0;
  runWithRangeCalls = 0;
  selectionCalls = 0;
  searchCalls = 0;
  selectedLocation?: string;
  currentSelection: FakeOfficeRange;
  lastTrackedRange?: FakeOfficeRange;
  private queuedCommands: QueuedCommand[] = [];
  private readonly commandFailures: Array<{
    readonly name: FakeOfficeCommandName;
    readonly error: Error;
  }> = [];
  private readonly commandPauses: CommandPause[] = [];
  private readonly syncFailures = new Map<number, Error>();
  private syncsInCurrentRun = 0;
  private runSequence = 0;
  private activeRunId?: number;
  private trackedSelectionOrigin?: FakeOfficeRange;

  constructor(options: FakeSelectionOptions) {
    this.currentSelection = this.createRange(options);
  }

  get mutationCount(): number {
    return this.insertCalls.length;
  }

  setSelection(options: FakeSelectionOptions): FakeOfficeRange {
    this.currentSelection = this.createRange(options);
    return this.currentSelection;
  }

  failNextSync(error: Error): void {
    this.failSyncAt(this.syncCalls + 1, error);
  }

  failSyncAt(syncNumber: number, error: Error): void {
    this.syncFailures.set(syncNumber, error);
  }

  failCommandOnce(name: FakeOfficeCommandName, error: Error): void {
    this.commandFailures.push({ name, error });
  }

  pauseCommandOnce(name: FakeOfficeCommandName): PausedCommand {
    let markStarted: () => void = () => {};
    let release: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.commandPauses.push({ name, markStarted, released });
    return { started, release };
  }

  async run<T>(batch: (context: Word.RequestContext) => Promise<T>): Promise<T> {
    this.runCalls++;
    return this.executeRun(batch);
  }

  async runWithRange<T>(
    range: Word.Range,
    batch: (context: Word.RequestContext) => Promise<T>
  ): Promise<T> {
    this.runWithRangeCalls++;
    this.resumedRanges.push(range);
    if (!this.retainedRanges.has(range as unknown as FakeOfficeRange)) {
      const error = new Error("InvalidObjectPath") as Error & { code: string };
      error.name = "RichApi.Error";
      error.code = "InvalidObjectPath";
      throw error;
    }
    return this.executeRun(batch);
  }

  queueTrack(range: FakeOfficeRange): void {
    const queuedBeforeFirstSync = this.syncsInCurrentRun === 0;
    this.queue("track", () => {
      this.trackedRanges.add(range);
      if (queuedBeforeFirstSync) {
        this.retainedRanges.add(range);
      }
      if (range.isSelectionOrigin) {
        this.trackedSelectionOrigin = range;
      }
      this.lastTrackedRange = range;
    });
  }

  cloneWholeRange(source: FakeOfficeRange): FakeOfficeRange {
    // A retained raw getSelection proxy can keep Capture facts while later
    // operations resolve against the live selection target in Word Web.
    if (source.isSelectionOrigin && this.trackedRanges.has(source)) {
      return new FakeOfficeRange(this, source.readState(), () => source.resolvedTargetState());
    }

    const exactState = source.resolvedTargetState();
    return new FakeOfficeRange(this, exactState);
  }

  releaseTrackedRange(range: FakeOfficeRange): void {
    this.trackedRanges.delete(range);
    this.retainedRanges.delete(range);
    if (this.trackedSelectionOrigin === range) {
      this.trackedSelectionOrigin = undefined;
    }
  }

  queue(name: FakeOfficeCommandName, execute: () => void): void {
    this.queuedCommands.push({ name, execute });
  }

  currentRunId(): number {
    if (this.activeRunId === undefined) {
      throw new Error("Fake derived proxy was created outside a Word.run batch");
    }
    return this.activeRunId;
  }

  assertDerivedChildRun(runId: number): void {
    if (this.activeRunId !== runId) {
      const error = new Error("InvalidObjectPath") as Error & { code: string };
      error.name = "RichApi.Error";
      error.code = "InvalidObjectPath";
      throw error;
    }
  }

  private async executeRun<T>(batch: (context: Word.RequestContext) => Promise<T>): Promise<T> {
    if (this.queuedCommands.length > 0) {
      throw new Error("Fake runtime started a run with pending commands");
    }

    this.syncsInCurrentRun = 0;
    this.activeRunId = ++this.runSequence;
    try {
      return await batch(this.context());
    } finally {
      this.queuedCommands = [];
      this.activeRunId = undefined;
    }
  }

  private createRange(options: FakeSelectionOptions): FakeOfficeRange {
    const bodyType = options.bodyType ?? "MainDoc";
    const hasParentTableCell = options.hasParentTableCell ?? false;
    return new FakeOfficeRange(this, {
      locationId: options.locationId ?? "target-1",
      text: options.text,
      bodyType,
      hasParentTable: options.hasParentTable ?? false,
      hasParentTableCell,
      containedTableCount: options.containedTableCount ?? 0,
      inlinePictureCount: options.inlinePictureCount ?? 0,
      isEmpty: options.isEmpty ?? options.text.length === 0,
      ooxml: options.ooxml ?? PLAIN_TEXT_OOXML,
      cellMarker:
        options.cellMarker ?? (bodyType === "TableCell" && hasParentTableCell ? "\u0007" : ""),
    });
  }

  private context(): Word.RequestContext {
    return {
      document: {
        getSelection: () => {
          this.selectionCalls++;
          const retainedOrigin = this.trackedSelectionOrigin;
          const selection =
            retainedOrigin && this.trackedRanges.has(retainedOrigin)
              ? retainedOrigin
              : new FakeOfficeRange(
                  this,
                  this.currentSelection.readState(),
                  () => this.currentSelection.resolvedTargetState(),
                  true
                );
          this.selectionResults.push(selection);
          return selection as unknown as Word.Range;
        },
        body: {
          search: () => {
            this.searchCalls++;
            throw new Error("Fake runtime forbids search");
          },
        },
      },
      trackedObjects: {
        add: (range: Word.Range) => {
          (range as unknown as FakeOfficeRange).track();
        },
      },
      sync: async () => {
        this.syncsInCurrentRun++;
        this.syncCalls++;
        const syncNumber = this.syncCalls;
        const commands = this.queuedCommands;
        this.queuedCommands = [];
        this.syncBatches.push(commands.map(({ name }) => name));
        this.commandLog.push(`sync:${syncNumber}:start`);

        const syncError = this.syncFailures.get(syncNumber);
        if (syncError) {
          this.syncFailures.delete(syncNumber);
          this.commandLog.push(`sync:${syncNumber}:failed`);
          throw syncError;
        }

        for (const command of commands) {
          const pauseIndex = this.commandPauses.findIndex(({ name }) => name === command.name);
          if (pauseIndex >= 0) {
            const [pause] = this.commandPauses.splice(pauseIndex, 1);
            pause.markStarted();
            await pause.released;
          }

          const failureIndex = this.commandFailures.findIndex(({ name }) => name === command.name);
          if (failureIndex >= 0) {
            const [{ error }] = this.commandFailures.splice(failureIndex, 1);
            this.commandLog.push(`failed:${command.name}`);
            throw error;
          }
          command.execute();
          this.commandLog.push(`executed:${command.name}`);
        }
        this.commandLog.push(`sync:${syncNumber}:complete`);
      },
    } as unknown as Word.RequestContext;
  }
}
