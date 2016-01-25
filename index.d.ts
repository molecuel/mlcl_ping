import pinger = require('pingjs');
declare class mlcl_ping {
    static loaderversion: number;
    static singleton: boolean;
    static molecuel: any;
    protected prefetchval: Number;
    protected queue: any;
    protected pinger: pinger;
    protected channel: any;
    protected elastic: any;
    queuename: string;
    protected index: string;
    protected consumer: boolean;
    constructor(molecuel: any, config: any);
    protected initQueue(): void;
    protected initConsumer(): void;
    sendPing(pingobj: any): void;
    sendPings(devicearray: Array<any>): void;
}
export = mlcl_ping;
