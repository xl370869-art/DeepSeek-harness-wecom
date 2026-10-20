import * as z from '@deepseek-ai/schemastery';
import z__default from '@deepseek-ai/schemastery';
import { Context } from '@deepseek-ai/cordis';
import { BaseMessage, WSClientOptions, WsFrame, EventMessageWith, EnterChatEvent, WsFrameHeaders, ReplyMsgItem, UploadMediaOptions, WeComMediaType } from '@wecom/aibot-node-sdk';
import { ImageMediaType } from '@deepseek-ai/dsh-attachment';
import { ContentBlock } from '@deepseek-ai/dsh-llm';
import { ApprovalOutcome, ApprovalRequest } from '@deepseek-ai/dsh-user-approval';

/** Access policy for one WeCom chat scope. */
type AccessMode = 'open' | 'allowlist' | 'disabled';
/** How inbound WeCom images are presented to the selected Harness model. */
type ImageInputMode = 'auto' | 'always' | 'never';
/** WeCom AI Bot channel configuration. */
interface Config {
    botId: string;
    secretRef: string;
    accountId: string;
    cwd: string;
    agentPreset?: string;
    websocketUrl: string;
    scene: number;
    singlePolicy: AccessMode;
    singleAllowFrom: string[];
    groupPolicy: AccessMode;
    groupAllowFrom: string[];
    allowedHarnessCommands: string[];
    imageInputMode: ImageInputMode;
    inboundFileDirectory: string;
    welcomeText: string;
    startupTimeoutMs: number;
    responseTimeoutMs: number;
    approvalTimeoutMs: number;
    mediaDownloadTimeoutMs: number;
    sendTimeoutMs: number;
    reconnectIntervalMs: number;
    maxReconnectAttempts: number;
    maxAuthFailureAttempts: number;
    sendRetries: number;
    maxReplyBytes: number;
    maxSeenMessageIds: number;
    maxInboundFileBytes: number;
    maxOutboundFileBytes: number;
    systemPrompt: string;
}
/** Runtime-validated plugin configuration. */
declare const Config: z__default<Config>;

/** Minimal official-SDK media download surface used by inbound conversion. */
interface WeComDownloadPort {
    downloadFile(url: string, aesKey?: string): Promise<{
        buffer: Buffer;
        filename?: string;
    }>;
}
/** Build durable DSH content blocks from one WeCom message. */
declare function inboundContent(ctx: Context, config: Config, client: WeComDownloadPort, message: BaseMessage, includeImages?: boolean): Promise<ContentBlock[]>;
/** Detect the image formats accepted by Harness attachments from magic bytes. */
declare function detectImageMediaType(data: Uint8Array): ImageMediaType;

interface WeComClientPort extends WeComDownloadPort {
    readonly isConnected: boolean;
    on(event: 'connected' | 'authenticated', handler: () => void): this;
    on(event: 'disconnected', handler: (reason: string) => void): this;
    on(event: 'reconnecting', handler: (attempt: number) => void): this;
    on(event: 'error', handler: (error: Error) => void): this;
    on(event: 'message', handler: (frame: WsFrame<BaseMessage>) => void | Promise<void>): this;
    on(event: 'event.enter_chat', handler: (frame: WsFrame<EventMessageWith<EnterChatEvent>>) => void | Promise<void>): this;
    on(event: 'event.disconnected_event', handler: () => void): this;
    connect(): this;
    disconnect(): void;
    replyStream(frame: WsFrameHeaders, streamId: string, content: string, finish?: boolean, msgItem?: ReplyMsgItem[]): Promise<unknown>;
    replyWelcome(frame: WsFrameHeaders, body: {
        msgtype: 'text';
        text: {
            content: string;
        };
    }): Promise<unknown>;
    uploadMedia(fileBuffer: Buffer, options: UploadMediaOptions): Promise<{
        media_id: string;
    }>;
    sendMediaMessage(chatid: string, mediaType: WeComMediaType, mediaId: string): Promise<unknown>;
}
type WeComClientFactory = (options: WSClientOptions) => WeComClientPort;
/** Live WeCom WebSocket ↔ DeepSeek Harness bridge. */
declare class WeComHarnessBridge {
    private readonly ctx;
    private readonly config;
    private readonly clientFactory;
    private readonly log;
    private readonly conversations;
    private readonly seen;
    private readonly allowedHarnessCommands;
    private client;
    private stopping;
    constructor(ctx: Context, config: Config, clientFactory?: WeComClientFactory);
    /** Stay dormant without credentials, or authenticate and wait for WeCom readiness. */
    start(): Promise<void>;
    /** Stop ingress and drain owned conversations. */
    stop(): Promise<void>;
    private createClient;
    private handleWelcome;
    private handleMessage;
    private helpText;
    private commandReply;
    private allowed;
    private sendReply;
    private sendLocalFile;
    private sendMedia;
    private retry;
    private requireClient;
}

/** A one-shot approval decision sent from a WeCom conversation. */
interface ApprovalCommand {
    code: string;
    outcome: Extract<ApprovalOutcome, 'allowed-once' | 'rejected'>;
}
/** The pending request resolved by an approval command. */
interface ResolvedApproval {
    code: string;
    outcome: ApprovalCommand['outcome'];
    toolName: string;
}
/** Parse approval and rejection commands without forwarding malformed decisions to the model. */
declare function parseApprovalCommand(text: string): ApprovalCommand | 'invalid' | undefined;
/** Owns requester-bound, expiring approval decisions for the WeCom channel. */
declare class WeComApprovalRegistry {
    private readonly timeoutMs;
    private readonly context?;
    private readonly pending;
    constructor(timeoutMs: number, context?: Context | undefined);
    /** Send one approval prompt and await its single decision. */
    request(conversationId: string, request: ApprovalRequest, sendPrompt: (text: string) => Promise<void>): Promise<ApprovalOutcome>;
    /** Decide only a request originating from the same WeCom conversation. */
    decide(conversationId: string, command: ApprovalCommand): ResolvedApproval | undefined;
    /** Cancel every pending request for one conversation. */
    cancelConversation(conversationId: string): boolean;
    /** Cancel every pending request during channel teardown. */
    cancelAll(): void;
    private createCode;
}
/** Render the structured tool call associated with one Harness approval request. */
declare function formatApprovalPrompt(request: ApprovalRequest, code: string, timeoutMs: number, context?: Context): Promise<string>;

/** Deterministic, non-identifying DSH session id for one WeCom conversation. */
declare function sessionIdFor(accountId: string, message: Pick<BaseMessage, 'chattype' | 'chatid' | 'from'>): string;
/** Target id accepted by WeCom proactive-send APIs. */
declare function chatTarget(message: Pick<BaseMessage, 'chattype' | 'chatid' | 'from'>): string;
/** Bound UTF-8 text to a WeCom byte limit without splitting a code point. */
declare function truncateUtf8(text: string, maxBytes: number, suffix?: string): string;
/** Bounded insertion-ordered duplicate detector. */
declare class SeenMessageIds {
    private readonly limit;
    private readonly ids;
    constructor(limit: number);
    /** Return true for a duplicate; record a new id otherwise. */
    hasOrAdd(id: string): boolean;
}

declare const name = "deepseek-harness-wecom";
declare const inject: string[];

interface WeComBridgeLifecycle {
    start(): Promise<void>;
    stop(): Promise<void>;
}
/** Mount the WeCom connection in the background and tie teardown to the Cordis plugin lifecycle. */
declare function mountBridge(ctx: Context, bridge: WeComBridgeLifecycle): void;
/** Create and mount the WeCom connection without awaiting external authentication. */
declare function apply(ctx: Context, config: Config): void;
declare const _default: {
    name: string;
    inject: string[];
    Config: z.default<Config>;
    apply: typeof apply;
};

export { type ApprovalCommand, Config, Config as ConfigType, type ResolvedApproval, SeenMessageIds, WeComApprovalRegistry, WeComHarnessBridge, apply, chatTarget, _default as default, detectImageMediaType, formatApprovalPrompt, inboundContent, inject, mountBridge, name, parseApprovalCommand, sessionIdFor, truncateUtf8 };
