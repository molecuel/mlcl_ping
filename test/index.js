var should = require('should'),
  EventEmitter = require('events').EventEmitter,
  mlcl_queue = require('mlcl_queue'),
  util = require('util'),
  mlcl_elastic = require('mlcl_elastic'),
  mlcl_ping = require('../');

  describe('mlcl_ping', function() {
    var mlcl;
    var molecuel;
    var mlclping;

    before(function(done) {
      // init fake molecuel
      mlcl = function() {
          return this;
      };
      util.inherits(mlcl, EventEmitter);
      molecuel = new mlcl();

      molecuel.log = {};
      molecuel.log.info = console.log;
      molecuel.log.error = console.log;
      molecuel.log.debug = console.log;
      molecuel.log.warn = console.log;

      molecuel.config = {};

      molecuel.config.queue = {
        uri: 'amqp://localhost'
      };

      molecuel.config.search = {
          hosts: ['http://localhost:9200'],
          prefix: 'mlcl-ping-unit'
      };

      molecuel.config.ping = {
        store: {
          ttl: '4w'
        }
      }

      mlcl_elastic(molecuel);
      mlcl_queue(molecuel);
      mlclping = new mlcl_ping(molecuel, {});

      done();
    });
    describe('ping', function(done) {
      var searchcon;
      var queue;
      it('should init search', function(done) {
        molecuel.once('mlcl::search::connection:success',
          function(search) {
            search.should.be.a.object;
            search.queue.should.be.a.object;
            searchcon = search;
            queue = search.queue;
            done();
          });

        molecuel.emit('mlcl::core::init:post', molecuel);
      });

      it('should add ping messages to the queue', function(done) {
        mlclping.sendPing({id: 123, ip: '8.8.8.8'});
        setTimeout(function() {
          done();
        }, 1000);
      })

      it('should add multiple messages to the queue', function(done) {
        var pings = [
          {id: 123, ip: '8.8.8.8'},
          {id: 123, ip: '8.8.8.8'},
          {id: 123, ip: '8.8.8.8'}
        ]
        mlclping.sendPings(pings);
        setTimeout(function() {
          done();
        }, 1000);
      })
    })

  });
