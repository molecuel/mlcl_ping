'use strict';
var pinger = require('pingjs');
var pinglog = require('./types/pinglog');
var async = require('async');
class mlcl_ping {
    constructor(molecuel, config) {
        mlcl_ping.molecuel = molecuel;
        this.pinger = new pinger();
        mlcl_ping.molecuel.once('mlcl::queue::init:post', (queue) => {
            this.queue = queue;
            this.initQueue();
        });
        if (mlcl_ping.molecuel.config.ping &&
            mlcl_ping.molecuel.config.ping.queue &&
            mlcl_ping.molecuel.config.ping.queue.prefetch) {
            this.prefetchval = mlcl_ping.molecuel.config.ping.queue.prefetch;
        }
        mlcl_ping.molecuel.once('mlcl::search::connection:success', (mlcl_elastic) => {
            this.elastic = mlcl_elastic;
            this.index = 'pinglogs';
            if (mlcl_ping.molecuel.config.ping && mlcl_ping.molecuel.config.ping.store &&
                mlcl_ping.molecuel.config.ping.store.index) {
                this.index = mlcl_ping.molecuel.config.ping.store.index;
            }
            var mapping = {};
            if (mlcl_ping.molecuel.config.ping && mlcl_ping.molecuel.config.ping.store.ttl) {
                mapping[this.index] = {
                    '_ttl': { 'enabled': true, 'default': mlcl_ping.molecuel.config.ping.store.ttl }
                };
            }
            mlcl_elastic.checkCreateIndex(this.index, {}, mapping, () => {
                mlcl_ping.molecuel.emit('mlcl::ping::connection:success', this);
            });
        });
    }
    initQueue() {
        if (this.queue) {
            mlcl_ping.molecuel.log.debug('mlcl_ping', 'Initializing ping queue');
            this.queuename = 'mlcl::ping::logs';
            this.channel = this.queue.getChannel();
            this.initConsumer();
        }
        else {
            mlcl_ping.molecuel.log.error('mlcl_ping', 'Error while Initializing queue');
        }
    }
    initConsumer() {
        this.channel.then((ch) => {
            ch.assertQueue(this.queuename);
            ch.prefetch(50);
            ch.consume(this.queuename, (msg) => {
                if (msg && msg.content && msg.content.toString().length > 0) {
                    var pingobj = JSON.parse(msg.content.toString());
                    this.pinger.ping(pingobj.ip, {
                        count: 1,
                        timeout: 500,
                        payload: 'pingjs'
                    }).then((stats) => {
                        var statlog = new pinglog();
                        if (stats.pings[0].time) {
                            statlog.time = stats.pings[0].time;
                        }
                        statlog.ip = stats.destination;
                        statlog.deviceid = pingobj.id;
                        statlog.ipv = 4;
                        statlog.status = stats.pings[0].status;
                        this.elastic.index(this.index, statlog, (error, res) => {
                            if (!error) {
                                ch.ack(msg);
                            }
                            else {
                                ch.nack(msg);
                            }
                        });
                    });
                }
                else {
                    ch.ack(msg);
                }
            });
        });
    }
    sendPing(pingobj) {
        this.channel.then((ch) => {
            ch.assertQueue(this.queuename);
            ch.sendToQueue(this.queuename, new Buffer(JSON.stringify(pingobj)));
        });
    }
    sendPings(devicearray) {
        async.each(devicearray, (device, cb) => {
            this.sendPing(device);
        });
    }
}
mlcl_ping.loaderversion = 2;
mlcl_ping.singleton = false;
module.exports = mlcl_ping;