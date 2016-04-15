'use strict';
/// <reference path="./typings/node/node.d.ts"/>

import pinger = require('pingjs');
import pinglog = require('./types/pinglog');
import async = require('async');
import _ = require('lodash');

class mlcl_ping {
  public static loaderversion = 2;
  public static singleton = false;
  public static molecuel;
  protected prefetchval:Number;
  protected queue:any;
  protected pinger:pinger;
  protected channel: any;
  protected elastic: any;
  public queuename:string;
  protected index:string;
  protected consumer:boolean;

  constructor(molecuel:any, config:any) {
    mlcl_ping.molecuel = molecuel;
    this.pinger = new pinger();
    this.consumer = false;
    // get the queue system
    mlcl_ping.molecuel.once('mlcl::queue::init:post', (queue) => {
      this.queue = queue;
      this.initQueue();
    });

    if(mlcl_ping.molecuel.config.ping &&
      mlcl_ping.molecuel.config.ping.queue &&
      mlcl_ping.molecuel.config.ping.queue.prefetch) {
      this.prefetchval = mlcl_ping.molecuel.config.ping.queue.prefetch;
    }

    // provides mlcl_elastic as argument for the function...
    mlcl_ping.molecuel.once('mlcl::search::connection:success', (mlcl_elastic) => {
      this.elastic = mlcl_elastic;
      this.index = 'pinglogs';
      if(mlcl_ping.molecuel.config.ping && mlcl_ping.molecuel.config.ping.store &&
        mlcl_ping.molecuel.config.ping.store.index) {
        this.index = mlcl_ping.molecuel.config.ping.store.index;
      }

      var mapping = {};
      if(mlcl_ping.molecuel.config.ping && mlcl_ping.molecuel.config.ping.store &&
        mlcl_ping.molecuel.config.ping.store.ttl) {
        mapping[this.index] = {
          '_ttl' : { 'enabled' : true, 'default': mlcl_ping.molecuel.config.ping.store.ttl }
        };
      }

      mlcl_elastic.checkCreateIndex(this.index, {}, mapping, () => {
        mlcl_ping.molecuel.emit('mlcl::ping::connection:success', this);
      });
    });
  }
  protected initQueue() {
    if(this.queue) {
      mlcl_ping.molecuel.log.debug('mlcl_ping', 'Initializing ping queue');
      this.queuename = 'mlcl::ping::logs';
      this.channel = this.queue.getChannel();
      if(mlcl_ping.molecuel.config.ping && mlcl_ping.molecuel.config.ping.restrictroles) {
        var restrictoleslength:number = mlcl_ping.molecuel.config.ping.restrictroles.length;
        var currentlength:number = 0;
        if(mlcl_ping.molecuel.config.ping.restrictroles.length > 0) {
          while(currentlength < restrictoleslength && !this.consumer) {
            var currentelement = mlcl_ping.molecuel.config.ping.restrictroles[currentlength];
            if(mlcl_ping.molecuel.serverroles &&
              mlcl_ping.molecuel.serverroles[currentelement]) {
                this.consumer = true;
                this.initConsumer();
              }
            currentlength++;
          }
        }

      } else {
        this.initConsumer();
      }
    } else {
      mlcl_ping.molecuel.log.error('mlcl_ping', 'Error while Initializing queue');
    }
  }
  protected initConsumer() {
    mlcl_ping.molecuel.log.info('mlcl_ping', 'Init consumer for ping');
    // get the ping channel
    this.channel.then((ch) => {
      ch.assertQueue(this.queuename);
      ch.prefetch(50);
      // consume the queue
      ch.consume(this.queuename, (msg) => {
        if(msg && msg.content && msg.content.toString().length > 0) {
          var pingobj = JSON.parse(msg.content.toString());
          this.pinger.ping(pingobj.ip, {
           count: 1,
           timeout: 500,
           payload: 'pingjs'
         }).then((stats) => {
            var statlog = new pinglog();
            if(stats.pings[0].time) {
              statlog.time= stats.pings[0].time;
            }
            statlog.ip = stats.destination;
            statlog.deviceid = pingobj.id;
            statlog.ipv = 4;
            statlog.status = stats.pings[0].status;
            this.elastic.index(this.index, statlog, (error, res) => {
              if(!error) {
                ch.ack(msg);
              } else {
                mlcl_ping.molecuel.log.error('mlcl_ping', 'Error while saving ping to elasticsearch: '+error.message);
                ch.ack(msg);
              }
            });
          })
        } else {
          ch.ack(msg);
        }
      });
    });
  }
  public sendPing(pingobj:any) {
    this.channel.then((ch) => {
      ch.assertQueue(this.queuename);
      ch.sendToQueue(this.queuename, new Buffer(JSON.stringify(pingobj)));
    });
  }
  public sendPings(devicearray:Array<any>) {
    async.each(devicearray, (device, cb) => {
      this.sendPing(device);
    });
  }
}

export = mlcl_ping;
