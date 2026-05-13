/**
 * TypeScript ambient module declaration for piopiyjs.
 *
 * piopiyjs is a browser-only TeleCMI WebRTC SDK distributed without bundled
 * type definitions. This file provides the minimal surface area needed by the
 * CCM CTI integration (Wave 2).
 *
 * Source: TeleCMI SDK documentation + CCM Wave 2 spec
 */

declare module 'piopiyjs' {
  interface PiopiyOptions {
    name: string;
    debug?: boolean;
    autoplay?: boolean;
    ringTime?: number;
  }

  interface IncomingCallEvent {
    from: string;
    uuid: string;
    to?: string;
  }

  type CallEvent = { code: number; [key: string]: unknown };

  class PIOPIY {
    constructor(options: PiopiyOptions);
    login(userId: string, password: string, sbcUri: string): void;
    logout(): void;
    answer(): void;
    reject(): void;
    terminate(): void;
    mute(): void;
    unMute(): void;
    hold(): void;
    unHold(): void;
    call(destination: string, extraParams?: Record<string, unknown>): void;
    transfer(destination: string): void;
    sendDtmf(tone: string): void;
    getCallId(): string | null;
    on(event: 'login', handler: (obj: CallEvent) => void): void;
    on(event: 'loginFailed', handler: (obj: CallEvent) => void): void;
    on(event: 'inComingCall', handler: (obj: IncomingCallEvent) => void): void;
    on(event: 'answered', handler: (obj: CallEvent) => void): void;
    on(event: 'ended', handler: (obj: CallEvent) => void): void;
    on(event: 'hangup', handler: (obj: CallEvent) => void): void;
    on(event: 'hold', handler: (obj: CallEvent) => void): void;
    on(event: 'unhold', handler: (obj: CallEvent) => void): void;
    on(event: 'mute', handler: (obj: CallEvent) => void): void;
    on(event: 'unmute', handler: (obj: CallEvent) => void): void;
    on(event: 'error', handler: (obj: CallEvent) => void): void;
    on(event: 'callStream', handler: (obj: CallEvent) => void): void;
    on(event: 'RTCStats', handler: (obj: Record<string, unknown>) => void): void;
    /** Outbound: code 100 — SBC accepted the outbound call request */
    on(event: 'trying', handler: (obj: CallEvent) => void): void;
    /** Both: code 183 — inbound call ringing at agent; outbound call ringing at destination */
    on(event: 'ringing', handler: (obj: CallEvent) => void): void;
    /** Agent SIP session ended / logged out */
    on(event: 'logout', handler: (obj: CallEvent) => void): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
  }

  export = PIOPIY;
}
