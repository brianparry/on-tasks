// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');

module.exports = obmControlJobFactory;
di.annotate(obmControlJobFactory, new di.Provide('Job.Obm.Node'));
di.annotate(obmControlJobFactory, new di.Inject(
    'Job.Base',
    'Services.Waterline',
    'Logger',
    'Util',
    'Assert',
    'Errors',
    'Task.Services.OBM',
    '_',
    'Promise',
    di.Injector
));
function obmControlJobFactory(
    BaseJob,
    waterline,
    Logger,
    util,
    assert,
    Errors,
    ObmService,
    _,
    Promise,
    injector
) {

    var logger = Logger.initialize(obmControlJobFactory);

    /**
     *
     * @param {Object} options
     * @param {Object} context
     * @param {String} taskId
     * @constructor
     */
    var ObmControlJob = function ObmControlJob(options, context, taskId) {
        ObmControlJob.super_.call(this, logger, options, context, taskId);

        assert.string(this.options.action, 'action');
        assert.ok(_.contains(_.methods(ObmService.prototype), this.options.action),
                'OBM action is a known action');

        this.nodeId = this.context.target || this.options.nodeId;
        assert.string(this.nodeId, 'nodeId');
        this.obmServiceName = this.options.obmServiceName;
    };
    util.inherits(ObmControlJob, BaseJob);

    /**
     * @memberOf ObmControlJob
     * @returns {Promise}
     */
    ObmControlJob.prototype._run = function () {
        var self = this;

        Promise.try(function() {
            if (!self.obmServiceName) { return undefined; }

            return waterline.obms.findByNode(self.nodeId, self.obmServiceName, true);
        })
        .then(function(obm) {
            if (obm) { return obm; }

            return waterline.nodes.findByIdentifier(self.nodeId)
            .then(function(node) {
                if (!node) { return []; }

                return waterline.obms.find({node: node.id});
            })
            .then(function(obms) {
                assert.ok(obms.length, 'No OBM service assigned to this node.');
                assert.ok(obms.length <= 1, 'More than one OBM service assigned to this node.');

                logger.debug("Defaulting to obmServiceName "+ obms.service +
                    " for node because only one OBM service present.");

                return _.first(obms);
            });
        })
        .then(function(obm) {
            assert.object(obm);
            assert.object(obm.config, 'OBM should have settings for service: ' + obm.service);
            self.settings = obm;

            var obmServiceFactory = injector.get(self.settings.service);
            var obmService = ObmService.create(
                self.nodeId,
                obmServiceFactory,
                self.settings,
                self.options
            );

            self.killObm = function() {
                return obmService.kill();
            };

            return obmService[self.options.action]();
        })
        .then(function() {
            self._done();
        })
        .catch(function(e) {
            // If this is a JobKilledError that means a user has cancelled
            // the job externally, so we've called _cleanup and done(error) already.
            if (!(e instanceof Errors.JobKilledError)) {
                self._done(e);
            }
        });
    };

    ObmControlJob.prototype._cleanup = function() {
        if (_.isFunction(this.killObm)) {
            return this.killObm();
        }
    };

    return ObmControlJob;
}
